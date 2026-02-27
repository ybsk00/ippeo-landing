import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException
from models.schemas import ChatStartRequest, ChatMessageRequest, ChatEndRequest
from services.supabase_client import get_supabase
from agents.chat_agent import get_greeting, run_chat_rag
from agents.chat_to_consultation import convert_chat_to_consultation
from agents.pipeline import run_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ============================================
# Background task: 파이프라인 실행 + 자동 승인
# ============================================
async def _run_pipeline_and_auto_approve(
    consultation_id: str, session_id: str
):
    """파이프라인 실행 후, review_passed면 자동 승인"""
    db = get_supabase()

    try:
        await run_pipeline(consultation_id)

        # 파이프라인 완료 후 리포트 확인
        report_result = (
            db.table("reports")
            .select("id, review_passed, access_token, status")
            .eq("consultation_id", consultation_id)
            .eq("report_type", "r4")
            .limit(1)
            .execute()
        )

        if report_result.data:
            report = report_result.data[0]
            report_id = report["id"]

            # review_passed이면 자동 승인
            if report.get("review_passed") and report["status"] == "draft":
                db.table("reports").update({
                    "status": "approved",
                }).eq("id", report_id).execute()

                db.table("consultations").update({
                    "status": "report_approved",
                }).eq("id", consultation_id).execute()

                logger.info(
                    f"[Chat] Auto-approved report {report_id[:8]} "
                    f"for consultation {consultation_id[:8]}"
                )

            # chat_sessions에 report_id 업데이트
            db.table("chat_sessions").update({
                "report_id": report_id,
            }).eq("id", session_id).execute()

    except Exception as e:
        logger.error(
            f"[Chat] Pipeline failed for consultation {consultation_id[:8]}: {e}",
            exc_info=True,
        )


# ============================================
# POST /api/chat/start — 새 세션 시작
# ============================================
@router.post("/start")
async def start_chat(data: ChatStartRequest):
    """새 채팅 세션을 생성하고 초기 인사말을 반환"""
    db = get_supabase()

    language = data.language or "ja"
    visitor_id = f"visitor_{uuid.uuid4().hex[:12]}"

    # 세션 생성
    session_result = (
        db.table("chat_sessions")
        .insert({
            "visitor_id": visitor_id,
            "language": language,
            "status": "active",
        })
        .execute()
    )
    session = session_result.data[0]
    session_id = session["id"]

    # 인사 메시지 저장
    greeting = get_greeting(language)
    db.table("chat_messages").insert({
        "session_id": session_id,
        "role": "assistant",
        "content": greeting,
    }).execute()

    return {
        "session_id": session_id,
        "visitor_id": visitor_id,
        "greeting": greeting,
    }


