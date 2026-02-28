import asyncio
import json
import logging
import re

from services.gemini_client import generate_json
from services.supabase_client import get_supabase
from agents.chat_agent import get_greeting, extract_keywords_from_messages
from agents.chat_agents.general_agent import generate_general_response
from agents.chat_agents.consultation_agent import generate_consultation_response
from agents.chat_agents.medical_agent import generate_medical_response

logger = logging.getLogger(__name__)

# ============================================
# Intent Router — 사용자 의도 분류 + 에이전트 디스패치
# ============================================

ROUTE_PROMPT_JA = """あなたはユーザーメッセージの意図を分類する専門家です。
以下の会話履歴とユーザーの最新メッセージを分析し、意図とCTAレベルを判定してください。

【分類カテゴリ: intent】
- "greeting": 挨拶、最初の会話開始（こんにちは、はじめまして等）
- "general": 日常的な雑談、天気、旅行、食事など医療と無関係な質問
- "consultation": 費用、価格、日程、予約、入院期間、回復期間、準備事項、スケジュールに関する質問
- "medical": 施術方法、副作用、効果、原理、施術比較、おすすめ施術、リスクに関する質問

【追加判定: category】
"consultation"または"medical"の場合のみ、以下も判定：
- "dermatology": 皮膚科系（ニキビ、シミ、毛穴、レーザー、HIFU、ウルセラ、リジュラン等）
- "plastic_surgery": 整形外科系（二重、鼻整形、脂肪吸引、輪郭、リフティング等）

【CTA判定: cta_level】会話全体の文脈でユーザーの購買意欲を判定：
- "hot": 以下のいずれかに該当 → hot
  ・具体的な日程・費用・予約に関する質問
  ・施術の効果・回復期間・所要時間など実務的な質問を2回以上
  ・「いつ行けますか」「申し込みたい」「予約したい」等の積極的発話
  ・同じ施術について深掘り質問を続けている（3ターン以上）
- "warm": 関心はあるが初回質問、または比較・検討段階
- "cool": 最初の挨拶や情報探索の初期段階のみ（1ターン目）
- ★重要: 会話が3ターン以上続き、施術について具体的に質問している場合は必ず"hot"と判定すること

【判定のポイント】
- 「いくら」「費用」「値段」「期間」「予約」→ consultation
- 「方法」「副作用」「効果」「リスク」「比較」→ medical
- 曖昧な場合は会話履歴の文脈で判断

JSON形式で返してください：
{"intent": "medical", "category": "plastic_surgery", "cta_level": "hot"}
"""

ROUTE_PROMPT_KO = """당신은 사용자 메시지의 의도를 분류하는 전문가입니다.
아래 대화 이력과 사용자의 최신 메시지를 분석하여 의도와 CTA 레벨을 판정해주세요.

【분류 카테고리: intent】
- "greeting": 인사, 첫 대화 시작 (안녕하세요, 처음 뵙겠습니다 등)
- "general": 일상적인 잡담, 날씨, 여행, 음식 등 의료와 무관한 질문
- "consultation": 비용, 가격, 일정, 예약, 입원기간, 회복기간, 준비사항, 스케줄 관련 질문
- "medical": 시술 방법, 부작용, 효과, 원리, 시술 비교, 추천 시술, 리스크 관련 질문

【추가 판정: category】
"consultation" 또는 "medical"일 때만 다음도 판정:
- "dermatology": 피부과 계열 (여드름, 기미, 모공, 레이저, 하이푸, 울쎄라, 리쥬란 등)
- "plastic_surgery": 성형외과 계열 (쌍꺼풀, 코 성형, 지방흡입, 윤곽, 리프팅 등)

【CTA 판정: cta_level】대화 전체 맥락으로 사용자의 구매 의향을 판정:
- "hot": 아래 중 하나라도 해당되면 → hot
  · 구체적 일정/비용/예약 관련 질문
  · 시술 효과/회복기간/소요시간 등 실무적 질문이 2회 이상
  · "언제 갈 수 있나요", "신청하고 싶어요", "예약하고 싶어요" 등 적극적 발화
  · 같은 시술에 대해 심층 질문을 계속하는 경우 (3턴 이상)
- "warm": 관심은 있지만 첫 질문이거나 비교/검토 단계
- "cool": 첫 인사나 정보 탐색 초기 단계만 (1턴째)
- ★중요: 대화가 3턴 이상 이어지고 시술에 대해 구체적으로 질문하고 있다면 반드시 "hot"으로 판정할 것

【판정 포인트】
- "얼마", "비용", "가격", "기간", "예약" → consultation
- "방법", "부작용", "효과", "리스크", "비교" → medical
- 모호한 경우 대화 이력의 맥락으로 판단

JSON 형식으로 반환:
{"intent": "medical", "category": "plastic_surgery", "cta_level": "hot"}
"""

