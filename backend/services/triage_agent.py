"""
Triage Agent Service - Agent 1 — FIXED VERSION
"""
import httpx
import json
import logging
import re
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
🟡 MỨC 2 - CẦN KHÁM: Gợi ý chuyên khoa + hỏi có muốn đặt lịch không.
🟢 MỨC 1 - NHẸ: Hướng dẫn chăm sóc tại nhà, không gợi ý đi khám.

=== QUY TẮC ===
- TUYỆT ĐỐI không kê đơn thuốc hoặc chẩn đoán tên bệnh cụ thể.
- Ghi rõ mức độ: [TRIAGE:3], [TRIAGE:2], hoặc [TRIAGE:1] ở đầu response.
- Ghi rõ khoa gợi ý: [DEPT:Tên khoa] nếu có.
- KHÔNG lặp lại lời giới thiệu mỗi tin nhắn.

=== ĐẶT LỊCH KHÁM ===
Khi bệnh nhân ĐỒNG Ý đặt lịch và ĐÃ CUNG CẤP ĐỦ thông tin (khoa, thời gian, số điện thoại), hãy:
1. Ghi tag: [BOOK:Tên khoa|Ngày (YYYY-MM-DD)|Buổi (Sáng/Chiều)|SĐT]
2. Ví dụ: [BOOK:Khoa Tiêu hóa|2026-04-18|Sáng|0901234567]
3. Chỉ ghi tag [BOOK:...] khi ĐỦ 4 thông tin. Nếu thiếu, hỏi thêm.
4. Nếu bệnh nhân chưa nói ngày cụ thể (ví dụ "ngày mai"), tự suy ra ngày chính xác."""


def _normalize_history(history: list) -> list:
    """
    FIX: Chuẩn hóa history từ nhiều dạng input khác nhau.
    Hỗ trợ: list[dict], list[ChatMessage pydantic], list[object có .role/.content]
    Lọc ra các field không hợp lệ để tránh API reject.
    Đảm bảo không có 2 message cùng role liên tiếp (API requirement của một số model).
    """
    normalized = []
    for h in history:
        # Hỗ trợ cả dict lẫn pydantic model
        if isinstance(h, dict):
            role    = h.get("role", "")
            content = h.get("content", "")
        else:
            role    = getattr(h, "role", "")
            content = getattr(h, "content", "")

        role    = str(role).strip()
        content = str(content).strip()

        # Chỉ giữ role hợp lệ
        if role not in ("user", "assistant"):
            continue
        if not content:
            continue

        # FIX: Tránh 2 message cùng role liên tiếp (gây lỗi một số LLM endpoint)
        if normalized and normalized[-1]["role"] == role:
            # Merge vào message trước đó
            normalized[-1]["content"] += "\n" + content
        else:
            normalized.append({"role": role, "content": content})

    return normalized


class TriageAgentService:

    def _build_messages(self, message: str, history: list) -> list:
        """Build message list với system prompt + history đã normalize."""
        messages = [{"role": "system", "content": TRIAGE_SYSTEM_PROMPT}]
        # FIX: normalize history trước khi dùng
        normalized = _normalize_history(history)
        # Chỉ lấy 10 lượt gần nhất
        for h in normalized[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
        messages.append({"role": "user", "content": message})
        return messages

    def _parse_response(self, raw: str) -> dict:
        triage_level = None
        suggested_department = None
        action = None
        if "[TRIAGE:3]" in raw:
            triage_level = 3; action = "emergency"
        elif "[TRIAGE:2]" in raw:
            triage_level = 2; action = "book_appointment"
        elif "[TRIAGE:1]" in raw:
            triage_level = 1; action = "home_care"
        dept_match = re.search(r"\[DEPT:([^\]]+)\]", raw)
        if dept_match:
            suggested_department = dept_match.group(1).strip()
        # Parse booking data
        booking_data = None
        book_match = re.search(r"\[BOOK:([^\]]+)\]", raw)
        if book_match:
            parts = book_match.group(1).split('|')
            if len(parts) >= 4:
                booking_data = {
                    "department": parts[0].strip(),
                    "scheduled_date": parts[1].strip(),
                    "scheduled_time": parts[2].strip(),
                    "patient_phone": parts[3].strip(),
                }
                action = "confirm_booking"
        clean = re.sub(r"\[TRIAGE:\d\]", "", raw)
        clean = re.sub(r"\[DEPT:[^\]]+\]", "", clean)
        clean = re.sub(r"\[BOOK:[^\]]+\]", "", clean).strip()
        return {
            "response": clean,
            "triage_level": triage_level,
            "suggested_department": suggested_department,
            "action": action,
            "booking_data": booking_data,
        }

    async def chat(self, message: str, history: list, api_key: str,
                   model: str = "Llama-3.3-70B-Instruct") -> dict:
        """Non-streaming chat cho /api/triage/chat"""
        messages = self._build_messages(message, history)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{FPT_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 1024,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        raw = data["choices"][0]["message"]["content"]
        return self._parse_response(raw)

    async def chat_stream(self, message: str, history: list, api_key: str,
                          model: str = "Llama-3.3-70B-Instruct") -> AsyncIterator[str]:
        """Streaming chat cho /api/triage/chat/stream"""
        messages = self._build_messages(message, history)
        # FIX: Tăng timeout cho streaming (request dài hơn non-streaming)
        async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10, read=120, write=10, pool=10)) as client:
            async with client.stream(
                "POST",
                f"{FPT_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "temperature": 0.2,
                    # FIX: Thêm max_tokens cho streaming (một số endpoint cần thiết)
                    "max_tokens": 1024,
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            # FIX: Kiểm tra cấu trúc response trước khi access
                            choices = data.get("choices", [])
                            if not choices:
                                continue
                            delta = choices[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            # Bỏ qua các dòng không parse được
                            logger.debug(f"[Stream] Unparseable line: {data_str[:80]}")
                        except Exception as e:
                            logger.warning(f"[Stream] Unexpected error: {e}")