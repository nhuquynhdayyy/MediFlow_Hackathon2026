"""
load.py — Realtime Load API
Trả về tải hiện tại theo chuyên khoa, có wait_time và alert_level.
"""

from fastapi import APIRouter
from datetime import datetime

from app.api.utils import get_current_load_by_specialty

router = APIRouter()


@router.get("/by-specialty")
def get_load_by_specialty():
    """
    Tải hiện tại theo chuyên khoa.
    Enriched: wait_time, floor, alert_level, trend hint.
    """
    data = get_current_load_by_specialty()

    # Thêm alert_level và group
    enriched = []
    for d in data:
        load_pct = d["load_pct"]
        if load_pct >= 90:
            alert_level = "critical"
        elif load_pct >= 75:
            alert_level = "warning"
        else:
            alert_level = "normal"

        enriched.append({**d, "alert_level": alert_level})

    # Summary stats
    critical = [d for d in enriched if d["alert_level"] == "critical"]
    warning = [d for d in enriched if d["alert_level"] == "warning"]
    avg_load = round(sum(d["load_pct"] for d in enriched) / len(enriched), 1) if enriched else 0

    return {
        "status": "success",
        "data": enriched,
        "summary": {
            "total_departments": len(enriched),
            "critical_count": len(critical),
            "warning_count": len(warning),
            "avg_load_pct": avg_load,
            "critical_departments": [d["specialty"] for d in critical],
        },
        "meta": {
            "last_updated": datetime.now().isoformat(),
            "threshold_warning": 75,
            "threshold_critical": 90,
        },
    }


@router.get("/bottleneck")
def get_bottleneck():
    """
    Top 5 khoa đang tắc nghẽn nhất — dùng cho admin alert widget.
    """
    data = get_current_load_by_specialty()
    top5 = data[:5]  # Đã sort desc theo load_pct trong utils

    return {
        "status": "success",
        "data": [
            {
                "specialty": d["specialty"],
                "load_pct": d["load_pct"],
                "current_patients": d["current_patients"],
                "capacity": d["capacity"],
                "wait_time": d.get("wait_time", 0),
                "floor": d.get("floor", 1),
                "alert_level": "critical" if d["load_pct"] >= 90 else "warning" if d["load_pct"] >= 75 else "normal",
            }
            for d in top5
        ],
        "meta": {"last_updated": datetime.now().isoformat()},
    }