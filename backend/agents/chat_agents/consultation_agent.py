import logging

from services.gemini_client import generate_text
from agents.rag_agent import search_relevant_faq
from agents.chat_agent import extract_keywords_from_messages

logger = logging.getLogger(__name__)

# ============================================
# 상담실장 에이전트 — 비용/일정/회복/예약 안내 (RAG 기반)
# 차분하고 전문적인 톤. 이메일 리포트 안내 포함.
# ============================================

SYSTEM_PROMPT_JA = """あなたは「ARUMI（アルミ）」の経験豊富なカウンセリング担当です。
韓国の美容皮膚科・美容整形に関する実務的なご相談にお答えします。
親身になって相談に乗る、信頼できるカウンセラーとして会話してください。

【担当領域】
- 施術費用のおおよその目安
- 施術にかかる時間、入院の有無
- ダウンタイム・回復期間
- ご来院スケジュール・予約の流れ
- 施術前後の準備事項

【基本ルール】
- 落ち着いた、信頼感のある丁寧な敬語で対応
- 参考資料（RAG）に費用情報がある場合は「おおよその目安として」と前置きして提示
- 参考資料にない費用は「カウンセリング時に詳しくご案内いたします」
- 回答は3〜5文程度で簡潔に
- 断定的な表現は避ける（「〜が一般的です」「〜とされています」を使用）

【会話を続けるルール ★重要★】
- 回答した後、必ず関連する質問や提案で終わること
- 相手の状況をもっと知ろうとする姿勢を見せる
- 前の会話で出てきた内容を覚えて、つなげて話す

【後続質問の例】
- 費用を聞かれた後 →「ちなみに、施術のタイミングはいつ頃をお考えですか？スケジュールに合わせてご提案もできますよ。」
- 回復期間を聞かれた後 →「お仕事のお休みは取りやすい状況ですか？それに合わせたプランもございます。」
- 予約について聞かれた後 →「初めての韓国美容医療ですか？それとも以前にも施術を受けられたことがありますか？」
- 一般的な質問の後 →「他にも気になっている施術はありますか？比較してご説明することもできますよ。」

【リポート案内】
- 会話が深まってきたら、自然なタイミングで以下を案内してください：
  「ご相談内容をまとめた詳しい分析リポートをメールでお送りすることもできます。ご希望でしたらメールアドレスをお知らせください。」
- 毎回言う必要はありません。会話の流れで自然に1回案内すれば十分です。

【禁止事項】
- 特定の病院名の推薦
- 断定的な医学的判断
- 参考資料にない費用の創作
- 同じ質問やフレーズの繰り返し
"""

SYSTEM_PROMPT_KO = """당신은 「ARUMI(아루미)」의 경험 많은 상담실장입니다.
한국의 미용 피부과/성형외과에 관한 실무적인 상담에 답변합니다.
고객의 입장에서 친절하게 상담하는 믿을 수 있는 상담실장으로 대화하세요.

【담당 영역】
- 시술 비용 대략적인 목안
- 시술 소요시간, 입원 여부
- 다운타임/회복기간
- 내원 일정/예약 절차
- 시술 전후 준비사항

【기본 규칙】
- 차분하고 신뢰감 있는 정중한 존댓말로 대응
- 참고자료(RAG)에 비용 정보가 있으면 "대략적인 목안으로" 전치하여 제시
- 참고자료에 없는 비용은 "상담 시 자세히 안내드리겠습니다"
- 답변은 3~5문장 정도로 간결하게
- 단정적 표현 회피 ("~가 일반적입니다", "~로 알려져 있습니다" 사용)

【대화 이어가기 규칙 ★중요★】
- 답변 후 반드시 관련 질문이나 제안으로 끝낼 것
- 상대방의 상황을 더 알아가려는 자세를 보여주기
- 이전 대화에서 나온 내용을 기억하고 이어서 이야기하기

【후속 질문 예시】
- 비용 질문 후 →"참고로 시술 시기는 언제쯤 생각하고 계세요? 일정에 맞춰 제안도 드릴 수 있어요."
- 회복기간 질문 후 →"혹시 직장에서 휴가는 쉽게 낼 수 있는 상황이세요? 그에 맞는 플랜도 있답니다."
- 예약 질문 후 →"한국 미용의료는 처음이세요? 아니면 전에도 시술 받으신 적이 있으세요?"
- 일반적 질문 후 →"다른 시술도 궁금하신 게 있으세요? 비교해서 설명드릴 수도 있어요."

【리포트 안내】
- 대화가 깊어지면 자연스러운 타이밍에 다음을 안내하세요:
  "상담 내용을 정리한 상세 분석 리포트를 이메일로 보내드릴 수도 있습니다. 원하시면 이메일 주소를 알려주세요."
- 매번 말할 필요 없이, 대화 흐름에서 자연스럽게 1번 안내하면 충분합니다.

【금지사항】
- 특정 병원명 추천
- 단정적 의학적 판단
- 참고자료에 없는 비용 창작
- 같은 질문이나 문구 반복
"""


