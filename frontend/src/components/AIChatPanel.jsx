import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { streamChat } from '../services/api'
import { toast } from 'react-hot-toast'
import { Send, Loader2, Sparkles, Trash2 } from 'lucide-react'

const QUICK = [
  'Phân tích triệu chứng bệnh nhân',
  'Kiểm tra tương tác thuốc',
  'Phác đồ theo Bộ Y tế VN',
  'Tiêu chuẩn nhập viện ngay?',
]

export default function AIChatPanel() {
  const { activePatient, emr, chatMessages, addChatMessage, clearChat } = useStore()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const buildContext = () =>
    `Bệnh nhân: ${activePatient?.name||'Chưa chọn'}, ${activePatient?.age||''} tuổi\n` +
    `Lý do: ${emr.chief_complaint}\nTriệu chứng: ${emr.symptoms}\n` +
    `Tiền sử: ${emr.history}\nChẩn đoán: ${emr.diagnosis||'Chưa có'}\n` +
    `Thuốc đang dùng: ${activePatient?.current_medications?.join(', ')||'Không có'}`

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')
    addChatMessage({ role: 'user', text: msg })
    setStreaming(true)
    const id = `ai-${Date.now()}-${Math.random()}`
    addChatMessage({ role: 'assistant', text: '', id, streaming: true })

    const systemPrompt =
      `Bạn là DocAssist — trợ lý AI lâm sàng cho bác sĩ Việt Nam.\n` +
      `Trả lời chuyên sâu, theo phác đồ Bộ Y tế Việt Nam.\nNgữ cảnh:\n${buildContext()}`

    try {
      let acc = ''
      // Không gửi api_key — backend tự lấy từ .env
      for await (const chunk of streamChat({ system_prompt: systemPrompt, user_message: msg })) {
        acc += chunk
        useStore.getState().updateChatMessage(id, acc)
      }
      useStore.getState().finishChatMessage(id)
    } catch (e) {
      useStore.getState().updateChatMessage(id, `Lỗi: ${e.message}`)
      useStore.getState().finishChatMessage(id)
    } finally { setStreaming(false) }
  }, [input, activePatient, emr, addChatMessage])

  return (
    <aside className="w-72 border-l border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
      <div className="px-3 py-2.5 border-b border-gray-100 bg-blue-50 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-blue-800 flex items-center gap-1.5"><Sparkles size={12} /> DocAssist AI</div>
            <div className="text-xs text-blue-500 mt-0.5">Trợ lý lâm sàng · FPT AI</div>
          </div>
          <button onClick={clearChat} className="text-blue-300 hover:text-blue-500 transition"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {chatMessages.length === 0 && (
          <div className="text-xs text-gray-400 leading-relaxed">
            <span className="block font-medium text-gray-600 mb-1.5">Xin chào Bác sĩ!</span>
            Tôi có thể gợi ý chẩn đoán, phác đồ điều trị, kiểm tra tương tác thuốc, tra cứu phác đồ Bộ Y tế.
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={msg.id||i} className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.role==='user' ? 'bg-teal-50 text-teal-800 ml-6' : 'bg-gray-50 text-gray-700'}`}>
            {msg.text
              ? <MiniMD text={msg.text} />
              : <span className="flex items-center gap-1.5 text-gray-400"><Loader2 size={11} className="spin" />Đang suy nghĩ...</span>
            }
            {msg.streaming && msg.text && <span className="inline-block w-0.5 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle" />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-2 pb-1.5 flex flex-wrap gap-1 shrink-0">
        {QUICK.map(q => (
          <button key={q} onClick={()=>send(q)} disabled={streaming}
            className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-100 rounded-lg px-2 py-1 transition disabled:opacity-40">
            {q.length>22 ? q.slice(0,22)+'…' : q}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 p-2 border-t border-gray-100 shrink-0">
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!streaming){e.preventDefault();send()}}}
          placeholder="Hỏi AI về bệnh nhân..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-teal-400 transition bg-white" />
        <button onClick={()=>send()} disabled={!input.trim()||streaming}
          className="bg-teal-400 hover:bg-teal-600 disabled:opacity-40 text-white rounded-lg px-2.5 transition">
          {streaming ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
        </button>
      </div>
    </aside>
  )
}

function MiniMD({ text }) {
  if (!text) return null
  return (
    <div>
      {text.split('\n').map((line, i) => {
        if (!line) return <div key={i} className="h-1.5" />
        if (line.startsWith('### ')) return <div key={i} className="font-medium text-gray-800 mt-1">{RI(line.slice(4))}</div>
        if (line.startsWith('## '))  return <div key={i} className="font-semibold text-gray-900 mt-1">{RI(line.slice(3))}</div>
        if (line.match(/^[-•*]\s/))  return <div key={i} className="ml-2">• {RI(line.slice(2))}</div>
        return <div key={i}>{RI(line)}</div>
      })}
    </div>
  )
}
function RI(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((p,i)=>
    p.startsWith('**')&&p.endsWith('**') ? <strong key={i} className="font-medium text-gray-900">{p.slice(2,-2)}</strong> : p
  )
}