# 이메일 정규식
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# 동의/거절 패턴
CONSENT_YES_PATTERN = re.compile(
    r"(はい|お願い|同意|네|동의|좋아요|부탁|OK|ok|예|ええ|うん|そうして|承諾|了解|オッケー)",
    re.IGNORECASE,
)
CONSENT_NO_PATTERN = re.compile(
    r"(いいえ|結構|やめ|아니|싫|괜찮|不要|いらない|だめ|거절|사양)",
    re.IGNORECASE,
)


async def route_message(
    messages: list[dict],
    language: str = "ja",
) -> dict:
    """사용자 메시지의 의도를 분류.
    Returns: {"intent": "...", "category": "...", "email": "..." or None, "cta_level": "..."}
    """
    # 최신 사용자 메시지
    latest_user_msg = ""
    for m in reversed(messages):
        if m["role"] == "user":
            latest_user_msg = m["content"]
            break

    if not latest_user_msg:
        return {"intent": "greeting", "category": None, "email": None, "cta_level": "cool"}

    # 이메일 감지
    email_match = EMAIL_PATTERN.search(latest_user_msg)
    detected_email = email_match.group(0) if email_match else None

    # 대화 이력 (최근 6개)
    recent = messages[-6:]
    history_lines = []
    for m in recent:
        role = "user" if m["role"] == "user" else "assistant"
        history_lines.append(f"{role}: {m['content']}")
    history_text = "\n".join(history_lines)

    route_prompt = ROUTE_PROMPT_JA if language == "ja" else ROUTE_PROMPT_KO

    prompt = f"""{route_prompt}

【会話履歴 / 대화 이력】
{history_text}

【最新メッセージ / 최신 메시지】
{latest_user_msg}
"""

    try:
        raw = await generate_json(prompt)
        data = json.loads(raw)
        if isinstance(data, list):
            data = data[0] if data else {}

        intent = data.get("intent", "general")
        if intent not in ("greeting", "general", "consultation", "medical"):
            intent = "general"

        category = data.get("category", "plastic_surgery")
        if category not in ("dermatology", "plastic_surgery"):
            category = "plastic_surgery"

        cta_level = data.get("cta_level", "cool")
        if cta_level not in ("hot", "warm", "cool"):
            cta_level = "cool"

        result = {
            "intent": intent,
            "category": category if intent in ("consultation", "medical") else None,
            "email": detected_email,
            "cta_level": cta_level,
        }

        logger.info(f"[Router] intent={intent}, category={category}, cta={cta_level}, email={detected_email}")
        return result

    except Exception as e:
        logger.warning(f"[Router] Classification failed: {e}, defaulting to general")
        return {"intent": "general", "category": None, "email": detected_email, "cta_level": "cool"}


async def run_multi_agent_chat(
    messages: list[dict],
    language: str = "ja",
    session_id: str | None = None,
) -> dict:
    """멀티에이전트 오케스트레이터.
    1. 이메일 동의 상태 확인 (대화형)
    2. Router + 키워드 추출 병렬 실행
    3. 이메일 감지 시 대화형 동의 요청
    4. 해당 에이전트에 디스패치 (pre-extracted keywords 전달)

    Returns: {
        "response": str,
        "rag_references": list[dict],
        "agent_type": str,
    }
    """
    # 0. 이메일 동의 대기 상태 확인
    if session_id:
        consent_result = await _check_email_consent(messages, session_id, language)
        if consent_result:
            return consent_result

    # 1. Router + 키워드 추출 병렬 실행
    route_task = route_message(messages, language)
    keyword_task = extract_keywords_from_messages(messages, language)
    route_result, pre_keywords = await asyncio.gather(route_task, keyword_task)

    intent = route_result["intent"]
    category = route_result["category"] or "plastic_surgery"
    detected_email = route_result["email"]
    cta_level = route_result.get("cta_level", "cool")

    # 2. 이메일 감지 시 → 대화형 동의 요청
    if detected_email and session_id:
        return await _handle_email_detected(detected_email, session_id, language)

    # 3. 에이전트 디스패치
    user_turn_count = sum(1 for m in messages if m["role"] == "user")

    if intent == "greeting":
        # 대화 중 인사(2턴 이상)는 General Agent로
        if user_turn_count > 1:
            response = await generate_general_response(messages, language)
            return {
                "response": response,
                "rag_references": [],
                "agent_type": "general",
                "cta_level": cta_level,
            }
        greeting = get_greeting(language)
        return {
            "response": greeting,
            "rag_references": [],
            "agent_type": "greeting",
            "cta_level": cta_level,
        }

    elif intent == "general":
        response = await generate_general_response(messages, language)
        return {
            "response": response,
            "rag_references": [],
            "agent_type": "general",
            "cta_level": cta_level,
        }

    elif intent == "consultation":
        response, rag_refs = await generate_consultation_response(
            messages, language, category, user_turn_count, cta_level,
            pre_extracted_keywords=pre_keywords,
        )
        return {
            "response": response,
            "rag_references": rag_refs,
            "agent_type": "consultation",
            "cta_level": cta_level,
        }

    elif intent == "medical":
        response, rag_refs = await generate_medical_response(
            messages, language, category, cta_level,
            pre_extracted_keywords=pre_keywords,
        )
        return {
            "response": response,
            "rag_references": rag_refs,
            "agent_type": "medical",
            "cta_level": cta_level,
        }

    # fallback
    response = await generate_general_response(messages, language)
    return {
        "response": response,
        "rag_references": [],
        "agent_type": "general",
        "cta_level": cta_level,
    }