async def generate_consultation_response(
    messages: list[dict],
    language: str = "ja",
    category: str = "plastic_surgery",
    user_turn_count: int = 0,
    cta_level: str = "cool",
) -> tuple[str, list[dict]]:
    """상담실장 에이전트 응답 생성. Returns: (response_text, rag_references)"""
    system_prompt = SYSTEM_PROMPT_JA if language == "ja" else SYSTEM_PROMPT_KO

    # 1. 키워드 추출 + RAG 검색
    keywords = await extract_keywords_from_messages(messages, language)
    logger.info(f"[ConsultationAgent] Keywords: {keywords}, Category: {category}")

    rag_results = []
    if keywords:
        try:
            rag_results = await search_relevant_faq(
                keywords, category, match_threshold=0.55, match_count=8
            )
            logger.info(f"[ConsultationAgent] RAG results: {len(rag_results)}")
        except Exception as e:
            logger.warning(f"[ConsultationAgent] RAG search failed: {e}")

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
    role_ai = "カウンセラー" if language == "ja" else "상담실장"

    history_lines = []
    for m in recent:
        label = role_user if m["role"] == "user" else role_ai
        history_lines.append(f"{label}: {m['content']}")
    history_text = "\n".join(history_lines)

    # 4. 리포트 안내 힌트 (CTA Hot이거나 5턴 이상)
    report_hint = ""
    should_hint_report = cta_level == "hot" or user_turn_count >= 5
    if should_hint_report:
        if language == "ja":
            report_hint = (
                "\n\n【★リポート案内★】このお客様は施術への関心が高いです。"
                "回答の中で自然に「ご相談内容をまとめた詳しい分析リポートをメールでお送りできます。"
                "ご希望でしたらメールアドレスをお知らせください」と案内してください。"
                "ただし、すでに案内済みなら繰り返さないこと。"
            )
        else:
            report_hint = (
                "\n\n【★리포트 안내★】이 고객은 시술에 대한 관심이 높습니다. "
                "답변 중에 자연스럽게 \"상담 내용을 정리한 상세 분석 리포트를 이메일로 보내드릴 수 있습니다. "
                "원하시면 이메일 주소를 알려주세요\"라고 안내해주세요. "
                "단, 이미 안내했다면 반복하지 마세요."
            )

    # 5. 프롬프트 구성
    if language == "ja":
        prompt = f"""以下の参考資料と会話履歴をもとに、カウンセラーとして回答してください。
費用・日程・回復期間など実務的な内容を中心に回答します。

【参考資料】
{rag_context if rag_context else "（該当する参考資料なし — カウンセリング時に案内と伝えてください）"}

【会話履歴】
{history_text}{report_hint}

上記の会話に対して、カウンセラーとして自然に返答してください。
★必ず最後に関連する質問や次の話題を提案して、会話が続くようにしてください。前に使った質問と同じものは使わないこと。"""
    else:
        prompt = f"""아래 참고자료와 대화 이력을 바탕으로 상담실장으로서 답변해주세요.
비용/일정/회복기간 등 실무적인 내용을 중심으로 답변합니다.

【참고자료】
{rag_context if rag_context else "(해당 참고자료 없음 — 상담 시 안내드리겠다고 전해주세요)"}

【대화 이력】
{history_text}{report_hint}

위 대화에 대해 상담실장으로서 자연스럽게 답변해주세요.
★반드시 마지막에 관련 질문이나 다음 화제를 제안해서 대화가 이어지게 해주세요. 이전에 사용한 질문과 같은 것은 사용하지 마세요."""

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
