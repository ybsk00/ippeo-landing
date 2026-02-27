import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


async def track_event(
    event_type: str,
    hospital_id: Optional[str] = None,
    chat_session_id: Optional[str] = None,
    report_id: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Insert a conversion event into conversion_events table.

    Silently skips if hospital_id is None (no hospital to track).
    """
    if not hospital_id:
        return None

    db = get_supabase()

    row = {
        "hospital_id": hospital_id,
        "event_type": event_type,
    }
    if chat_session_id:
        row["chat_session_id"] = chat_session_id
    if report_id:
        row["report_id"] = report_id
    if metadata:
        row["metadata"] = metadata

    try:
        result = db.table("conversion_events").insert(row).execute()
        if result.data:
            logger.info(
                f"[ConversionTracker] Tracked {event_type} "
                f"for hospital {hospital_id[:8]}"
            )
            return result.data[0]
    except Exception as e:
        # Tracking failure should never block main logic
        logger.warning(
            f"[ConversionTracker] Failed to track {event_type}: {e}"
        )
    return None


async def update_monthly_stats(hospital_id: str, year_month: str):
    """Calculate stats from conversion_events and upsert into hospital_monthly_stats.

    Args:
        hospital_id: UUID of the hospital.
        year_month: Format "YYYY-MM" (e.g. "2026-02").
    """
    db = get_supabase()

    # Date range for the month
    year, month = year_month.split("-")
    start = f"{year_month}-01T00:00:00+00:00"
    if int(month) == 12:
        end = f"{int(year) + 1}-01-01T00:00:00+00:00"
    else:
        end = f"{year}-{int(month) + 1:02d}-01T00:00:00+00:00"

    # Count events by type for this hospital/month
    events_result = (
        db.table("conversion_events")
        .select("event_type")
        .eq("hospital_id", hospital_id)
        .gte("created_at", start)
        .lt("created_at", end)
        .execute()
    )

    events = events_result.data or []

    counts = {
        "chat_started": 0,
        "report_generated": 0,
        "report_viewed": 0,
        "link_clicked": 0,
        "inquiry_submitted": 0,
        "booking_completed": 0,
    }
    for ev in events:
        et = ev.get("event_type", "")
        if et in counts:
            counts[et] += 1

    total_sessions = counts["chat_started"]
    total_reports = counts["report_generated"]
    total_views = counts["report_viewed"]
    total_clicks = counts["link_clicked"]
    total_inquiries = counts["inquiry_submitted"]
    total_bookings = counts["booking_completed"]

    # Calculate conversion rates (avoid division by zero)
    report_rate = (total_reports / total_sessions * 100) if total_sessions > 0 else 0
    view_rate = (total_views / total_reports * 100) if total_reports > 0 else 0
    click_rate = (total_clicks / total_views * 100) if total_views > 0 else 0
    inquiry_rate = (total_inquiries / total_clicks * 100) if total_clicks > 0 else 0
    booking_rate = (total_bookings / total_inquiries * 100) if total_inquiries > 0 else 0

    stats_row = {
        "hospital_id": hospital_id,
        "year_month": year_month,
        "total_sessions": total_sessions,
        "total_reports": total_reports,
        "total_views": total_views,
        "total_clicks": total_clicks,
        "total_inquiries": total_inquiries,
        "total_bookings": total_bookings,
        "report_rate": round(report_rate, 2),
        "view_rate": round(view_rate, 2),
        "click_rate": round(click_rate, 2),
        "inquiry_rate": round(inquiry_rate, 2),
        "booking_rate": round(booking_rate, 2),
    }

    # Upsert: check if row exists for this hospital + year_month
    existing = (
        db.table("hospital_monthly_stats")
        .select("id")
        .eq("hospital_id", hospital_id)
        .eq("year_month", year_month)
        .limit(1)
        .execute()
    )

    try:
        if existing.data:
            db.table("hospital_monthly_stats").update(stats_row).eq(
                "id", existing.data[0]["id"]
            ).execute()
        else:
            db.table("hospital_monthly_stats").insert(stats_row).execute()

        logger.info(
            f"[ConversionTracker] Updated monthly stats for "
            f"hospital {hospital_id[:8]} ({year_month})"
        )
    except Exception as e:
        logger.warning(
            f"[ConversionTracker] Failed to update monthly stats: {e}"
        )


async def get_hospital_stats(
    hospital_id: str, period: str = "month"
) -> dict:
    """Get aggregated stats for a hospital.

    Args:
        hospital_id: UUID of the hospital.
        period: "month" (current month), "week" (last 7 days),
                or "YYYY-MM" for a specific month.

    Returns:
        Dict with totals, rates, and monthly_trend (last 6 months).
    """
    db = get_supabase()
    now = datetime.now(timezone.utc)

    # Determine date range
    if period == "week":
        start_dt = now - timedelta(days=7)
        start = start_dt.isoformat()
        end = now.isoformat()
    elif period == "month":
        start = f"{now.year}-{now.month:02d}-01T00:00:00+00:00"
        end = now.isoformat()
    else:
        # Specific month "YYYY-MM"
        year, month = period.split("-")
        start = f"{period}-01T00:00:00+00:00"
        if int(month) == 12:
            end = f"{int(year) + 1}-01-01T00:00:00+00:00"
        else:
            end = f"{year}-{int(month) + 1:02d}-01T00:00:00+00:00"

    # Fetch events for the period
    events_result = (
        db.table("conversion_events")
        .select("event_type")
        .eq("hospital_id", hospital_id)
        .gte("created_at", start)
        .lt("created_at", end)
        .execute()
    )

    events = events_result.data or []

    counts = {
        "chat_started": 0,
        "report_generated": 0,
        "report_viewed": 0,
        "link_clicked": 0,
        "inquiry_submitted": 0,
        "booking_completed": 0,
    }
    for ev in events:
        et = ev.get("event_type", "")
        if et in counts:
            counts[et] += 1

    total_sessions = counts["chat_started"]
    total_reports = counts["report_generated"]
    total_views = counts["report_viewed"]
    total_clicks = counts["link_clicked"]
    total_inquiries = counts["inquiry_submitted"]
    total_bookings = counts["booking_completed"]

    # Rates
    report_rate = (total_reports / total_sessions * 100) if total_sessions > 0 else 0
    view_rate = (total_views / total_reports * 100) if total_reports > 0 else 0
    click_rate = (total_clicks / total_views * 100) if total_views > 0 else 0
    inquiry_rate = (total_inquiries / total_clicks * 100) if total_clicks > 0 else 0
    booking_rate = (total_bookings / total_inquiries * 100) if total_inquiries > 0 else 0

    # Monthly trend (last 6 months from hospital_monthly_stats)
    trend_result = (
        db.table("hospital_monthly_stats")
        .select("year_month, total_sessions, total_reports, total_views, "
                "total_clicks, total_inquiries, total_bookings")
        .eq("hospital_id", hospital_id)
        .order("year_month", desc=True)
        .limit(6)
        .execute()
    )

    monthly_trend = list(reversed(trend_result.data or []))

    return {
        "period": period,
        "total_sessions": total_sessions,
        "total_reports": total_reports,
        "total_views": total_views,
        "total_clicks": total_clicks,
        "total_inquiries": total_inquiries,
        "total_bookings": total_bookings,
        "rates": {
            "report_rate": round(report_rate, 2),
            "view_rate": round(view_rate, 2),
            "click_rate": round(click_rate, 2),
            "inquiry_rate": round(inquiry_rate, 2),
            "booking_rate": round(booking_rate, 2),
        },
        "monthly_trend": monthly_trend,
    }
