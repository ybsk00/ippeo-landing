import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException
from models.schemas import BirthDateVerify
from services.supabase_client import get_supabase
from services.conversion_tracker import track_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public/report", tags=["public_report"])


@router.get("/{token}")
async def get_public_report(token: str, background_tasks: BackgroundTasks):
    db = get_supabase()

    result = (
        db.table("reports")
        .select("id, report_data, report_data_ko, access_expires_at, status, consultation_id, consultations(customer_name, input_language)")
        .eq("access_token", token)
        .limit(1)
        .execute()
    )

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    report_row = result.data[0]

    # 유효기간 확인
    expires_at = report_row.get("access_expires_at")
    if expires_at:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=410, detail="Report link has expired")

    # 발송된 리포트만 열람 가능
    if report_row["status"] not in ("sent", "approved"):
        raise HTTPException(status_code=403, detail="Report is not available yet")

    # Track report_viewed conversion event if hospital info exists in report_data
    report_data = report_row.get("report_data") or {}
    hospital_id = report_data.get("hospital_id")
    if hospital_id:
        background_tasks.add_task(
            track_event,
            event_type="report_viewed",
            hospital_id=hospital_id,
            report_id=report_row["id"],
        )

    consultation = report_row["consultations"]
    input_language = consultation.get("input_language", "ja")

    return {
        "report_data": report_row["report_data"],
        "report_data_ko": report_row.get("report_data_ko"),
        "input_language": input_language,
        "customer_name": consultation["customer_name"],
    }


@router.post("/{token}/verify")
async def verify_report_access(token: str, data: BirthDateVerify):
    # 현재는 토큰만으로 검증. 추후 생년월일 검증 추가 가능
    db = get_supabase()

    report = (
        db.table("reports")
        .select("id, access_expires_at, status")
        .eq("access_token", token)
        .single()
        .execute()
    )

    if not report.data:
        raise HTTPException(status_code=404, detail="Report not found")

    expires_at = report.data.get("access_expires_at")
    if expires_at:
        expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=410, detail="Report link has expired")

    return {"verified": True, "report_id": report.data["id"]}


@router.post("/{token}/opened")
async def track_report_opened(token: str):
    db = get_supabase()

    now = datetime.now(timezone.utc).isoformat()
    result = (
        db.table("reports")
        .update({"email_opened_at": now})
        .eq("access_token", token)
        .is_("email_opened_at", "null")
        .execute()
    )

    return {"tracked": True}
