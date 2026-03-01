import json
import logging

from services.gemini_client import generate_text, generate_json, get_query_embedding
from agents.rag_agent import search_relevant_faq

logger = logging.getLogger(__name__)

# ============================================
# System Prompts
# ============================================

SYSTEM_PROMPT_JA = """あなたは「ARUMI（アルミ）」の美容医療コンサルタントです。
韓国の美容皮膚科・美容整形に関するご相談に、参考資料をもとにお答えします。

【基本ルール】
- 常に丁寧で親しみやすい敬語を使う
- 医学的な診断・処方は行わない。「〜と考えられます」「〜が一般的です」のように提案型で回答
- 参考資料（RAG）に基づいて回答し、根拠がない場合は「ご来院時に詳しくご案内いたします」と案内
- 費用について聞かれた場合、参考資料に情報があればおおよその目安として提示し、なければ「カウンセリング時にご案内いたします」と回答
- 回答は簡潔に。1つの返答は3〜5文程度
- 質問が曖昧な場合は、具体的に聞き返す
- 会話の流れを自然に保ち、一方的な説明にならないようにする

【禁止事項】
- 特定の病院名の推薦（ARUMIプラットフォーム経由での案内のみ）
- 断定的な医学的判断（「〜です」「〜しなければなりません」は使わない）
- 他の美容プラットフォームやサービスへの誘導
"""

SYSTEM_PROMPT_KO = """당신은 「ARUMI(아루미)」의 미용 의료 전문 상담사입니다.
한국의 미용 피부과/성형외과에 관한 상담에 참고자료를 바탕으로 답변합니다.

【기본 규칙】
- 항상 정중하고 친근한 존댓말 사용
- 의학적 진단이나 처방은 하지 않음. "~로 보입니다", "~가 일반적입니다" 등 제안형으로 답변
- 참고자료(RAG)에 근거하여 답변하고, 근거가 없으면 "내원 상담 시 자세히 안내드리겠습니다"로 안내
- 비용 질문 시 참고자료에 정보가 있으면 대략적인 목안으로 제시, 없으면 "상담 시 안내드리겠습니다"
- 답변은 간결하게. 한 번의 답변은 3~5문장 정도
- 질문이 모호하면 구체적으로 되물어보기
- 대화 흐름을 자연스럽게 유지

【금지사항】
- 특정 병원명 추천 (ARUMI 플랫폼 경유 안내만 가능)
- 단정적인 의학적 판단 ("~입니다", "~해야 합니다" 사용 금지)
- 다른 미용 플랫폼이나 서비스로의 유도
"""

GREETING_JA = (
    "こんにちは！ARUMIの美容医療コンサルタントです。\n\n"
    "ご相談内容をもとに、あなただけの分析リポートを作成し、メールでお届けいたします。\n"
    "治療や施術について、どんなことでもお気軽にご質問ください！"
)

GREETING_KO = (
    "안녕하세요! ARUMI의 미용 의료 전문 상담사입니다.\n\n"
    "상담 내용을 바탕으로 맞춤 분석 리포트를 작성하여 메일로 보내드립니다.\n"
    "치료와 시술에 대해 무엇이든 편하게 물어보세요!"
)


def get_greeting(language: str = "ja") -> str:
    """언어별 초기 인사말 반환"""
    if language == "ko":
        return GREETING_KO
    return GREETING_JA


def _get_system_prompt(language: str = "ja") -> str:
    """언어별 시스템 프롬프트 반환"""
    if language == "ko":
        return SYSTEM_PROMPT_KO
    return SYSTEM_PROMPT_JA


async def extract_keywords_from_messages(
    messages: list[dict], language: str = "ja"
) -> list[str]:
    """최근 사용자 메시지에서 RAG 검색용 키워드를 추출"""
    # 사용자 메시지만 추출 (최근 5개)
    user_texts = [
        m["content"] for m in messages if m["role"] == "user"
    ][-5:]

    if not user_texts:
        return []

    combined = "\n".join(user_texts)

    prompt = f"""다음 사용자 메시지에서 미용 의료 상담과 관련된 핵심 키워드를 한국어로 추출해주세요.
시술명, 부위명, 증상, 고민 등을 포함합니다.

사용자 메시지:
{combined}

JSON 배열로 반환 (최대 8개):
예: ["코끝 성형", "자연스러운 코", "회복 기간"]
"""
    try:
        raw = await generate_json(prompt, model_name="gemini-2.5-flash-lite")
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(k) for k in data[:8]]
        return []
    except Exception as e:
        logger.warning(f"[ChatAgent] Keyword extraction failed: {e}")
        return []


