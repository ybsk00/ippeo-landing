import json
import logging
import re

from services.gemini_client import generate_json
from agents.chat_agent import get_greeting
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
- "hot": 具体的な日程・費用質問、予約希望、「いつ行けますか」「申し込みたい」等の積極的な発話
- "warm": 関心はあるが比較中・検討中。「もう少し調べたい」「他の方法は？」等
- "cool": 情報探索段階。「ちょっと気になって」「まだ具体的には」等
- 会話履歴全体を考慮して判定（最新メッセージだけでなく、過去の発話も含む）

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
- "hot": 구체적 일정/비용 질문, 예약 희망, "언제 갈 수 있나요", "신청하고 싶어요" 등 적극적 발화
- "warm": 관심은 있지만 비교/검토 중. "좀 더 알아보고 싶어요", "다른 방법은?" 등
- "cool": 정보 탐색 단계. "좀 궁금해서", "아직 구체적으로는" 등
- 대화 이력 전체를 고려하여 판정 (최신 메시지뿐 아니라 과거 발화도 포함)

【판정 포인트】
- "얼마", "비용", "가격", "기간", "예약" → consultation
- "방법", "부작용", "효과", "리스크", "비교" → medical
- 모호한 경우 대화 이력의 맥락으로 판단

JSON 형식으로 반환:
{"intent": "medical", "category": "plastic_surgery", "cta_level": "hot"}
"""

# 이메일 정규식
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


async def route_message(
    messages: list[dict],
    language: str = "ja",
) -> dict:
    """사용자 메시지의 의도를 분류.
    Returns: {"intent": "...", "category": "...", "email": "..." or None}
    """
    # 최신 사용자 메시지
    latest_user_msg = ""
    for m in reversed(messages):
        if m["role"] == "user":
            latest_user_msg = m["content"]
            break

    if not latest_user_msg:
        return {"intent": "greeting", "category": None, "email": None}

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
    1. Intent Router로 의도 분류
    2. 이메일 감지 시 DB 업데이트
    3. 해당 에이전트에 디스패치
    4. 응답 + 메타데이터 반환

    Returns: {
        "response": str,
        "rag_references": list[dict],
        "agent_type": str,  # "greeting" | "general" | "consultation" | "medical"
    }
    """
    # 1. 의도 분류
    route_result = await route_message(messages, language)
    intent = route_result["intent"]
    category = route_result["category"] or "plastic_surgery"
    detected_email = route_result["email"]
    cta_level = route_result.get("cta_level", "cool")

    # 2. 이메일 감지 시 → 동의 요청 (바로 저장하지 않음)
    if detected_email:
        if language == "ja":
            response = (
                f"{detected_email} 宛にご相談内容をまとめた分析リポートをお送りいたします。\n\n"
                "リポート送付のため、メールアドレスの収集・利用に同意いただけますか？"
            )
        else:
            response = (
                f"{detected_email}으로 상담 내용을 정리한 분석 리포트를 보내드리겠습니다.\n\n"
                "리포트 발송을 위해 이메일 주소 수집 및 이용에 동의하시겠습니까?"
            )
        return {
            "response": response,
            "rag_references": [],
            "agent_type": "consultation",
            "pending_email": detected_email,
        }

    # 4. 에이전트 디스패치
    user_turn_count = sum(1 for m in messages if m["role"] == "user")

    if intent == "greeting":
        # 대화 중 인사(2턴 이상)는 General Agent로 → 자연스러운 응답
        if user_turn_count > 1:
            response = await generate_general_response(messages, language)
            return {
                "response": response,
                "rag_references": [],
                "agent_type": "general",
            }
        # 첫 인사만 하드코딩 greeting
        greeting = get_greeting(language)
        return {
            "response": greeting,
            "rag_references": [],
            "agent_type": "greeting",
        }

    elif intent == "general":
        response = await generate_general_response(messages, language)
        return {
            "response": response,
            "rag_references": [],
            "agent_type": "general",
        }

    elif intent == "consultation":
        response, rag_refs = await generate_consultation_response(
            messages, language, category, user_turn_count, cta_level
        )
        return {
            "response": response,
            "rag_references": rag_refs,
            "agent_type": "consultation",
        }

    elif intent == "medical":
        response, rag_refs = await generate_medical_response(
            messages, language, category, cta_level
        )
        return {
            "response": response,
            "rag_references": rag_refs,
            "agent_type": "medical",
        }

    # fallback
    response = await generate_general_response(messages, language)
    return {
        "response": response,
        "rag_references": [],
        "agent_type": "general",
    }
