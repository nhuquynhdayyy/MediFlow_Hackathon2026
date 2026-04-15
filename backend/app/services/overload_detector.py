from __future__ import annotations

from typing import Dict, List


def analyze_overload(departments: List[Dict]) -> Dict:
    red = [d for d in departments if d["load_pct"] > 80]
    yellow = [d for d in departments if 50 <= d["load_pct"] <= 80]

    overloaded_departments = [d["department"] for d in red]
    recommendations: List[str] = []
    actions: List[str] = []

    if red:
        top = red[0]["department"]
        recommendations.extend(
            [
                f"Thêm 1 bác sĩ cho {top}",
                "Dời bệnh nhân không khẩn cấp sang khung giờ thấp tải",
                "Mở thêm bàn khám tạm trong 2 giờ tới",
            ]
        )
        actions.extend(
            [
                "kích hoạt red-zone staffing",
                "điều phối bệnh nhân sang khoa yellow/green",
            ]
        )
    elif yellow:
        recommendations.extend(
            [
                "Theo dõi sát khoa yellow mỗi 15 phút",
                "Ưu tiên xử lý hồ sơ đã đủ xét nghiệm trước",
            ]
        )
        actions.append("preemptive staffing")
    else:
        recommendations.append("Hệ thống ổn định, duy trì nhân sự hiện tại")
        actions.append("monitor")

    return {
        "overloaded_departments": overloaded_departments,
        "recommendations": recommendations,
        "actions": actions,
        "yellow_departments": [d["department"] for d in yellow],
    }