# ============================================
# POST /api/chat/message — 메시지 전송 + AI 응답
# ============================================
@router.post("/message")
async def send_message(data: ChatMessageRequest):
    """사용자 메시지를 저장하고 AI 응답을 생성"""
    db = get_supabase()

    # 세션 확인
    session_result = (
        db.table("chat_sessions")
        .select("id, language, status")
        .eq("id", data.session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session = session_result.data
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Chat session is not active")

    language = session.get("language", "ja")

    # 사용자 메시지 저장
    db.table("chat_messages").insert({
        "session_id": data.session_id,
        "role": "user",
        "content": data.content,
    }).execute()

    # 이전 메시지 로드 (최근 20개)
    history_result = (
        db.table("chat_messages")
        .select("role, content")
        .eq("session_id", data.session_id)
        .order("created_at")
        .limit(20)
        .execute()
    )
    messages = history_result.data or []

    # RAG + 응답 생성
    try:
        response_text, rag_references = await run_chat_rag(messages, language)
    except Exception as e:
        logger.error(f"[Chat] AI response failed: {e}", exc_info=True)
        # 폴백 응답
        if language == "ja":
            response_text = (
                "申し訳ございません。一時的にエラーが発生しました。"
                "もう一度お試しいただけますか？"
            )
        else:
            response_text = (
                "죄송합니다. 일시적인 오류가 발생했습니다. "
                "다시 시도해 주시겠어요?"
            )
        rag_references = []

    # AI 응답 저장
    db.table("chat_messages").insert({
        "session_id": data.session_id,
        "role": "assistant",
        "content": response_text,
        "rag_references": rag_references if rag_references else None,
    }).execute()

    # 메시지 수 확인 (리포트 생성 가능 여부)
    user_msg_count = sum(1 for m in messages if m["role"] == "user")
    can_generate_report = user_msg_count >= 5  # 사용자 메시지 5개 이상

    return {
        "content": response_text,
        "rag_references": rag_references,
        "can_generate_report": can_generate_report,
    }


# ============================================
# POST /api/chat/end — 세션 종료 + 리포트 생성
# ============================================
@router.post("/end")
async def end_chat(data: ChatEndRequest, background_tasks: BackgroundTasks):
    """채팅 종료 후 상담 레코드 생성 + 파이프라인 트리거"""
    db = get_supabase()

    # 세션 확인
    session_result = (
        db.table("chat_sessions")
        .select("id, status, consultation_id")
        .eq("id", data.session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session = session_result.data

    # 이미 변환된 경우
    if session.get("consultation_id"):
        return {
            "consultation_id": session["consultation_id"],
            "status": "already_converted",
        }

    if session["status"] != "active":
        raise HTTPException(
            status_code=400,
            detail="Chat session is not active",
        )

    language = data.language or "ja"

    # 채팅 → 상담 변환
    try:
        consultation_id = await convert_chat_to_consultation(
            session_id=data.session_id,
            customer_name=data.customer_name or "",
            customer_email=data.customer_email or "",
            language=language,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 상태를 processing으로 변경
    db.table("consultations").update({
        "status": "processing",
    }).eq("id", consultation_id).execute()

    # 백그라운드에서 파이프라인 실행 + 자동 승인
    background_tasks.add_task(
        _run_pipeline_and_auto_approve, consultation_id, data.session_id
    )

    return {
        "consultation_id": consultation_id,
        "status": "processing",
    }


# ============================================
# GET /api/chat/history/{session_id} — 대화 이력
# ============================================
@router.get("/history/{session_id}")
async def get_chat_history(session_id: str):
    """채팅 세션의 전체 대화 이력 조회"""
    db = get_supabase()

    # 세션 정보
    session_result = (
        db.table("chat_sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # 메시지 목록
    msg_result = (
        db.table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return {
        "session": session_result.data,
        "messages": msg_result.data or [],
    }


# ============================================
# GET /api/chat/report-status/{session_id} — 리포트 상태 폴링
# ============================================
@router.get("/report-status/{session_id}")
async def get_report_status(session_id: str):
    """채팅 세션의 리포트 생성 상태를 확인"""
    db = get_supabase()

    # 세션 확인
    session_result = (
        db.table("chat_sessions")
        .select("id, consultation_id, report_id, status")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Chat session not found")

    session = session_result.data
    consultation_id = session.get("consultation_id")

    if not consultation_id:
        return {
            "status": "no_consultation",
            "access_token": None,
        }

    # 상담 상태 확인
    consultation_result = (
        db.table("consultations")
        .select("status")
        .eq("id", consultation_id)
        .single()
        .execute()
    )
    if not consultation_result.data:
        return {
            "status": "consultation_not_found",
            "access_token": None,
        }

    c_status = consultation_result.data["status"]

    # 리포트 확인
    report_result = (
        db.table("reports")
        .select("id, status, access_token")
        .eq("consultation_id", consultation_id)
        .eq("report_type", "r4")
        .limit(1)
        .execute()
    )

    if report_result.data:
        report = report_result.data[0]
        return {
            "status": report["status"],
            "access_token": report.get("access_token"),
            "consultation_status": c_status,
        }

    # 리포트 아직 없음
    return {
        "status": c_status,
        "access_token": None,
        "consultation_status": c_status,
    }
