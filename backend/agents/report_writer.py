import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from services.gemini_client import generate_json, safe_parse_json

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """あなたは医療コンサルティングリポートの専門ライターです。
日本語で簡潔かつ中立的なリポートを作成してください。

トーン＆マナー:
- 中立的・整理型の語調を使用する
- 「〜です」「〜と判断されます」「〜が推奨されます」など簡潔な表現
- 感情的・過度に温かい表現は使用しない（「ご安心ください」「一緒に見つけましょう」等はNG）
- 各項目は1〜2文以内で簡潔に記述する
- セクション間で内容の重複・繰り返しを絶対に避ける
- 価格・費用情報: 相談中に具体的な金額が言及された場合のみ、その内容をそのまま記載する。言及がなければ費用セクションを空にする。絶対にAIが費用を推測・創作してはならない。

医療情報の原則:
- カウンセラー/医師が相談で実際に言及した内容のみを記載する
- 相談で言及されていない医療情報は記載しない（信頼低下の原因）
- 医師の発言に反する内容は絶対に記載しない
- RAG資料は内容検証用として参照するが、リポートに直接引用しない
- PubMed論文の詳細引用（citation）は不要

リポート構成（9セクション）:
1. ご相談の要点 — 核心的な悩み・希望・懸念をブレットポイントのみで整理（4項目以内）
2. 現在の状態と原因 — 悩みの原因を簡潔に分析（導入1文 + 原因リスト + 結論1文）
3. ご提案（Recommended Plan）— 1次推奨 + 必要時併用の構造で提案を先に、根拠を後に
4. 予想回復スケジュール — 簡潔なタイムライン表 + 補足（相談で言及があればそれを優先。なければ該当施術の一般的な回復スケジュールを記載）
5. 傷跡について — ブレットポイント（3項目以内）
6. 施術前の注意事項 — ブレットポイント（3項目以内）
7. リスクまとめ — ブレットポイント（4項目以内）
8. 予想費用範囲 — 相談中に言及された金額のみ記載（言及なければ空配列）。AIが金額を創作してはならない
9. ご来院予定日 — 相談で言及された日付。なければ「未定」と記載
10. ARUMIからの一言 + 最終整理 — 行動誘導型CTA（5つの心理要素を含む）"""

SYSTEM_INSTRUCTION_KO = """당신은 의료 컨설팅 리포트 전문 작성자입니다.
한국어로 간결하고 중립적인 리포트를 작성해주세요.

톤&매너:
- 중립적·정리형 어조를 사용한다
- "~입니다", "~로 판단됩니다", "~가 권장됩니다" 등 간결한 표현
- 감정적·과도하게 따뜻한 표현은 사용하지 않는다 ("안심하세요", "함께 찾아보겠습니다" 등은 NG)
- 각 항목은 1~2문장 이내로 간결하게 기술한다
- 섹션 간 내용의 중복·반복을 절대 피한다
- 가격·비용 정보: 상담 중 구체적인 금액이 언급된 경우에만 그 내용을 그대로 기재한다. 언급이 없으면 비용 섹션을 비운다. 절대로 AI가 비용을 추측·창작해서는 안 된다.

의료 정보 원칙:
- 상담사/의사가 상담에서 실제로 언급한 내용만 기재한다
- 상담에서 언급되지 않은 의료 정보는 기재하지 않는다 (신뢰 저하의 원인)
- 의사의 발언에 반하는 내용은 절대 기재하지 않는다
- RAG 자료는 내용 검증용으로 참조하되 리포트에 직접 인용하지 않는다
- PubMed 논문의 상세 인용(citation)은 불필요

리포트 구성 (10섹션):
1. 상담 요점 — 핵심 고민·희망·우려를 불릿포인트로 정리 (4항목 이내)
2. 현재 상태와 원인 — 고민의 원인을 간결하게 분석 (도입1문 + 원인 리스트 + 결론1문)
3. 제안 (Recommended Plan) — 1차 권장 + 필요 시 병행의 구조로 제안을 먼저, 근거를 나중에
4. 예상 회복 스케줄 — 간결한 타임라인 표 + 보충 (상담에서 언급이 있으면 우선. 없으면 해당 시술의 일반적인 회복 스케줄 기재)
5. 흉터에 대해 — 불릿포인트 (3항목 이내)
6. 시술 전 주의사항 — 불릿포인트 (3항목 이내)
7. 리스크 정리 — 불릿포인트 (4항목 이내)
8. 예상 비용 범위 — 상담 중 언급된 금액만 기재 (언급 없으면 빈 배열). AI가 금액을 창작해서는 안 된다
9. 내원 예정일 — 상담에서 언급된 날짜. 없으면 "미정"으로 기재
10. ARUMI의 한마디 + 최종 정리 — 행동 유도형 CTA (5가지 심리 요소 포함)"""


