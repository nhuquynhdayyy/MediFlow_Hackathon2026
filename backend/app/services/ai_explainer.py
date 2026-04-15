from __future__ import annotations

from typing import Dict, List

from app.services.fpt_ai import generate_text


def explain_route(optimal_route: List[str], estimated_time: float, alternative_time: float) -> List[str]:
    if not optimal_route:
        return ["Không có route khả dụng tại thời điểm này."]

    saving = round(max(0.0, alternative_time - estimated_time), 1)
    fallback = [
        f"Route ưu tiên đi theo thứ tự {' → '.join(optimal_route)} để tôn trọng ràng buộc y khoa.",
        "Thuật toán đã cộng thời gian chờ + thời gian xử lý + thời gian di chuyển giữa khoa.",
        f"Phương án tối ưu hiện tiết kiệm khoảng {saving} phút so với route thay thế.",
    ]
    prompt = (
        "Bạn là AI giải thích điều phối bệnh viện.\n"
        f"Lộ trình tối ưu: {' -> '.join(optimal_route)}\n"
        f"Tổng thời gian phương án tối ưu: {estimated_time} phút\n"
        f"Tổng thời gian phương án thay thế: {alternative_time} phút\n"
        f"Tiết kiệm: {saving} phút\n"
        "Hãy trả về đúng 3 gạch đầu dòng, ngắn gọn, dễ hiểu cho bệnh nhân bằng tiếng Việt."
    )
    try:
        text = generate_text(prompt, temperature=0.2, max_tokens=220)
        lines = [line.strip("-• \t") for line in text.splitlines() if line.strip()]
        if len(lines) >= 2:
            return lines[:3]
    except Exception:
        pass
    return fallback


def explain_overload(overloaded_departments: List[str], peak_hours: List[str]) -> Dict:
    fallback: str
    if overloaded_departments:
        fallback = (
            f"Hệ thống ghi nhận quá tải tại {', '.join(overloaded_departments[:3])}. "
            f"Giờ cao điểm gần nhất: {', '.join(peak_hours[:2])}."
        )
    else:
        fallback = "Hiện chưa có khoa vượt ngưỡng đỏ. Tiếp tục theo dõi tải theo thời gian thực."

    prompt = (
        "Bạn là trợ lý vận hành bệnh viện.\n"
        f"Khoa quá tải: {', '.join(overloaded_departments) if overloaded_departments else 'Không có'}\n"
        f"Giờ cao điểm: {', '.join(peak_hours) if peak_hours else 'Chưa xác định'}\n"
        "Trả về 1-2 câu tiếng Việt nêu nhận định ngắn gọn và hành động ưu tiên."
    )
    try:
        message = generate_text(prompt, temperature=0.2, max_tokens=120).strip()
        if message:
            return {"reasoning": message}
    except Exception:
        pass
    return {"reasoning": fallback}