# ============================================
# 대화형 이메일 동의 헬퍼
# ============================================

async def _check_email_consent(
    messages: list[dict],
    session_id: str,
    language: str,
) -> dict | None:
    """동의 대기 상태면 사용자 응답을 처리. 아니면 None 반환."""
    db = get_supabase()

    try:
        session_result = (
            db.table("chat_sessions")
            .select("pending_email, email_consent_status")
            .eq("id", session_id)
            .single()
            .execute()
        )
    except Exception:
        return None

    if not session_result.data:
        return None

    consent_status = session_result.data.get("email_consent_status")
    if consent_status != "pending":
        return None

    pending_email = session_result.data.get("pending_email")
    if not pending_email:
        return None

    # 최신 사용자 메시지
    latest_msg = ""
    for m in reversed(messages):
        if m["role"] == "user":
            latest_msg = m["content"]
            break

    if not latest_msg:
        return None

    # 동의 여부 판별
    if CONSENT_YES_PATTERN.search(latest_msg):
        # 동의 → 이메일 확정 저장
        db.table("chat_sessions").update({
            "customer_email": pending_email,
            "email_consent_status": "agreed",
        }).eq("id", session_id).execute()

        if language == "ja":
            response = (
                f"ご同意ありがとうございます！{pending_email} 宛に、3日以内にリポートをお届けいたします。\n\n"
                "引き続き、ご質問がございましたらお気軽にどうぞ。"
            )
        else:
            response = (
                f"동의해 주셔서 감사합니다! {pending_email}으로 3일 이내에 리포트를 보내드리겠습니다.\n\n"
                "계속 궁금한 점이 있으시면 편하게 말씀해 주세요."
            )

        logger.info(f"[Router] Email consent agreed: {pending_email} (session {session_id[:8]})")
        return {"response": response, "rag_references": [], "agent_type": "consultation"}

    elif CONSENT_NO_PATTERN.search(latest_msg):
        # 거절 → 상태 초기화
        db.table("chat_sessions").update({
            "pending_email": None,
            "email_consent_status": "declined",
        }).eq("id", session_id).execute()

        if language == "ja":
            response = "承知いたしました。引き続きご質問がございましたらお気軽にどうぞ。"
        else:
            response = "알겠습니다. 계속 궁금한 점이 있으시면 편하게 말씀해 주세요."

        logger.info(f"[Router] Email consent declined (session {session_id[:8]})")
        return {"response": response, "rag_references": [], "agent_type": "consultation"}

    # 동의/거절이 아닌 다른 메시지 → 일반 라우팅으로 진행 (동의 상태 유지)
    return None


async def _handle_email_detected(
    email: str,
    session_id: str,
    language: str,
) -> dict:
    """이메일 감지 시 DB에 pending 저장 + 대화형 동의 질문 반환."""
    db = get_supabase()

    db.table("chat_sessions").update({
        "pending_email": email,
        "email_consent_status": "pending",
    }).eq("id", session_id).execute()

    if language == "ja":
        response = (
            f"ありがとうございます。{email} 宛にご相談内容をまとめた分析リポートをお届けいたします。\n\n"
            "リポート送付のため、メールアドレスの収集・利用についてご同意いただけますか？"
            "「はい」とお答えいただければ、3日以内にリポートをお届けいたします。"
        )
    else:
        response = (
            f"감사합니다. {email}으로 상담 내용을 정리한 분석 리포트를 보내드리겠습니다.\n\n"
            "리포트 발송을 위해 이메일 주소 수집 및 이용에 동의하시겠습니까? "
            "\"네\"라고 답해주시면 3일 이내에 리포트를 보내드리겠습니다."
        )

    logger.info(f"[Router] Email detected: {email}, consent pending (session {session_id[:8]})")

    return {
        "response": response,
        "rag_references": [],
        "agent_type": "consultation",
    }
