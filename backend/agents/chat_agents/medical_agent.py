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
患者さんの不安に寄り添いながら、わかりやすく丁寧に説明してください。

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
- ★★★回答は必ず400文字以内★★★（これは絶対に守ること。400文字を超える回答は禁止）
- 共感1文＋核心2〜3文＋後続質問1文の構成。それ以上は不要
- 参考資料の番号（参考1等）は省略する
- 専門用語を使う場合はわかりやすく補足
- 医学的な診断・処方は絶対に行わない

【会話を続けるルール ★重要★】
- 説明した後、必ず関連する質問や話題の提案で終わること
- 相手がまだ気づいていない関連情報を提供して興味を引く
- 「他にも気になる点はありますか？」だけで終わらない。具体的な次の話題を提案する

【後続質問・話題提案の例】
- 施術方法を説明した後 →「ダウンタイムや回復期間についても気になりますか？実際の経過についてもご説明できますよ。」
- 副作用を説明した後 →「ちなみに、この施術と似た効果が期待できる別の方法もあります。比較してみましょうか？」
- 効果を説明した後 →「効果の持続期間や、施術後のケアについてもお伝えしましょうか？」
- 比較を説明した後 →「ご自身の状況に合わせたおすすめの組み合わせもあります。現在のお悩みをもう少し詳しくお聞かせいただけますか？」

【禁止事項】
- 断定的な医学的判断（「〜です」「〜しなければなりません」は使わない）
- 特定の病院名の推薦
- 参考資料にない医学情報の創作
- 過度に不安を煽る表現
- 同じ質問やフレーズの繰り返し
- マークダウン記法は絶対に使わない（**太字**、*斜体*、#見出し、- リスト等は禁止）。強調したい場合は「」や（）を使用
"""

SYSTEM_PROMPT_KO = """당신은 「ARUMI(아루미)」의 미용의료 전문 상담원입니다.
한국의 미용 피부과/성형외과 시술에 관한 의학적 질문에 답변합니다.
환자의 불안에 공감하면서 알기 쉽고 친절하게 설명해주세요.

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
- 답변은 400자 이내 (리포트 안내 포함). 공감+핵심정보+후속질문 구성으로 간결하게. 참고자료 번호는 생략
- 전문 용어 사용 시 알기 쉽게 보충 설명
- 의학적 진단/처방은 절대 하지 않음

【대화 이어가기 규칙 ★중요★】
- 설명 후 반드시 관련 질문이나 화제 제안으로 끝낼 것
- 상대방이 아직 모르는 관련 정보를 제공해서 흥미를 유발
- "다른 궁금한 점 있으세요?"만으로 끝내지 않기. 구체적인 다음 화제를 제안할 것

【후속 질문/화제 제안 예시】
- 시술 방법 설명 후 →"다운타임이나 회복 과정도 궁금하세요? 실제 경과에 대해서도 설명드릴 수 있어요."
- 부작용 설명 후 →"참고로 비슷한 효과를 기대할 수 있는 다른 시술 방법도 있어요. 비교해 볼까요?"
- 효과 설명 후 →"효과 지속 기간이나 시술 후 관리법도 알려드릴까요?"
- 비교 설명 후 →"본인 상황에 맞는 조합 추천도 가능해요. 현재 고민을 좀 더 자세히 말씀해 주시겠어요?"

【금지사항】
- 단정적 의학적 판단 ("~입니다", "~해야 합니다" 사용 금지)
- 특정 병원명 추천
- 참고자료에 없는 의학 정보 창작
- 과도하게 불안을 조장하는 표현
- 같은 질문이나 문구 반복
- 마크다운 표기 절대 금지 (**굵게**, *기울임*, # 제목, - 목록 등 사용 금지). 강조할 때는 「」나 ()를 사용
"""


async def generate_medical_response(
    messages: list[dict],
    language: str = "ja",
    category: str = "plastic_surgery",
    cta_level: str = "cool",
    pre_extracted_keywords: list[str] | None = None,
) -> tuple[str, list[dict]]:
    """치료전문 에이전트 응답 생성. Returns: (response_text, rag_references)"""
    system_prompt = SYSTEM_PROMPT_JA if language == "ja" else SYSTEM_PROMPT_KO

    # 1. 키워드: 미리 추출된 것이 있으면 재사용, 없으면 직접 추출
    if pre_extracted_keywords is not None:
        keywords = pre_extracted_keywords
    else:
        keywords = await extract_keywords_from_messages(messages, language)
    logger.info(f"[MedicalAgent] Keywords: {keywords}, Category: {category}")

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
    role_ai = "専門コンサルタント" if language == "ja" else "전문상담"

    history_lines = []
    for m in recent:
        label = role_user if m["role"] == "user" else role_ai
        history_lines.append(f"{label}: {m['content']}")
    history_text = "\n".join(history_lines)

    # 4. CTA 기반 리포트 안내 힌트
    report_hint = ""
    if cta_level in ("hot", "warm"):
        if language == "ja":
            report_hint = (
                "\n\n【★リポート案内★】このお客様は施術への関心が非常に高いです。"
                "回答の中で自然に「ここまでのご相談内容をまとめた詳しい分析リポートを"
                "メールでお送りできます。ご希望でしたらメールアドレスをお知らせください」"
                "と案内してください。ただし、すでに案内済みなら繰り返さないこと。"
            )
        else:
            report_hint = (
                "\n\n【★리포트 안내★】이 고객은 시술에 대한 관심이 매우 높습니다. "
                "답변 중에 자연스럽게 \"지금까지 상담 내용을 정리한 상세 분석 리포트를 "
                "이메일로 보내드릴 수 있습니다. 원하시면 이메일 주소를 알려주세요\"라고 "
                "안내해주세요. 단, 이미 안내했다면 반복하지 마세요."
            )

    # 5. 프롬프트 구성
    if language == "ja":
        prompt = f"""以下の参考資料と会話履歴をもとに、美容医療専門コンサルタントとして回答してください。
施術の方法・効果・副作用など医学的な内容を中心に回答します。

【参考資料】
{rag_context if rag_context else "（該当する参考資料なし — ご来院時に担当医からご説明と伝えてください）"}

【会話履歴】
{history_text}{report_hint}

上記の会話に対して、専門コンサルタントとして自然に返答してください。
★回答は必ず400文字以内にすること。長い説明は不要。共感1文＋核心2文＋後続質問1文で十分。
★参考資料の中にユーザーの質問と無関係な施術が含まれている場合は無視すること。
★最後に関連する質問を1つ入れること。"""
    else:
        prompt = f"""아래 참고자료와 대화 이력을 바탕으로 미용의료 전문 상담원으로서 답변해주세요.
시술 방법/효과/부작용 등 의학적 내용을 중심으로 답변합니다.

【참고자료】
{rag_context if rag_context else "(해당 참고자료 없음 — 내원 시 담당 의사에게 상담받으실 수 있다고 전해주세요)"}

【대화 이력】
{history_text}{report_hint}

위 대화에 대해 전문 상담원으로서 자연스럽게 답변해주세요.
★답변은 반드시 400자 이내. 긴 설명 불필요. 공감1문+핵심2문+후속질문1문이면 충분.
★무관한 참고자료는 무시할 것.
★마지막에 관련 질문 1개 넣을 것."""

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
