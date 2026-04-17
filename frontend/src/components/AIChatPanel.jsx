import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { streamChat } from '../services/api'
import { Send, Loader2, Sparkles, Trash2 } from 'lucide-react'

const QUICK = [
  'Phan tich trieu chung benh nhan',
  'Kiem tra tuong tac thuoc',
  'Phac do theo Bo Y te VN',
  'Tieu chuan nhap vien ngay?',
]

export default function AIChatPanel() {
  const { activePatient, emr, chatMessages, addChatMessage, clearChat } = useStore()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const buildContext = () =>
    `Benh nhan: ${activePatient?.name || 'Chua chon'}, ${activePatient?.age || ''} tuoi\n` +
    `Ly do: ${emr.chief_complaint}\nTrieu chung: ${emr.symptoms}\n` +
    `Tien su: ${emr.history}\nChan doan: ${emr.diagnosis || 'Chua co'}\n` +
    `Thuoc dang dung: ${activePatient?.current_medications?.join(', ') || 'Khong co'}`

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')
    addChatMessage({ role: 'user', text: msg })
    setStreaming(true)
    const id = `ai-${Date.now()}-${Math.random()}`
    addChatMessage({ role: 'assistant', text: '', id, streaming: true })

    const systemPrompt =
      `Ban la DocAssist - tro ly AI lam sang cho bac si Viet Nam.\n` +
      `Tra loi chuyen sau, theo phac do Bo Y te Viet Nam.\nNgu canh:\n${buildContext()}`

    try {
      let acc = ''
      for await (const chunk of streamChat({ system_prompt: systemPrompt, user_message: msg })) {
        acc += chunk
        useStore.getState().updateChatMessage(id, acc)
      }
      useStore.getState().finishChatMessage(id)
    } catch (e) {
      useStore.getState().updateChatMessage(id, `Loi: ${e.message}`)
      useStore.getState().finishChatMessage(id)
    } finally {
      setStreaming(false)
    }
  }, [input, activePatient, emr, addChatMessage])

  return (
    <aside className="w-[380px] panel-shell rounded-[28px] flex flex-col overflow-hidden shrink-0">
      <div className="px-4 py-4 border-b border-slate-100 bg-gradient-to-b from-white to-sky-50 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-sky-900 flex items-center gap-1.5"><Sparkles size={14} /> DocAssist AI</div>
            <div className="text-xs text-sky-600 mt-0.5">Tu van lam sang theo ngu canh EMR hien tai</div>
          </div>
          <button onClick={clearChat} className="text-sky-300 hover:text-sky-500 transition"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/60">
        {chatMessages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-4 text-xs text-gray-400 leading-relaxed">
            <span className="block font-medium text-gray-700 mb-1.5">Clinical copilot</span>
            Dat cau hoi ve chan doan, dieu tri, tuong tac thuoc, nhap vien, can lam sang va tom tat nhanh theo ho so dang mo.
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <div key={msg.id || i} className={`rounded-2xl px-3.5 py-3 text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-gradient-to-br from-teal-50 to-white text-teal-900 ml-8 border border-teal-100' : 'bg-white text-gray-700 border border-slate-100'}`}>
            {msg.text
              ? <MiniMD text={msg.text} />
              : <span className="flex items-center gap-1.5 text-gray-400"><Loader2 size={11} className="spin" />Dang suy nghi...</span>
            }
            {msg.streaming && msg.text && <span className="inline-block w-0.5 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle" />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
        {QUICK.map(q => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={streaming}
            className="text-xs bg-white hover:bg-slate-50 text-gray-600 border border-slate-100 rounded-xl px-2.5 py-1.5 transition disabled:opacity-40 shadow-sm"
          >
            {q.length > 22 ? q.slice(0, 22) + '...' : q}
          </button>
        ))}
      </div>

      <div className="flex gap-2 p-3 border-t border-slate-100 shrink-0 bg-white/80">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !streaming) { e.preventDefault(); send() } }}
          placeholder="Hoi AI ve benh nhan..."
          className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-teal-400 transition bg-white"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || streaming}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl px-3 transition shadow-sm"
        >
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
        if (line.startsWith('## ')) return <div key={i} className="font-semibold text-gray-900 mt-1">{RI(line.slice(3))}</div>
        if (line.match(/^[-•*]\s/)) return <div key={i} className="ml-2">• {RI(line.slice(2))}</div>
        return <div key={i}>{RI(line)}</div>
      })}
    </div>
  )
}

function RI(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-medium text-gray-900">{p.slice(2, -2)}</strong> : p
  )
}