async def detect_category_from_messages(
    messages: list[dict],
) -> str:
    """대화 내용에서 피부과/성형외과 분류를 감지"""
    user_texts = [
        m["content"] for m in messages if m["role"] == "user"
    ][-5:]

    if not user_texts:
        return "plastic_surgery"  # 기본값

    combined = "\n".join(user_texts)

    prompt = f"""다음 사용자 메시지를 분석하여 어떤 진료과에 해당하는지 판단해주세요.

사용자 메시지:
{combined}

반드시 다음 중 하나만 JSON으로 반환:
{{"category": "dermatology"}} 또는 {{"category": "plastic_surgery"}}

판단 기준:
- 피부과(dermatology): 여드름, 기미, 색소, 모공, 레이저, 하이푸, 울쎄라, 피부결, 주름개선, 탈모, 리쥬란, 스킨부스터
- 성형외과(plastic_surgery): 쌍꺼풀, 코 성형, 지방흡입, 안면윤곽, 리프팅, 가슴수술, 눈 재수술
- 경계 시술(보톡스, 필러)은 맥락으로 판단. 확실치 않으면 plastic_surgery
"""
    try:
        raw = await generate_json(prompt, model_name="gemini-2.5-flash-lite")
        data = json.loads(raw)
        cat = data.get("category", "plastic_surgery")
        if cat in ("dermatology", "plastic_surgery"):
            return cat
        return "plastic_surgery"
    except Exception as e:
        logger.warning(f"[ChatAgent] Category detection failed: {e}")
        return "plastic_surgery"


async def generate_chat_response(
    messages: list[dict],
    rag_results: list[dict],
    language: str = "ja",
) -> str:
    """대화 이력 + RAG 결과를 바탕으로 AI 응답 생성"""
    system_prompt = _get_system_prompt(language)

    # RAG 컨텍스트 구성
    rag_context = ""
    if rag_results:
        rag_lines = []
        for i, faq in enumerate(rag_results, 1):
            q = faq.get("question", "")
            a = faq.get("answer", "")
            proc = faq.get("procedure_name", "")
            rag_lines.append(f"[참고{i}] 시술: {proc}\nQ: {q}\nA: {a}")
        rag_context = "\n\n".join(rag_lines)

    # 대화 이력 구성 (최근 20개)
    recent = messages[-20:]
    history_lines = []
    for m in recent:
        role_label = "ユーザー" if language == "ja" else "사용자"
        if m["role"] == "assistant":
            role_label = "アシスタント" if language == "ja" else "상담사"
        history_lines.append(f"{role_label}: {m['content']}")
    history_text = "\n".join(history_lines)

    # 최종 프롬프트
    if language == "ja":
        prompt = f"""以下の参考資料と会話履歴をもとに、ユーザーの最新のメッセージに回答してください。

【参考資料】
{rag_context if rag_context else "（該当する参考資料なし）"}

【会話履歴】
{history_text}

上記の会話に対して、アシスタントとして自然に返答してください。
参考資料に関連する情報がある場合はそれを活用し、ない場合は「ご来院時に詳しくご案内いたします」と伝えてください。
"""
    else:
        prompt = f"""아래 참고자료와 대화 이력을 바탕으로 사용자의 최신 메시지에 답변해주세요.

【참고자료】
{rag_context if rag_context else "(해당 참고자료 없음)"}

【대화 이력】
{history_text}

위 대화에 대해 상담사로서 자연스럽게 답변해주세요.
참고자료에 관련 정보가 있으면 활용하고, 없으면 "내원 상담 시 자세히 안내드리겠습니다"라고 안내해주세요.
"""

    response = await generate_text(prompt, system_instruction=system_prompt)
    return response.strip()


async def run_chat_rag(
    messages: list[dict],
    language: str = "ja",
) -> tuple[str, list[dict]]:
    """키워드 추출 → RAG 검색 → 응답 생성의 전체 흐름.
    Returns: (response_text, rag_references)
    """
    # 1. 키워드 추출
    keywords = await extract_keywords_from_messages(messages, language)
    logger.info(f"[ChatAgent] Extracted keywords: {keywords}")

    # 2. 카테고리 감지
    category = await detect_category_from_messages(messages)
    logger.info(f"[ChatAgent] Detected category: {category}")

    # 3. RAG 검색
    # 최신 사용자 메시지 추출 (포커스 검색용)
    latest_user_msg = ""
    for m in reversed(messages):
        if m["role"] == "user":
            latest_user_msg = m["content"]
            break

    rag_results = []
    if keywords:
        try:
            rag_results = await search_relevant_faq(
                keywords, category, match_threshold=0.55, match_count=8,
                latest_message=latest_user_msg,
            )
            logger.info(
                f"[ChatAgent] RAG results: {len(rag_results)} "
                f"(keywords={keywords}, category={category})"
            )
            for i, faq in enumerate(rag_results):
                logger.info(
                    f"  RAG[{i}] sim={faq.get('similarity', 0):.3f} "
                    f"proc={faq.get('procedure_name', 'N/A')} "
                    f"q={faq.get('question', '')[:60]}"
                )
        except Exception as e:
            logger.warning(f"[ChatAgent] RAG search failed: {e}")

    # 4. 응답 생성
    response_text = await generate_chat_response(messages, rag_results, language)

    # RAG 참조 정보 정리 (프론트엔드용 — youtube_url 포함)
    rag_references = []
    for faq in rag_results:
        ref = {
            "faq_id": faq.get("id", ""),
            "question": faq.get("question", ""),
            "answer": faq.get("answer", ""),
            "procedure_name": faq.get("procedure_name", ""),
            "similarity": faq.get("similarity", 0),
            "source_type": faq.get("source_type", "youtube"),
        }
        # YouTube URL 포함 (프론트엔드 유튜브 패널용)
        yt_url = faq.get("youtube_url", "")
        if yt_url and "youtube.com" in yt_url:
            ref["youtube_url"] = yt_url
            ref["youtube_title"] = faq.get("youtube_title", "")
        rag_references.append(ref)

    return response_text, rag_references
