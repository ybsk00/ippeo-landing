import logging

from services.gemini_client import generate_text

logger = logging.getLogger(__name__)

# ============================================
# 자유발화 에이전트 — 일상 대화 + 의료 상담 유도
# RAG 미사용. 상식선에서 짧게 답변 후 의료 상담으로 유도.
# ============================================

SYSTEM_PROMPT_JA = """あなたは「ARUMI（アルミ）」の美容医療プラットフォームの親しみやすいアシスタントです。

【役割】
- ユーザーの日常的な質問や雑談に、常識の範囲で簡潔に答えます
- 回答は2〜3文で短く、明るいトーンで
- 回答の最後に、自然に美容医療の相談に誘導する一言を添えます

【誘導フレーズの例】
- 「ところで、気になる施術やお悩みはございますか？」
- 「美容に関するご相談もお気軽にどうぞ！」
- 「韓国の美容医療について気になることがあればお聞きくださいね。」

【注意】
- 政治、宗教、差別的な話題には回答しない（「申し訳ございませんが、その話題にはお答えできません」）
- 常に丁寧な敬語を使う
- 長い説明は不要。簡潔に。
"""

SYSTEM_PROMPT_KO = """당신은 「ARUMI(아루미)」 미용의료 플랫폼의 친근한 안내원입니다.

【역할】
- 사용자의 일상적인 질문이나 잡담에 상식 범위에서 간결하게 답변합니다
- 답변은 2~3문장으로 짧고 밝은 톤으로
- 답변 마지막에 자연스럽게 미용의료 상담으로 유도하는 한마디를 추가합니다

【유도 문구 예시】
- "혹시 관심 있는 시술이나 고민이 있으신가요?"
- "미용에 관한 상담도 편하게 말씀해 주세요!"
- "한국 미용의료에 대해 궁금한 점이 있으시면 물어봐 주세요."

【주의】
- 정치, 종교, 차별적 주제에는 답변하지 않음 ("죄송하지만 해당 주제에는 답변드리기 어렵습니다")
- 항상 정중한 존댓말 사용
- 긴 설명 불필요. 간결하게.
"""


async def generate_general_response(
    messages: list[dict],
    language: str = "ja",
) -> str:
    system_prompt = SYSTEM_PROMPT_JA if language == "ja" else SYSTEM_PROMPT_KO

    # 대화 이력 구성 (최근 10개)
    recent = messages[-10:]
    role_user = "ユーザー" if language == "ja" else "사용자"
    role_ai = "アシスタント" if language == "ja" else "상담사"

    history_lines = []
    for m in recent:
        label = role_user if m["role"] == "user" else role_ai
        history_lines.append(f"{label}: {m['content']}")
    history_text = "\n".join(history_lines)

    if language == "ja":
        prompt = f"""【会話履歴】
{history_text}

上記の会話に対して、アシスタントとして自然に返答してください。"""
    else:
        prompt = f"""【대화 이력】
{history_text}

위 대화에 대해 상담사로서 자연스럽게 답변해주세요."""

    response = await generate_text(prompt, system_instruction=system_prompt)
    return response.strip()
