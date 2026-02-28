import logging

from services.gemini_client import generate_text
from agents.rag_agent import search_relevant_faq
from agents.chat_agent import extract_keywords_from_messages

logger = logging.getLogger(__name__)

# ============================================
# 치료전문 에이전트 — 시술방법/부작용/효과 상세 설명 (RAG 기반)
# 의학 지식 기반의 신뢰감 있는 톤. 제안형 어투.
# ============================================

SYSTEM_PROMPT_JA = """あなたは「ARUMI（アルミ）」の美容医療専門コンサルタントです。
韓国の美容皮膚科・美容整形の施術に関する医学的なご質問にお答えします。

【担当領域】
- 施術の方法・原理
- 施術の効果・期待できる結果
- 副作用・リスク
- 施術間の比較（メリット・デメリット）
- 適応症・非適応症

【基本ルール】
- 参考資料（RAG）に基づいて正確に回答
- 提案型の表現を使用：「〜と考えられます」「〜が一般的です」「〜と報告されています」
- 参考資料にない情報は創作しない →「ご来院時に担当医から詳しくご説明いたします」
- 回答は3〜6文程度。必要に応じて箇条書きも使用
- 専門用語を使う場合はわかりやすく補足
- 医学的な診断・処方は絶対に行わない

【禁止事項】
- 断定的な医学的判断（「〜です」「〜しなければなりません」は使わない）
- 特定の病院名の推薦
- 参考資料にない医学情報の創作
- 過度に不安を煽る表現
"""

SYSTEM_PROMPT_KO = """당신은 「ARUMI(아루미)」의 미용의료 전문 상담원입니다.
한국의 미용 피부과/성형외과 시술에 관한 의학적 질문에 답변합니다.

【담당 영역】
- 시술 방법/원리
- 시술 효과/기대 결과
- 부작용/리스크
- 시술 간 비교 (장단점)
- 적응증/비적응증

【기본 규칙】
- 참고자료(RAG)에 근거하여 정확하게 답변
- 제안형 표현 사용: "~로 알려져 있습니다", "~가 일반적입니다", "~로 보고되어 있습니다"
- 참고자료에 없는 정보는 창작하지 않음 → "내원 시 담당 의사에게 자세히 상담받으실 수 있습니다"
- 답변은 3~6문장 정도. 필요 시 목록 형태도 활용
- 전문 용어 사용 시 알기 쉽게 보충 설명
- 의학적 진단/처방은 절대 하지 않음

【금지사항】
- 단정적 의학적 판단 ("~입니다", "~해야 합니다" 사용 금지)
- 특정 병원명 추천
- 참고자료에 없는 의학 정보 창작
- 과도하게 불안을 조장하는 표현
"""


async def generate_medical_response(
    messages: list[dict],
    language: str = "ja",
    category: str = "plastic_surgery",
) -> tuple[str, list[dict]]:
    """치료전문 에이전트 응답 생성. Returns: (response_text, rag_references)"""
    system_prompt = SYSTEM_PROMPT_JA if language == "ja" else SYSTEM_PROMPT_KO

    # 1. 키워드 추출 + RAG 검색
    keywords = await extract_keywords_from_messages(messages, language)
    logger.info(f"[MedicalAgent] Keywords: {keywords}, Category: {category}")

    rag_results = []
    if keywords:
        try:
            rag_results = await search_relevant_faq(
                keywords, category, match_threshold=0.55, match_count=8
            )
            logger.info(f"[MedicalAgent] RAG results: {len(rag_results)}")
        except Exception as e:
            logger.warning(f"[MedicalAgent] RAG search failed: {e}")

    # 2. RAG 컨텍스트 구성
    rag_context = ""
    if rag_results:
        rag_lines = []
        for i, faq in enumerate(rag_results, 1):
            q = faq.get("question", "")
            a = faq.get("answer", "")
            proc = faq.get("procedure_name", "")
            rag_lines.append(f"[참고{i}] 시술: {proc}\nQ: {q}\nA: {a}")
        rag_context = "\n\n".join(rag_lines)

    # 3. 대화 이력 구성
    recent = messages[-20:]
    role_user = "ユーザー" if language == "ja" else "사용자"
    role_ai = "専門コンサルタント" if language == "ja" else "전문 상담원"

    history_lines = []
    for m in recent:
        label = role_user if m["role"] == "user" else role_ai
        history_lines.append(f"{label}: {m['content']}")
    history_text = "\n".join(history_lines)

    # 4. 프롬프트 구성
    if language == "ja":
        prompt = f"""以下の参考資料と会話履歴をもとに、美容医療専門コンサルタントとして回答してください。
施術の方法・効果・副作用など医学的な内容を中心に回答します。

【参考資料】
{rag_context if rag_context else "（該当する参考資料なし — ご来院時に担当医からご説明と伝えてください）"}

【会話履歴】
{history_text}

上記の会話に対して、専門コンサルタントとして自然に返答してください。
参考資料に関連する情報がある場合はそれを活用してください。"""
    else:
        prompt = f"""아래 참고자료와 대화 이력을 바탕으로 미용의료 전문 상담원으로서 답변해주세요.
시술 방법/효과/부작용 등 의학적 내용을 중심으로 답변합니다.

【참고자료】
{rag_context if rag_context else "(해당 참고자료 없음 — 내원 시 담당 의사에게 상담받으실 수 있다고 전해주세요)"}

【대화 이력】
{history_text}

위 대화에 대해 전문 상담원으로서 자연스럽게 답변해주세요.
참고자료에 관련 정보가 있으면 활용해주세요."""

    response = await generate_text(prompt, system_instruction=system_prompt)

    # RAG 참조 정보 정리
    rag_references = _build_rag_references(rag_results)

    return response.strip(), rag_references


def _build_rag_references(rag_results: list[dict]) -> list[dict]:
    refs = []
    for faq in rag_results:
        ref = {
            "faq_id": faq.get("id", ""),
            "question": faq.get("question", ""),
            "answer": faq.get("answer", ""),
            "procedure_name": faq.get("procedure_name", ""),
            "similarity": faq.get("similarity", 0),
            "source_type": faq.get("source_type", "youtube"),
        }
        yt_url = faq.get("youtube_url", "") or ""
        if yt_url and "youtube.com" in yt_url:
            ref["youtube_url"] = yt_url
            ref["youtube_title"] = faq.get("youtube_title", "")
        refs.append(ref)
    return refs
