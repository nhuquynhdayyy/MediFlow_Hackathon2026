"""
Triage Agent Service - Agent 1
Wrap logic từ main.py gốc vào async service cho FastAPI.
"""
import httpx
import json
import logging
from typing import AsyncIterator

logger = logging.getLogger(__name__)

FPT_BASE_URL = "https://mkp-api.fptcloud.com"

TRIAGE_SYSTEM_PROMPT = """Bạn là MediFlow Triage Agent - Trợ lý y tế thông minh tại bệnh viện MediFlow.
Ngôn ngữ giao tiếp: Tiếng Việt, lịch sự, thân thiện, ngắn gọn.

=== NHIỆM VỤ CHÍNH ===
1. Lắng nghe triệu chứng → Phân loại mức độ → Gợi ý chuyên khoa phù hợp.
2. Hỗ trợ đặt lịch khám khi bệnh nhân yêu cầu (hỏi: khoa, thời gian, số điện thoại).
3. Trả lời câu hỏi về vị trí khoa/phòng, lịch làm việc dựa trên thông tin bệnh viện.

=== THÔNG TIN BỆNH VIỆN MEDIFLOW ===
- Khoa Tim mạch: Tầng 5, Khu A — Chỉ buổi Sáng
- Khoa Thần kinh: Tầng 4, Khu C — Sáng và Chiều
- Khoa Tiêu hóa: Tầng 2, Khu B — Sáng và Chiều
- Khoa Nhi: Tầng 3, Khu D — Sáng và Chiều
- Khoa Nội tổng quát: Tầng 1, Khu A — Sáng và Chiều
- Khoa Mắt: Tầng 2, Khu C — Sáng và Chiều
- Khoa Tai Mũi Họng: Tầng 3, Khu B — Sáng và Chiều
- Khoa Da liễu: Tầng 2, Khu D — Sáng và Chiều
- Bệnh viện KHÔNG làm việc buổi Tối và Đêm.

=== PHÂN LOẠI MỨC ĐỘ ===
🔴 MỨC 3 - NGUY KỊCH: Yêu cầu đến Cấp cứu NGAY (không đặt lịch).
   → đau ngực dữ dội, khó thở nghiêm trọng, mất ý thức, co giật, chảy máu không cầm, tai biến.

🟡 MỨC 2 - CẦN KHÁM: Gợi ý chuyên khoa + hỏi có muốn đặt lịch không.
   → triệu chứng kéo dài >2-3 ngày, sốt cao >38.5°C, ảnh hưởng sinh hoạt.

🟢 MỨC 1 - NHẸ: Hướng dẫn chăm sóc tại nhà, không gợi ý đi khám.
   → triệu chứng mới <1-2 ngày, nhẹ, chưa ảnh hưởng sinh hoạt.

=== QUY TẮC ===
- TUYỆT ĐỐI không kê đơn thuốc hoặc chẩn đoán tên bệnh cụ thể.
- Khi trả lời, nếu phát hiện mức độ nguy hiểm, hãy ghi rõ: [TRIAGE:3], [TRIAGE:2], hoặc [TRIAGE:1] ở đầu response.
- Ghi rõ khoa gợi ý: [DEPT:Tên khoa] nếu có gợi ý khoa.
- KHÔNG lặp lại lời giới thiệu mỗi tin nhắn."""


class TriageAgentService:
    async def chat_stream(self, message: str, history: list, api_key: str, model: str = "Llama-3.3-70B-Instruct"):
        """Streaming version của triage chat."""
        messages = [{"role": "system", "content": TRIAGE_SYSTEM_PROMPT}]
        for h in history[-10:]:
            # Vì h là ChatMessage object, phải dùng dấu chấm để truy cập thuộc tính
            messages.append({"role": h.role, "content": h.content}) 
        messages.append({"role": "user", "content": message})

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{FPT_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": 0.2, "max_tokens": 1024},
            )
            resp.raise_for_status()
            data = resp.json()

        raw = data["choices"][0]["message"]["content"]
        return self._parse_response(raw)

    async def chat_stream(
        self,
        message: str,
        history: list,
        api_key: str,
        model: str = "Llama-3.3-70B-Instruct",
    ) -> AsyncIterator[str]:
        """Streaming version của triage chat."""
        messages = [{"role": "system", "content": TRIAGE_SYSTEM_PROMPT}]
        for h in history[-10:]:
            messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": message})

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{FPT_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "stream": True, "temperature": 0.2},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data["choices"][0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            pass

    def _parse_response(self, raw: str) -> dict:
        """Trích xuất metadata từ response text."""
        triage_level = None
        suggested_department = None
        action = None

        if "[TRIAGE:3]" in raw:
            triage_level = 3
            action = "emergency"
        elif "[TRIAGE:2]" in raw:
            triage_level = 2
            action = "book_appointment"
        elif "[TRIAGE:1]" in raw:
            triage_level = 1
            action = "home_care"

        import re
        dept_match = re.search(r"\[DEPT:([^\]]+)\]", raw)
        if dept_match:
            suggested_department = dept_match.group(1).strip()

        # Xóa tags khỏi response hiển thị cho user
        clean = raw.replace("[TRIAGE:3]", "").replace("[TRIAGE:2]", "").replace("[TRIAGE:1]", "")
        clean = re.sub(r"\[DEPT:[^\]]+\]", "", clean).strip()

        return {
            "response": clean,
            "triage_level": triage_level,
            "suggested_department": suggested_department,
            "action": action,
        }
