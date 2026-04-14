"""
forecast.py — Forecast API
Dự báo tải bệnh viện dựa trên pattern thực tế + realtime base load.
"""

from fastapi import APIRouter
from datetime import datetime

from app.api.utils import get_forecast_summary, get_current_load_by_specialty, HOURLY_LOAD_PATTERN

router = APIRouter()


@router.get("/24h")
def get_forecast_24h():
    """
    Dự báo tải 24 giờ tới.
    Dựa trên: base load realtime × pattern bệnh viện VN + noise nhỏ.
    Có peak_hour, trough_hour, alert_level cho từng điểm.
    """
    data = get_forecast_summary()
    return {"status": "success", "data": data}


@router.get("/realtime")
def get_forecast_realtime():
    """
    Snapshot realtime — trả về giờ hiện tại + 5 giờ tiếp theo.
    Dùng cho widget realtime cập nhật mỗi 5 phút.
    """
    full = get_forecast_summary()
    forecast_points = full.get("forecast", [])

    # Chỉ lấy 6 điểm đầu (hiện tại + 5h tới)
    short_term = forecast_points[:6]

    now = datetime.now()
    current_load_data = get_current_load_by_specialty()
    avg_load = (
        sum(d["load_pct"] for d in current_load_data) / len(current_load_data)
        if current_load_data else 0
    )

    # Khoa đang tải cao nhất
    top3 = sorted(current_load_data, key=lambda x: x["load_pct"], reverse=True)[:3]

    return {
        "status": "success",
        "data": {
            "current_time": now.strftime("%H:%M"),
            "current_avg_load_pct": round(avg_load, 1),
            "top_loaded_departments": [
                {
                    "specialty": d["specialty"],
                    "load_pct": d["load_pct"],
                    "wait_time": d.get("wait_time", 0),
                }
                for d in top3
            ],
            "next_6h_forecast": short_term,
            "peak_hour": full.get("peak_hour"),
            "peak_load_pct": full.get("peak_load_pct"),
            "threshold_pct": full.get("threshold_pct", 85),
            "note": "Pattern bệnh viện VN — cập nhật mỗi 5 phút",
            "last_updated": full.get("last_updated"),
        },
    }


@router.get("/hourly-pattern")
def get_hourly_pattern():
    """
    Trả về pattern tải theo giờ (dùng cho chart admin).
    Cho phép admin thấy giờ cao điểm lịch sử của bệnh viện.
    """
    pattern_data = [
        {
            "hour": f"{h:02d}:00",
            "load_ratio": round(v, 2),
            "label": _hour_label(h),
        }
        for h, v in HOURLY_LOAD_PATTERN.items()
    ]
    return {
        "status": "success",
        "data": {
            "pattern": pattern_data,
            "peak_hours": ["09:00", "10:00", "14:00", "15:00"],
            "note": "Tỷ lệ tải theo giờ — 1.0 = baseline bình thường",
        },
    }


def _hour_label(hour: int) -> str:
    if 7 <= hour <= 11:
        return "Cao điểm sáng"
    elif 12 <= hour <= 13:
        return "Giảm trưa"
    elif 14 <= hour <= 16:
        return "Cao điểm chiều"
    elif 17 <= hour <= 19:
        return "Giảm dần"
    elif hour >= 20 or hour <= 5:
        return "Thấp điểm"
    else:
        return "Bình thường"