"""
음성 전용 경량 챗봇 에이전트.
기존 multi-agent pipeline (3 LLM calls) 대비 1 LLM call로 응답 생성.
목표: 챗봇 응답 p95 < 2초
"""

import asyncio
import logging

from services.gemini_client import generate_text, get_query_embedding
from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# 단일 시스템 프롬프트 (라우팅 + 응답 통합)
SYSTEM_JA = """あなたは「ARUMI（アルミ）」の韓国美容医療コンサルタントです。
ユーザーの音声メッセージに簡潔に回答します。

【基本ルール】
- 回答は2〜4文。簡潔にすること（音声読み上げのため）
- 提案型表現のみ使用：「〜と考えられます」「〜が一般的です」
- 参考資料に基づいて回答。ない場合は「ご来院時にご案内いたします」
- 医学的な診断・処方は行わない
- 最後に簡潔な質問で会話を続ける
- マークダウン記法（**太字**、*斜体*、# 見出し、- リスト）は絶対に使わない
- 括弧（）や「」で強調する"""

SYSTEM_KO = """당신은 「ARUMI(아루미)」의 한국 미용의료 전문 상담원입니다.
사용자의 음성 메시지에 간결하게 답변합니다.

【기본 규칙】
- 답변은 2~4문장. 간결하게 (음성 읽기용)
- 제안형 표현만 사용: "~로 보입니다", "~가 일반적입니다"
- 참고자료에 기반하여 답변. 없으면 "내원 상담 시 안내드리겠습니다"
- 의학적 진단/처방 금지
- 마지막에 간결한 질문으로 대화 이어가기
- 마크다운 기법 절대 금지"""


async def run_voice_chat(
    messages: list[dict],
    language: str = "ja",
) -> dict:
    """음성 전용 경량 응답 생성.
    1회 LLM 호출만 수행. RAG는 최신 메시지 직접 임베딩으로 검색.
    Returns: {"response": str, "rag_references": list, "agent_type": str}
    """
    # 최신 사용자 메시지
    latest_msg = ""
    for m in reversed(messages):
        if m["role"] == "user":
            latest_msg = m["content"]
            break

    if not latest_msg:
        greeting = (
            "こんにちは！韓国美容医療についてご質問がありましたら、お気軽にどうぞ。"
            if language == "ja"
            else "안녕하세요! 한국 미용의료에 대해 궁금한 점이 있으시면 편하게 말씀해 주세요."
        )
        return {"response": greeting, "rag_references": [], "agent_type": "greeting"}

    # RAG 검색과 대화 이력 구성을 병렬로
    rag_task = _quick_rag_search(latest_msg)

    # 대화 이력 (최근 6개만, 간결하게)
    recent = messages[-6:]
    history_lines = []
    for m in recent:
        role = "User" if m["role"] == "user" else "AI"
        # 각 메시지 최대 100자
        text = m["content"][:100]
        history_lines.append(f"{role}: {text}")
    history_text = "\n".join(history_lines)

    rag_results = await rag_task

    # RAG 컨텍스트 (최대 3개, 간결하게)
    rag_context = ""
    if rag_results:
        lines = []
        for i, faq in enumerate(rag_results[:3], 1):
            q = faq.get("question", "")[:60]
            a = faq.get("answer", "")[:120]
            lines.append(f"[{i}] Q:{q} A:{a}")
        rag_context = "\n".join(lines)

    system = SYSTEM_JA if language == "ja" else SYSTEM_KO

    if language == "ja":
        prompt = f"""【参考資料】
{rag_context or "（なし）"}

【会話】
{history_text}

上記に対して簡潔に返答してください。"""
    else:
        prompt = f"""【참고자료】
{rag_context or "(없음)"}

【대화】
{history_text}

위에 대해 간결하게 답변해주세요."""

    try:
        response = await generate_text(prompt, system_instruction=system)
        response = response.strip()
    except Exception as e:
        logger.error(f"[VoiceChat] LLM failed: {e}")
        response = (
            "申し訳ございません。もう一度お試しください。"
            if language == "ja"
            else "죄송합니다. 다시 시도해 주세요."
        )

    # RAG references
    refs = []
    for faq in (rag_results or []):
        ref = {
            "faq_id": faq.get("id", ""),
            "question": faq.get("question", ""),
            "answer": faq.get("answer", ""),
            "procedure_name": faq.get("procedure_name", ""),
            "similarity": faq.get("similarity", 0),
        }
        yt = faq.get("youtube_url", "") or ""
        if yt and "youtube.com" in yt:
            ref["youtube_url"] = yt
        refs.append(ref)

    return {
        "response": response,
        "rag_references": refs,
        "agent_type": "medical",
    }


async def _quick_rag_search(message: str) -> list[dict]:
    """메시지 직접 임베딩으로 RAG 검색 (키워드 추출 LLM 호출 생략)."""
    try:
        embedding = await get_query_embedding(message)
        db = get_supabase()

        # 두 카테고리 모두 검색 (라우팅 없이)
        derm_task = asyncio.to_thread(
            lambda: db.rpc("search_faq", {
                "query_embedding": embedding,
                "target_category": "dermatology",
                "match_threshold": 0.60,
                "match_count": 3,
            }).execute()
        )
        plast_task = asyncio.to_thread(
            lambda: db.rpc("search_faq", {
                "query_embedding": embedding,
                "target_category": "plastic_surgery",
                "match_threshold": 0.60,
                "match_count": 3,
            }).execute()
        )

        derm_result, plast_result = await asyncio.gather(derm_task, plast_task)

        all_results = (derm_result.data or []) + (plast_result.data or [])
        # 유사도 순 정렬, 상위 3개
        all_results.sort(key=lambda x: x.get("similarity", 0), reverse=True)
        return all_results[:3]
    except Exception as e:
        logger.warning(f"[VoiceChat] RAG search failed: {e}")
        return []
