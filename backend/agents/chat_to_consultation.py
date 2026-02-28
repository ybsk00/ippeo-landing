import logging

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


async def convert_chat_to_consultation(
    session_id: str,
    customer_name: str = "",
    customer_email: str = "",
    language: str = "ja",
) -> str:
    """채팅 세션을 상담(consultation) 레코드로 변환.

    1. 해당 세션의 전체 메시지를 로드
    2. "고객: ... / 상담사: ..." 형태의 다이얼로그 텍스트로 변환
       (기존 pipeline preprocessor와 호환되는 형식)
    3. consultations 테이블에 status="registered"로 삽입
    4. chat_sessions에 consultation_id 업데이트

    Returns: consultation_id (str)
    """
    db = get_supabase()

    # 1. 세션 확인
    session_result = (
        db.table("chat_sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    session = session_result.data
    if not session:
        raise ValueError(f"Chat session {session_id} not found")

    # 이미 consultation이 생성된 경우
    if session.get("consultation_id"):
        logger.info(
            f"[ChatToConsultation] Session {session_id[:8]} already has "
            f"consultation {session['consultation_id'][:8]}"
        )
        return session["consultation_id"]

    # 2. 메시지 로드 (시간순)
    msg_result = (
        db.table("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    messages = msg_result.data or []

    if not messages:
        raise ValueError(f"No messages in session {session_id}")

    # 3. 다이얼로그 텍스트 구성
    # 기존 파이프라인의 preprocess_stt_dialog가 인식하는 형식:
    #   "고객: ..." / "상담사: ..."
    dialog_lines = []
    for msg in messages:
        if msg["role"] == "user":
            dialog_lines.append(f"고객: {msg['content']}")
        elif msg["role"] == "assistant":
            dialog_lines.append(f"상담사: {msg['content']}")

    original_text = "\n".join(dialog_lines)

    # 세션 언어 사용 (폴백: 파라미터)
    session_lang = session.get("language") or language

    # 이름/이메일: 파라미터 → 세션 저장값 → 기본값 순으로 폴백
    final_name = customer_name or session.get("customer_name") or "익명"
    final_email = customer_email or session.get("customer_email") or ""

    # 4. consultation 삽입
    consultation_result = (
        db.table("consultations")
        .insert({
            "customer_name": final_name,
            "customer_email": final_email,
            "original_text": original_text,
            "input_language": session_lang,
            "status": "registered",
        })
        .execute()
    )
    consultation = consultation_result.data[0]
    consultation_id = consultation["id"]

    # 5. chat_sessions 업데이트
    db.table("chat_sessions").update({
        "consultation_id": consultation_id,
        "status": "ended",
    }).eq("id", session_id).execute()

    logger.info(
        f"[ChatToConsultation] Session {session_id[:8]} → "
        f"Consultation {consultation_id[:8]} "
        f"({len(messages)} messages, lang={session_lang})"
    )

    return consultation_id
