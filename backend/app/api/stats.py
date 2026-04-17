"""
stats.py — Statistics API
Thống kê bệnh nhân hôm nay + theo chuyên khoa.
"""

from fastapi import APIRouter
from datetime import datetime

from app.api.utils import get_today_counts, get_patient_count_by_specialty, get_current_load_by_specialty

router = APIRouter()


@router.get("/today")
def get_stats_today():
    """
    Thống kê tổng hôm nay: waiting, in_progress, completed.
    Thêm: completion_rate, avg_load.
    """
    data = get_today_counts()
    total = data.get("total_patients", 0)

    load_data = get_current_load_by_specialty()
    avg_load = (
        round(sum(d["load_pct"] for d in load_data) / len(load_data), 1)
        if load_data else 0
    )

    completion_rate = (
        round(data["completed"] / total * 100, 1) if total > 0 else 0
    )

    return {
        "status": "success",
        "data": {
            **data,
            "completion_rate_pct": completion_rate,
            "avg_system_load_pct": avg_load,
            "snapshot_time": datetime.now().strftime("%H:%M"),
        },
    }


@router.get("/by-specialty")
def get_stats_by_specialty():
    """
    Số bệnh nhân + load theo từng chuyên khoa.
    Merge: patient_count + load_pct để hiển thị đầy đủ trên dashboard.
    """
    count_data = get_patient_count_by_specialty()
    load_data = {d["specialty"]: d for d in get_current_load_by_specialty()}

    merged = []
    for item in count_data:
        spec = item["specialty"]
        load_info = load_data.get(spec, {})
        merged.append({
            "specialty": spec,
            "patient_count": item["patient_count"],
            "load_pct": load_info.get("load_pct", 0),
            "capacity": load_info.get("capacity", 0),
            "wait_time": load_info.get("wait_time", 0),
            "alert_level": (
                "critical" if load_info.get("load_pct", 0) >= 90
                else "warning" if load_info.get("load_pct", 0) >= 75
                else "normal"
            ),
        })

    return {
        "status": "success",
        "data": merged,
        "meta": {"last_updated": datetime.now().isoformat()},
    }