async def write_report(
    original_text: str,
    translated_text: str,
    intent_extraction: dict,
    classification: str,
    rag_results: list[dict],
    customer_name: str,
    admin_direction: str | None = None,
    input_lang: str = "ja",
    hospital_mentions: list[dict] | None = None,
) -> dict:
    is_korean = input_lang == "ko"

    # RAG 컨텍스트를 정리 (내용 검증용)
    rag_context = ""
    if rag_results:
        for i, faq in enumerate(rag_results, 1):
            label = f"참고자료 {i}" if is_korean else f"参考資料 {i}"
            rag_context += f"\n【{label}】\nQ: {faq.get('question', '')}\nA: {faq.get('answer', '')}\n시술명: {faq.get('procedure_name', '')}\n"

    if not rag_context:
        rag_context = "※참고자료 없음. 상담 내용만을 기반으로 작성해주세요." if is_korean else "※参考資料なし。相談内容のみに基づいて作成してください。"

    category_note = ""
    if classification == "plastic_surgery":
        category_note = "성형외과 상담입니다. 구조적 접근법 중심으로 기술해주세요." if is_korean else "整形外科の相談です。構造的なアプローチを中心に記述してください。"
    else:
        category_note = "피부과 상담입니다. 치료 프로토콜 중심으로 기술해주세요." if is_korean else "皮膚科の相談です。治療プロトコルを中心に記述してください。"

    # 병원 비교 정보 섹션 (있을 때만)
    hospital_section = ""
    if hospital_mentions:
        hospital_section = "\n== 상담에서 언급된 병원·클리닉 정보 ==\n" if is_korean else "\n== 相談で言及された病院・クリニック情報 ==\n"
        for i, h in enumerate(hospital_mentions, 1):
            unknown = "불명" if is_korean else "不明"
            hospital_section += f"\n【병원{i}】{h.get('name', unknown)}\n" if is_korean else f"\n【病院{i}】{h.get('name', unknown)}\n"
            if h.get("procedures"):
                hospital_section += f"  시술: {', '.join(h['procedures'])}\n"
            if h.get("advantages"):
                hospital_section += f"  특장점: {', '.join(h['advantages'])}\n"
            if h.get("price_info"):
                hospital_section += f"  비용: {h['price_info']}\n"
            if h.get("recovery_info"):
                hospital_section += f"  회복기간: {h['recovery_info']}\n"
            if h.get("other_details"):
                hospital_section += f"  기타: {h['other_details']}\n"

    # 관리자 재생성 지시 섹션 (있을 때만)
    admin_direction_section = ""
    if admin_direction:
        if is_korean:
            admin_direction_section = f"""
== 관리자 수정 지시 (최우선 반영) ==
{admin_direction}

위 관리자 지시를 최우선으로 반영해주세요.
"""
        else:
            admin_direction_section = f"""
== 管理者からの修正指示（最優先で反映すること）==
{admin_direction}

上記の管理者指示を最優先で反映してください。
"""

    # 고객명에서 성만 추출 (예: "田中 陽子" → "田中")
    name_parts = customer_name.split()
    display_name = name_parts[0] if name_parts else customer_name

    # 입력 언어에 따라 상담 원문 섹션 구성
    if is_korean:
        consultation_section = f"""== 한국어 원문 (상담 내용) ==
{original_text}"""
    elif input_lang == "ja":
        consultation_section = f"""== 日本語原文（相談内容）==
{original_text}

== 韓国語翻訳（意味確認用）==
{translated_text}"""
    else:
        consultation_section = f"""== 원문 (상담 내용) ==
{original_text}"""

    # 한국어/일본어 프롬프트 분기
    if is_korean:
        prompt = f"""아래 정보를 바탕으로 10섹션의 한국어 리포트를 JSON 형식으로 작성해주세요.
각 항목은 간결하게 1~2문장 이내로 기술하고, 섹션 간 중복을 배제해주세요.
상담사가 상담에서 실제로 언급한 내용만 기재해주세요.

== 분류 ==
{category_note}

== 고객명 ==
{display_name}님

{consultation_section}

== 의도 추출 결과 ==
{json.dumps(intent_extraction, ensure_ascii=False)}

== 참고자료 (내용 검증용, 직접 인용하지 않음) ==
{rag_context}
{hospital_section}{admin_direction_section}
== 출력 JSON 형식 ==
{{
    "title": "{display_name}님 OO 상담 리포트",
    "date": "작성일: YYYY년 M월 D일",

    "section1_key_summary": {{
        "points": [
            "핵심 고민 (1문장으로 간결하게)",
            "희망하는 방향성 (1문장으로 간결하게)",
            "주요 우려사항 (1문장으로 간결하게)",
            "개선 가능성 요약 (1문장으로 간결하게)"
        ]
    }},

    "section2_cause_analysis": {{
        "intro": "고민의 원인을 요약하는 1문장 (예: OO가 △△해 보이는 원인은 다음과 같습니다.)",
        "causes": [
            "원인1 (간결하게 1문장)",
            "원인2 (간결하게 1문장)",
            "원인3 (간결하게 1문장)"
        ],
        "conclusion": "핵심 정리 1문장 (예: 단순한 XX가 아니라 YY가 포인트입니다.)"
    }},

    "section3_recommendation": {{
        "primary": {{
            "label": "1차 권장",
            "items": [
                "권장 시술·접근법1 (간결하게)",
                "권장2 (간결하게)",
                "권장3 (간결하게)"
            ]
        }},
        "secondary": {{
            "label": "필요 시 병행",
            "items": [
                "추가 시술1 (간결하게)"
            ]
        }},
        "goal": "목표 요약 1문장 (예: 자연스러우면서도 정돈된 인상을 목표로 합니다.)"
    }},

    "section4_recovery": {{
        "timeline": [
            {{"period": "1~3일", "detail": "이 시기의 구체적인 회복 상태 (예: 부기·붓기 피크. 냉찜질로 진정.)"}},
            {{"period": "7일", "detail": "이 시기의 구체적인 회복 상태 (예: 발사. 큰 부기는 빠지나 가벼운 붓기 잔존.)"}},
            {{"period": "2~4주", "detail": "이 시기의 구체적인 회복 상태 (예: 일상생활 복귀 가능. 가벼운 운동 OK.)"}},
            {{"period": "1~3개월", "detail": "이 시기의 구체적인 회복 상태 (예: 최종 형태 안정. 완성형에 가까워짐.)"}}
        ],
        "note": "스케줄 관련 보충 (상담에서 언급이 있었을 경우만. 없으면 null)"
    }},

    "section5_scar_info": {{
        "points": [
            "흉터 관련 정보1 (1문장)",
            "흉터 관련 정보2 (1문장)",
            "흉터 관련 정보3 (1문장)"
        ]
    }},

    "section6_precautions": {{
        "points": [
            "시술 전 주의사항1 (1문장)",
            "시술 전 주의사항2 (1문장)",
            "시술 전 주의사항3 (1문장)"
        ]
    }},

    "section7_risks": {{
        "points": [
            "리스크1 (간결하게)",
            "리스크2 (간결하게)",
            "리스크3 (간결하게)",
            "리스크4 (간결하게)"
        ]
    }},

    "section8_cost_estimate": {{
        "items": [
            "상담 중 언급된 비용 정보1 (예: 코끝 성형술 단독: 약 OOO~OOO만원)",
            "상담 중 언급된 비용 정보2 (예: 병행 시: 추가 비용 발생)"
        ],
        "includes": "포함 항목 (예: 마취/검사비. 언급 없으면 null)",
        "note": "비용 관련 보충 (예: 정확한 견적은 진료 후 안내. 언급 없으면 null)"
    }},

    "section9_visit_date": {{
        "date": "YYYY.MM.DD (상담에서 언급된 내원 예정일. 없으면 '미정'으로 기재)",
        "note": "보충 설명 (없으면 null)"
    }},

    "section10_ippeo_message": {{
        "paragraphs": [
            "【허들 낮추기】이 상담의 구체적 시술 내용에 언급하며 대단한 것이 아니라고 전하는 1문장. 고객의 고민에 맞춘 고유한 표현으로.",
            "【미래 이미지】고객이 상담에서 말한 구체적 고민·희망을 바탕으로 시술 후 일상의 한 장면을 묘사하는 1문장. 상담 내용에 없는 장면(여행 등)은 사용하지 말 것.",
            "【감정 보상】고객의 구체적 고민이 해소되었을 때의 심리적 만족감을 1문장으로. 상담 내용에 기반한 고유한 표현으로.",
            "【안심감】고객의 페이스에 맞춰 검토할 수 있음을 전하는 1문장.",
            "【행동 촉진】상담 내용에서 읽어낸 고객의 의욕도에 맞춘 다음 스텝으로의 자연스러운 유도 1문장."
        ],
        "final_summary": "최종 정리 (2문장 이내. 고객의 목표 + 권장 방향 + 스케줄 제안을 간결하게)"
    }}{f''',

    "hospital_comparison": {{
        "hospitals": [
            {{
                "name": "병원명 (상담에서 언급된 명칭 그대로 사용)",
                "procedures": "대상 시술 (간결하게)",
                "features": "특장점·강점 (1문장)",
                "price": "비용 정보 (상담에서 언급된 금액만. 없으면 null)",
                "recovery": "회복기간 (상담에서 언급된 내용만. 없으면 null)"
            }}
        ],
        "note": "비교 관련 보충 (1문장. 예: 자세한 내용은 내원 상담 시 확인해주세요.)"
    }}''' if hospital_mentions else ''}
}}

중요 규칙:
- section8_cost_estimate: 상담 중 상담사가 구체적 금액을 언급한 경우에만 기재. AI가 비용을 추측·창작하는 것은 절대 금지. 언급 없으면 items는 빈 배열[]로
- section1~3은 상담에서 언급된 내용만 기반으로
- section4 (회복 스케줄)은 상담에서 언급이 있으면 우선, 없으면 해당 시술의 일반적 회복 경과 기재 ("진료 시 설명드리겠습니다" 등 플레이스홀더 금지)
- section5 (흉터)·section6 (주의사항)·section7 (리스크)는 상담에서 언급 없어도 해당 시술의 일반적 의학 정보 기재 (비우지 않음)
- PubMed 논문 인용(citation)은 포함하지 않음
- 각 항목은 1~2문장 이내로 간결하게
- 섹션 간 중복·반복 배제
- section9_visit_date: 상담에서 날짜 언급 없으면 date는 "미정"으로 기재
- points 배열에 빈 문자열("")을 넣지 말 것. 내용이 있는 항목만 포함
- 전체 10섹션 필수
- section10_ippeo_message: 각 paragraph는 반드시 이 고객의 상담 내용에 고유한 표현으로 작성. 템플릿적 범용문 ("매력을 이끌어내는", "거울을 볼 때마다", "여행에서 사진" 등) 재사용 금지. 고객이 상담에서 말한 구체적 고민·희망·시술명에 언급하여 이 분만을 위한 메시지로
- hospital_comparison: 상담에서 병원명이 언급된 경우에만 생성. 병원 정보가 제공되지 않으면 이 키 자체를 생략. 각 병원의 정보는 상담에서 실제 언급된 내용만 기재, AI가 추측·창작 금지"""
    else:
        prompt = f"""以下の情報を元に、10セクションの日本語リポートをJSON形式で作成してください。
各項目は簡潔に1〜2文以内で記述し、セクション間の重複を排除してください。
カウンセラーが相談で実際に言及した内容のみを記載してください。

== 分類 ==
{category_note}

== お客様名 ==
{display_name}様

{consultation_section}

== 意図抽出結果 ==
{json.dumps(intent_extraction, ensure_ascii=False)}

== 参考資料（内容検証用、直接引用しない）==
{rag_context}
{hospital_section}{admin_direction_section}
== 出力JSON形式 ==
{{
    "title": "{display_name}様 OOのご相談リポート",
    "date": "作成日：YYYY年M月D日",

    "section1_key_summary": {{
        "points": [
            "核心的な悩み（1文で簡潔に）",
            "希望する方向性（1文で簡潔に）",
            "主要な懸念事項（1文で簡潔に）",
            "改善の可能性の要約（1文で簡潔に）"
        ]
    }},

    "section2_cause_analysis": {{
        "intro": "悩みの原因を要約する1文（例: OOが△△に見える原因は以下の通りです。）",
        "causes": [
            "原因1（簡潔に1文）",
            "原因2（簡潔に1文）",
            "原因3（簡潔に1文）"
        ],
        "conclusion": "核心整理1文（例: 単純なXXではなく、YYがポイントです。）"
    }},

    "section3_recommendation": {{
        "primary": {{
            "label": "1次推奨",
            "items": [
                "推奨する施術・アプローチ1（簡潔に）",
                "推奨2（簡潔に）",
                "推奨3（簡潔に）"
            ]
        }},
        "secondary": {{
            "label": "必要時併用",
            "items": [
                "追加施術1（簡潔に）"
            ]
        }},
        "goal": "目標の要約1文（例: 自然でありながら整った印象を目指します。）"
    }},

    "section4_recovery": {{
        "timeline": [
            {{"period": "1〜3日", "detail": "この時期の具体的な回復状態（例: 腫れ・むくみのピーク。冷却パックで鎮静。）"}},
            {{"period": "7日", "detail": "この時期の具体的な回復状態（例: 抜糸。大きな腫れは引くが軽い腫れは残る。）"}},
            {{"period": "2〜4週", "detail": "この時期の具体的な回復状態（例: 日常生活への復帰可能。軽い運動OK。）"}},
            {{"period": "1〜3ヶ月", "detail": "この時期の具体的な回復状態（例: 最終的な形が安定。完成形に近づく。）"}}
        ],
        "note": "スケジュールに関する補足（相談で言及があった場合のみ。なければnull）"
    }},

    "section5_scar_info": {{
        "points": [
            "傷跡に関する情報1（1文）",
            "傷跡に関する情報2（1文）",
            "傷跡に関する情報3（1文）"
        ]
    }},

    "section6_precautions": {{
        "points": [
            "施術前注意事項1（1文）",
            "施術前注意事項2（1文）",
            "施術前注意事項3（1文）"
        ]
    }},

    "section7_risks": {{
        "points": [
            "リスク1（簡潔に）",
            "リスク2（簡潔に）",
            "リスク3（簡潔に）",
            "リスク4（簡潔に）"
        ]
    }},

    "section8_cost_estimate": {{
        "items": [
            "相談中に言及された費用情報1（例: 鼻尖形成術 単独: 約OOO〜OOO万ウォン）",
            "相談中に言及された費用情報2（例: 併用時: 追加費用発生）"
        ],
        "includes": "含まれる項目（例: 麻酔/検査費。言及がなければnull）",
        "note": "費用に関する補足（例: 正確なお見積もりは診察後にご案内。言及がなければnull）"
    }},

    "section9_visit_date": {{
        "date": "YYYY.MM.DD（相談で言及された来院予定日。なければ「未定」と記載）",
        "note": "補足説明（なければnull）"
    }},

    "section10_ippeo_message": {{
        "paragraphs": [
            "【ハードル低減】この相談の具体的な施術内容に触れながら、大げさなことではないと伝える1文。お客様の悩みに合わせた独自の表現で。",
            "【未来イメージ】お客様が相談で語った具体的な悩み・希望を踏まえて、施術後の日常の一場面を描写する1文。相談内容にない場面（旅行等）は使わないこと。",
            "【感情報酬】お客様の具体的な悩みが解消された時の心理的な満足感を1文で。相談内容に基づいた固有の表現で。",
            "【安心感】お客様のペースで検討できることを伝える1文。",
            "【行動促進】相談内容から読み取れるお客様の意欲度に合わせた、次のステップへの自然な誘導1文。"
        ],
        "final_summary": "最終整理（2文以内。お客様の目標 + 推奨方向 + スケジュール提案を簡潔に）"
    }}{f''',

    "hospital_comparison": {{
        "hospitals": [
            {{
                "name": "病院名（相談で言及された名称をそのまま使用）",
                "procedures": "対象施術（簡潔に）",
                "features": "特長・強み（1文）",
                "price": "費用情報（相談で言及された金額のみ。なければnull）",
                "recovery": "回復期間（相談で言及された内容のみ。なければnull）"
            }}
        ],
        "note": "比較に関する補足（1文。例: 詳細は来院相談時にご確認ください。）"
    }}''' if hospital_mentions else ''}
}}

重要ルール:
- section8_cost_estimate: 相談中にカウンセラーが具体的な金額を言及した場合のみ記載すること。AIが費用を推測・創作することは絶対禁止。言及がなければitemsは空配列[]にすること
- section1〜3は相談で言及された内容のみに基づくこと
- section4（回復スケジュール）は相談で言及があればそれを優先し、なければ該当施術の一般的な回復経過を記載すること（「診察時に説明します」等のプレースホルダーは禁止）
- section5（傷跡）・section6（注意事項）・section7（リスク）は、相談で言及がなくても該当施術の一般的な医学情報を記載すること（空にしない）
- PubMed論文の引用（citation）は含めないこと
- 各項目は1〜2文以内で簡潔に
- セクション間の重複・繰り返しを排除すること
- section9_visit_date: 相談で日付が言及されていなければdateは「未定」と記載すること
- pointsの配列に空文字列("")を入れないこと。内容がある項目のみ含めること
- 全10セクション必須
- section10_ippeo_message: 各paragraphは必ずこのお客様の相談内容に固有の表現で作成すること。テンプレート的な汎用文（「魅力を引き出す」「鏡を見るたびに」「旅行で写真」等）の使い回しは禁止。お客様が相談で述べた具体的な悩み・希望・施術名に言及して、この方だけに向けたメッセージにすること
- hospital_comparison: 相談で病院名が言及された場合のみ作成すること。病院情報が提供されていない場合はこのキー自体を省略すること。各病院の情報は相談で実際に言及された内容のみ記載し、AIが推測・創作してはならない"""

    # 언어별 시스템 인스트럭션 선택
    sys_instruction = SYSTEM_INSTRUCTION_KO if is_korean else SYSTEM_INSTRUCTION

    # JSON 파싱 재시도 (최대 2회)
    report = None
    for parse_attempt in range(2):
        result = await generate_json(prompt, sys_instruction)
        try:
            report = safe_parse_json(result)
            if isinstance(report, list):
                report = report[0] if report else {}
            break
        except json.JSONDecodeError as e:
            logger.warning(f"[ReportWriter] JSON parse error (attempt {parse_attempt + 1}): {str(e)[:100]}")
            if parse_attempt == 0:
                await asyncio.sleep(3)
            else:
                raise ValueError(f"Report JSON parse failed after 2 attempts: {str(e)}")

    # 리포트 작성일을 현재 한국/일본 시간(KST/JST) 기준으로 확정
    kst_jst = timezone(timedelta(hours=9))
    now = datetime.now(kst_jst)
    if is_korean:
        report["date"] = f"작성일: {now.year}년 {now.month}월 {now.day}일"
    else:
        report["date"] = f"作成日：{now.year}年{now.month}月{now.day}日"

    return report
