import logging
from datetime import datetime, timezone, timedelta

import jwt
from fastapi import APIRouter, HTTPException, Request, Query
from models.schemas import HospitalLoginRequest
from services.supabase_client import get_supabase
from services.conversion_tracker import get_hospital_stats, update_monthly_stats
from config import JWT_SECRET

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hospital", tags=["hospital"])


# ============================================
# JWT helpers
# ============================================
def _create_hospital_token(hospital_id: str, hospital_name: str) -> str:
    """Generate a JWT token with hospital_id claim."""
    payload = {
        "sub": hospital_id,
        "hospital_name": hospital_name,
        "type": "hospital",
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _verify_hospital_token(request: Request) -> dict:
    """Extract and verify JWT from Authorization header.

    Returns the decoded payload dict with hospital_id in 'sub'.
    Raises HTTPException 401 if invalid.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Authorization header missing or invalid"
        )

    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "hospital":
        raise HTTPException(status_code=401, detail="Invalid token type")

    return payload


# ============================================
# POST /api/hospital/login
# ============================================
@router.post("/login")
async def hospital_login(data: HospitalLoginRequest):
    """Hospital login with API key. Returns JWT token."""
    db = get_supabase()

    result = (
        db.table("hospitals")
        .select("id, name, name_ja, name_ko, category, is_active")
        .eq("api_key", data.api_key)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=401, detail="Invalid API key"
        )

    hospital = result.data[0]

    if not hospital.get("is_active", True):
        raise HTTPException(
            status_code=403, detail="Hospital account is deactivated"
        )

    token = _create_hospital_token(hospital["id"], hospital["name"])

    return {
        "token": token,
        "hospital": {
            "id": hospital["id"],
            "name": hospital["name"],
            "name_ja": hospital.get("name_ja"),
            "name_ko": hospital.get("name_ko"),
            "category": hospital.get("category"),
        },
    }


# ============================================
# GET /api/hospital/stats
# ============================================
@router.get("/stats")
async def hospital_stats(
    request: Request,
    period: str = Query("month", description="month, week, or YYYY-MM"),
    refresh: bool = Query(False, description="Recalculate monthly stats before returning"),
):
    """Get conversion statistics for the authenticated hospital."""
    payload = _verify_hospital_token(request)
    hospital_id = payload["sub"]

    # Optionally refresh monthly stats
    if refresh:
        now = datetime.now(timezone.utc)
        year_month = f"{now.year}-{now.month:02d}"
        await update_monthly_stats(hospital_id, year_month)

    stats = await get_hospital_stats(hospital_id, period=period)
    return {"data": stats}


# ============================================
# GET /api/hospital/reports
# ============================================
@router.get("/reports")
async def hospital_reports(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List reports that mention this hospital (via conversion_events)."""
    payload = _verify_hospital_token(request)
    hospital_id = payload["sub"]
    db = get_supabase()

    # Get report IDs from conversion_events for this hospital
    offset = (page - 1) * page_size
    events_result = (
        db.table("conversion_events")
        .select("report_id, event_type, created_at")
        .eq("hospital_id", hospital_id)
        .not_.is_("report_id", "null")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    # Deduplicate report IDs while preserving order
    seen = set()
    report_ids = []
    for ev in events_result.data or []:
        rid = ev.get("report_id")
        if rid and rid not in seen:
            seen.add(rid)
            report_ids.append(rid)

    if not report_ids:
        return {"data": [], "total": 0}

    # Fetch report details
    reports_result = (
        db.table("reports")
        .select("id, report_type, status, created_at, "
                "consultations(customer_name, classification)")
        .in_("id", report_ids)
        .execute()
    )

    # Build a lookup and preserve the order from events
    report_map = {r["id"]: r for r in (reports_result.data or [])}
    ordered_reports = [report_map[rid] for rid in report_ids if rid in report_map]

    return {"data": ordered_reports, "total": len(ordered_reports)}


# ============================================
# GET /api/hospital/sessions
# ============================================
@router.get("/sessions")
async def hospital_sessions(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List chat sessions related to this hospital (via conversion_events)."""
    payload = _verify_hospital_token(request)
    hospital_id = payload["sub"]
    db = get_supabase()

    # Get session IDs from conversion_events for this hospital
    offset = (page - 1) * page_size
    events_result = (
        db.table("conversion_events")
        .select("chat_session_id, event_type, created_at")
        .eq("hospital_id", hospital_id)
        .not_.is_("chat_session_id", "null")
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    # Deduplicate session IDs while preserving order
    seen = set()
    session_ids = []
    for ev in events_result.data or []:
        sid = ev.get("chat_session_id")
        if sid and sid not in seen:
            seen.add(sid)
            session_ids.append(sid)

    if not session_ids:
        return {"data": [], "total": 0}

    # Fetch session details
    sessions_result = (
        db.table("chat_sessions")
        .select("id, visitor_id, language, status, consultation_id, created_at")
        .in_("id", session_ids)
        .execute()
    )

    # Preserve order from events
    session_map = {s["id"]: s for s in (sessions_result.data or [])}
    ordered_sessions = [session_map[sid] for sid in session_ids if sid in session_map]

    return {"data": ordered_sessions, "total": len(ordered_sessions)}
