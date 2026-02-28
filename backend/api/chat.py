import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from models.schemas import ChatStartRequest, ChatMessageRequest, ChatEndRequest
from services.supabase_client import get_supabase
from agents.chat_agent import get_greeting, run_chat_rag  # noqa: F401 — 레거시 호환
from agents.chat_router import run_multi_agent_chat
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

    # 멀티에이전트 응답 생성
    agent_type = "general"
    try:
        result = await run_multi_agent_chat(
            messages, language, session_id=data.session_id
        )
        response_text = result["response"]
        rag_references = result["rag_references"]
        agent_type = result["agent_type"]
        # CTA 레벨을 chat_sessions에 저장
        cta_level = result.get("cta_level")
        if cta_level:
            try:
                db.table("chat_sessions").update(
                    {"cta_level": cta_level}
                ).eq("id", data.session_id).execute()
            except Exception:
                pass  # CTA 저장 실패는 무시
    except Exception as e:
        logger.error(f"[Chat] Multi-agent failed: {e}", exc_info=True)
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
        "agent_type": agent_type,
    }


# ============================================
# POST /api/chat/confirm-email — 이메일 수집 동의 확인
# ============================================
class ConfirmEmailRequest(BaseModel):
    session_id: str
    email: str
    agreed: bool


@router.post("/confirm-email")
async def confirm_email(data: ConfirmEmailRequest):
    """사용자가 이메일 수집에 동의한 경우 저장"""
    db = get_supabase()

    if not data.agreed:
        return {"status": "declined"}

    # 세션 확인
    session_result = (
        db.table("chat_sessions")
        .select("id, language")
        .eq("id", data.session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # 이메일 저장
    db.table("chat_sessions").update({
        "customer_email": data.email,
    }).eq("id", data.session_id).execute()

    language = session_result.data.get("language", "ja")

    # 동의 감사 메시지 저장
    if language == "ja":
        confirm_msg = (
            "ご同意ありがとうございます！リポートの準備ができ次第、"
            f"{data.email} 宛にメールでご案内いたします。\n\n"
            "他にご質問がございましたら、お気軽にどうぞ！"
        )
    else:
        confirm_msg = (
            "동의해 주셔서 감사합니다! 리포트가 준비되는 대로 "
            f"{data.email}으로 안내드리겠습니다.\n\n"
            "다른 궁금한 점이 있으시면 편하게 말씀해 주세요!"
        )

    db.table("chat_messages").insert({
        "session_id": data.session_id,
        "role": "assistant",
        "content": confirm_msg,
    }).execute()

    logger.info(f"[Chat] Email consent confirmed: {data.email} for session {data.session_id[:8]}")

    return {
        "status": "confirmed",
        "message": confirm_msg,
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


# ============================================
# Admin Endpoints
# ============================================

class AdminSendEmailRequest(BaseModel):
    email: str
    customer_name: Optional[str] = ""


# GET /api/chat/admin/stats — 챗봇 통계
@router.get("/admin/stats")
async def admin_chat_stats():
    """챗봇 세션 통계 (관리자용)"""
    db = get_supabase()

    # 전체 세션 수
    all_sessions = db.table("chat_sessions").select("id", count="exact").execute()
    total_sessions = all_sessions.count or 0

    # 오늘 세션 수
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_sessions = (
        db.table("chat_sessions")
        .select("id", count="exact")
        .gte("created_at", f"{today_str}T00:00:00Z")
        .execute()
    )
    today_count = today_sessions.count or 0

    # 리포트 생성된 세션 수 (consultation_id가 있는)
    report_sessions = (
        db.table("chat_sessions")
        .select("id", count="exact")
        .not_.is_("consultation_id", "null")
        .execute()
    )
    report_count = report_sessions.count or 0

    # 변환율
    conversion_rate = (
        round((report_count / total_sessions) * 100, 1)
        if total_sessions > 0
        else 0
    )

    # 활성 세션 수
    active_sessions = (
        db.table("chat_sessions")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )
    active_count = active_sessions.count or 0

    return {
        "total_sessions": total_sessions,
        "today_sessions": today_count,
        "report_generated": report_count,
        "conversion_rate": conversion_rate,
        "active_sessions": active_count,
    }


# GET /api/chat/admin/sessions — 세션 목록
@router.get("/admin/sessions")
async def admin_list_sessions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
):
    """채팅 세션 목록 (관리자용)"""
    db = get_supabase()

    offset = (page - 1) * per_page

    query = db.table("chat_sessions").select(
        "id, visitor_id, language, status, consultation_id, report_id, cta_level, customer_email, customer_name, created_at, updated_at",
        count="exact",
    )

    if status:
        query = query.eq("status", status)

    result = (
        query.order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )

    # 각 세션에 메시지 수 추가
    sessions = result.data or []
    session_ids = [s["id"] for s in sessions]

    if session_ids:
        msg_counts_result = (
            db.table("chat_messages")
            .select("session_id")
            .in_("session_id", session_ids)
            .execute()
        )
        msg_count_map: dict[str, int] = {}
        for msg in (msg_counts_result.data or []):
            sid = msg["session_id"]
            msg_count_map[sid] = msg_count_map.get(sid, 0) + 1

        for session in sessions:
            session["message_count"] = msg_count_map.get(session["id"], 0)
    else:
        for session in sessions:
            session["message_count"] = 0

    return {
        "sessions": sessions,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


# GET /api/chat/admin/sessions/{session_id} — 세션 상세
@router.get("/admin/sessions/{session_id}")
async def admin_session_detail(session_id: str):
    """채팅 세션 상세 (메시지 포함, 관리자용)"""
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
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_result.data

    # 메시지 목록
    msg_result = (
        db.table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    # 연결된 상담/리포트 정보
    consultation = None
    report = None
    if session.get("consultation_id"):
        c_result = (
            db.table("consultations")
            .select("id, customer_name, customer_email, status, classification, cta_level")
            .eq("id", session["consultation_id"])
            .single()
            .execute()
        )
        consultation = c_result.data

        r_result = (
            db.table("reports")
            .select("id, status, access_token, report_type, created_at")
            .eq("consultation_id", session["consultation_id"])
            .eq("report_type", "r4")
            .limit(1)
            .execute()
        )
        if r_result.data:
            report = r_result.data[0]

    return {
        "session": session,
        "messages": msg_result.data or [],
        "consultation": consultation,
        "report": report,
    }


# POST /api/chat/admin/sessions/delete — 세션 일괄 삭제
class DeleteSessionsRequest(BaseModel):
    session_ids: list[str]


@router.post("/admin/sessions/delete")
async def admin_delete_sessions(data: DeleteSessionsRequest):
    """챗봇 세션 일괄 삭제 (chat_messages는 ON DELETE CASCADE)"""
    db = get_supabase()
    deleted = 0
    for sid in data.session_ids:
        try:
            db.table("chat_sessions").delete().eq("id", sid).execute()
            deleted += 1
        except Exception as e:
            logger.warning(f"[Admin] Failed to delete session {sid}: {e}")
    return {"deleted": deleted}


# POST /api/chat/admin/sessions/{session_id}/transfer — 상담관리로 이전
class TransferRequest(BaseModel):
    customer_name: str = ""
    customer_email: str = ""


@router.post("/admin/sessions/{session_id}/transfer")
async def admin_transfer_to_consultation(session_id: str, data: TransferRequest):
    """챗봇 세션을 상담관리(consultation)로 이전. 파이프라인은 실행하지 않음."""
    db = get_supabase()

    # 세션 확인
    session_result = (
        db.table("chat_sessions")
        .select("id, status, consultation_id, language")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_result.data

    # 이미 이전된 경우
    if session.get("consultation_id"):
        raise HTTPException(
            status_code=400,
            detail=f"Already transferred to consultation {session['consultation_id']}",
        )

    # convert_chat_to_consultation 호출 (파이프라인 미실행)
    try:
        consultation_id = await convert_chat_to_consultation(
            session_id=session_id,
            customer_name=data.customer_name,
            customer_email=data.customer_email,
            language=session.get("language", "ja"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    logger.info(
        f"[Admin] Session {session_id[:8]} transferred → Consultation {consultation_id[:8]}"
    )

    return {
        "status": "transferred",
        "consultation_id": consultation_id,
    }


# POST /api/chat/admin/sessions/{session_id}/send-email — 이메일 발송
@router.post("/admin/sessions/{session_id}/send-email")
async def admin_send_email(
    session_id: str,
    data: AdminSendEmailRequest,
    background_tasks: BackgroundTasks,
):
    """세션 기반 리포트 생성 + 이메일 발송 (관리자용)"""
    from services.email_service import send_report_email

    db = get_supabase()

    # 세션 확인
    session_result = (
        db.table("chat_sessions")
        .select("id, status, consultation_id, language")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_result.data
    consultation_id = session.get("consultation_id")
    language = session.get("language", "ja")

    # 1. 상담 레코드가 없으면 생성
    if not consultation_id:
        try:
            consultation_id = await convert_chat_to_consultation(
                session_id=session_id,
                customer_name=data.customer_name or "",
                customer_email=data.email,
                language=language,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 2. 리포트 확인
    report_result = (
        db.table("reports")
        .select("id, status, access_token")
        .eq("consultation_id", consultation_id)
        .eq("report_type", "r4")
        .limit(1)
        .execute()
    )

    if report_result.data and report_result.data[0].get("access_token"):
        report = report_result.data[0]
        # 리포트가 이미 있으면 바로 이메일 발송
        customer_name = data.customer_name or "お客様"
        await send_report_email(
            to_email=data.email,
            customer_name=customer_name,
            access_token=report["access_token"],
        )

        # 리포트 상태 업데이트
        db.table("reports").update({
            "status": "sent",
            "email_sent_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", report["id"]).execute()

        return {
            "status": "sent",
            "report_id": report["id"],
            "email": data.email,
        }
    else:
        # 리포트 없으면 파이프라인 실행 후 이메일 발송 (백그라운드)
        async def _pipeline_and_email():
            try:
                await run_pipeline(consultation_id)
                r = (
                    db.table("reports")
                    .select("id, access_token")
                    .eq("consultation_id", consultation_id)
                    .eq("report_type", "r4")
                    .limit(1)
                    .execute()
                )
                if r.data and r.data[0].get("access_token"):
                    rpt = r.data[0]
                    await send_report_email(
                        to_email=data.email,
                        customer_name=data.customer_name or "お客様",
                        access_token=rpt["access_token"],
                    )
                    db.table("reports").update({
                        "status": "sent",
                        "email_sent_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", rpt["id"]).execute()
                    logger.info(f"[Admin] Email sent for session {session_id[:8]}")
            except Exception as e:
                logger.error(f"[Admin] Pipeline+email failed: {e}", exc_info=True)

        background_tasks.add_task(_pipeline_and_email)
        return {
            "status": "processing",
            "consultation_id": consultation_id,
            "email": data.email,
        }
