from app.services.load_predictor import get_current_load_by_specialty, build_forecast_points, estimate_wait_time
from app.services.route_optimizer import compute_department_sequence

def evaluate_now_vs_later(departments: list[str]) -> dict:
    """
    So sánh tổng thời gian khám bây giờ vs. thời gian khám vào lúc khác.
    """
    # Build list of dict depts
    current_loads = get_current_load_by_specialty()
    dept_map = {d["department"]: d for d in current_loads}
    
    # NOW route
    now_depts = []
    for name in departments:
        if name in dept_map:
            now_depts.append(dept_map[name])
        else:
            now_depts.append({
                "department": name,
                "current_load": 0, "capacity": 50, "load_pct": 30, "wait_time": 10, "floor": 1
            })
            
    now_result = compute_department_sequence(now_depts)
    now_total_wait = now_result["total_estimated_minutes"]
    
    # LATER (giả lập 2 giờ sau)
    forecasts = build_forecast_points()
    # Tìm load trung bình 2h sau
    if len(forecasts) >= 3:
        later_load_pct = forecasts[2]["predicted_load_pct"]
    else:
        later_load_pct = 50.0
        
    later_depts = []
    for d in now_depts:
        load = (d["load_pct"] + later_load_pct) / 2
        wait = estimate_wait_time(load)
        later_depts.append(dict(d, load_pct=load, wait_time=wait))
        
    later_result = compute_department_sequence(later_depts)
    later_total_wait = later_result["total_estimated_minutes"]
    
    # Kết luận
    if later_total_wait < now_total_wait - 15:
        recommend = "later"
        reason = f"Bây giờ rất đông (chờ ~{now_total_wait}p). Nếu chờ thêm 2 tiếng, bạn chỉ còn mất ~{later_total_wait}p để khám toàn bộ."
    else:
        recommend = "now"
        reason = f"Bạn nên đi ngay. Tổng thời gian khoảng {now_total_wait} phút. Đi trễ hơn có thể đông hơn."
        
    return {
        "status": "success",
        "message": "So sánh thành công",
        "data": {
            "recommendation": recommend,
            "reasoning": reason,
            "now_route": {
                "route": now_result["route"],
                "total_time": now_total_wait
            },
            "later_route": {
                "route": later_result["route"],
                "time_offset_hours": 2,
                "total_time": later_total_wait
            }
        }
    }
