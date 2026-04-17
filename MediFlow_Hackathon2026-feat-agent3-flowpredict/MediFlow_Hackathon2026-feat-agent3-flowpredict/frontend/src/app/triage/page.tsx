"use client";

import { useState, useRef, useEffect } from "react";
import { RiRobot2Fill, RiSendPlane2Fill, RiTimeLine } from "react-icons/ri";
import { FaUserCircle } from "react-icons/fa";
import { postPatientTriage, buildTriagePayload, TriageResult } from "@/services/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: TriageResult;
};

export default function TriagePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      content: "Chào bạn, tôi là AI Hướng dẫn của MediFlow. Tôi ở đây để sắp xếp lịch khám giúp bạn tiết kiệm thời gian nhất. Hôm nay bạn muốn khám gì hoặc có triệu chứng thế nào?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "Tôi bị đau nửa đầu và sốt cao từ tối qua",
    "Tôi muốn khám tổng quát và nhổ răng khôn",
    "Trẻ em khám nhi khoa thì đi đâu nhanh nhất?"
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Chuẩn bị lịch sử chat cho backend
      const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));
      historyForApi.push({ role: "user", content: text });
      
      const payload = buildTriagePayload(historyForApi, [], []);
      const response = await postPatientTriage(payload);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.data.patient_plan, // Lời giải thích từ AI
        result: response.data
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Xin lỗi, đã có lỗi kết nối đến hệ thống AI."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 rounded-tl-3xl shadow-sm border-l border-neutral-200 dark:border-neutral-800 relative">
      {/* Header */}
      <div className="h-16 flex-shrink-0 border-b border-neutral-100 dark:border-neutral-800 flex items-center px-6 justify-between bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <RiRobot2Fill size={18} />
          </div>
          <div>
            <h2 className="font-bold text-neutral-800 dark:text-neutral-100 leading-tight">Patient AI Navigator</h2>
            <p className="text-[11px] text-neutral-500 font-medium">Bác sĩ tư vấn & Sắp xếp lộ trình</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-4 max-w-3xl ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1
              ${msg.role === 'user' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400' : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md'}`}>
              {msg.role === 'user' ? <FaUserCircle size={20} /> : <RiRobot2Fill size={16} />}
            </div>
            
            <div className="flex flex-col gap-2">
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm shadow-sm'
                  : 'bg-neutral-50 border border-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-tl-sm shadow-sm'
              }`}>
                {msg.content}
              </div>

              {/* Nếu có route/timeline được suggest từ AI */}
              {msg.result && msg.result.route && msg.result.route.length > 0 && (
                <div className="bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl p-4 shadow-sm mt-1 w-[400px]">
                  <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    <RiTimeLine size={16} /> Lộ trình tối ưu ({msg.result.total_estimated_minutes} phút)
                  </div>
                  <div className="flex flex-col gap-0 relative">
                    <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-neutral-100 dark:bg-neutral-700 rounded-full"></div>
                    {msg.result.route.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2 relative">
                        <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-white dark:border-neutral-800 z-10 flex flex-col items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        </div>
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{step}</span>
                      </div>
                    ))}
                  </div>
                  {msg.result.bottleneck && (
                    <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 p-2 rounded-lg mt-3">
                      ⚠️ Điểm nóng: {msg.result.bottleneck.department} (Tải: {msg.result.bottleneck.load_pct}%)
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-4 max-w-3xl self-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md flex-shrink-0 flex items-center justify-center mt-1">
              <RiRobot2Fill size={16} />
            </div>
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 rounded-tl-sm shadow-sm flex items-center gap-1.5 h-[52px]">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 md:px-6 md:py-5 border-t border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map((sug, idx) => (
            <button 
              key={idx} 
              onClick={() => handleSend(sug)}
              className="text-xs font-medium bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 py-1.5 px-3 rounded-full transition-colors"
            >
              {sug}
            </button>
          ))}
        </div>
        
        <form 
          className="relative flex items-center"
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Nhập triệu chứng hoặc khoa bạn muốn khám..."
            className="w-full pl-5 pr-12 py-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all dark:text-white"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            <RiSendPlane2Fill size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
