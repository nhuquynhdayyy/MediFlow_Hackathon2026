import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Mic, MicOff, Trash2, AlertTriangle, Calendar, Home, Bot, User
} from 'lucide-react'
import { useStore } from '../store'
import { triageChatStream } from '../services/api'
import { useVoice } from '../hooks/useVoice'

const LEVEL_CONFIG = {
  3: { label: '🔴 NGUY KỊCH', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: <AlertTriangle size={14} /> },
  2: { label: '🟡 CẦN KHÁM', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <Calendar size={14} /> },
  1: { label: '🟢 THEO DÕI', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: <Home size={14} /> },
}

const QUICK_PROMPTS = [
  'Tôi bị đau bụng 3 ngày nay',
  'Đau đầu dữ dội, sốt cao 39°C',
  'Ho nhẹ, sổ mũi từ hôm qua',
  'Đau tức ngực, khó thở',
  'Muốn đặt lịch khám tiêu hóa',
  'Khoa tim mạch ở đâu?',
]

export default function TriagePage() {
  const { apiKey, model, triageMessages, addTriageMessage, triageLoading,
          setTriageLoading, triageSession, setTriageSession, clearTriage } = useStore()

  const [input, setInput] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const { isRecording, transcript, start: startRec, stop: stopRec, reset: resetRec, supported: voiceSupported } =
    useVoice({ onTranscriptUpdate: (t) => setInput(t) })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [triageMessages, streamingText])

  const send = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || triageLoading) return
    if (!apiKey) {
      alert('Vui lòng nhập FPT API Key trong phần Cài đặt.')
      return
    }

    resetRec()
    setInput('')
    setStreamingText('')

    const userMsg = { role: 'user', content: msg }
    addTriageMessage(userMsg)
    setTriageLoading(true)

    let accumulated = ''
    let sessionId = triageSession

    await triageChatStream(
      msg,
      triageMessages.slice(-10).map(({ role, content }) => ({ role, content })),
      apiKey,
      model,
      // onChunk
      (chunk) => {
        accumulated += chunk
        setStreamingText(accumulated)
      },
      // onDone
      () => {
        setStreamingText('')
        setTriageLoading(false)
        if (!sessionId) {
          sessionId = Date.now().toString()
          setTriageSession(sessionId)
        }
        // Parse triage level from accumulated text
        let level = null, dept = null, action = null
        if (accumulated.includes('[TRIAGE:3]')) { level = 3; action = 'emergency' }
        else if (accumulated.includes('[TRIAGE:2]')) { level = 2; action = 'book' }
        else if (accumulated.includes('[TRIAGE:1]')) { level = 1; action = 'home' }
        const deptMatch = accumulated.match(/\[DEPT:([^\]]+)\]/)
        if (deptMatch) dept = deptMatch[1]
        const clean = accumulated
          .replace(/\[TRIAGE:\d\]/g, '')
          .replace(/\[DEPT:[^\]]+\]/g, '')
          .trim()
        addTriageMessage({ role: 'assistant', content: clean, triageLevel: level, department: dept, action })
      },
      // onError
      (err) => {
        setStreamingText('')
        setTriageLoading(false)
        addTriageMessage({ role: 'assistant', content: `⚠️ Lỗi: ${err}`, isError: true })
      },
    )
  }, [input, apiKey, model, triageMessages, triageLoading, triageSession,
      addTriageMessage, setTriageLoading, setTriageSession, resetRec])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="flex h-full">
      {/* ── Sidebar: Quick prompts ── */}
      <aside className="w-60 flex-none bg-white border-r border-slate-200 flex flex-col p-4 gap-3 overflow-y-auto">
        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Gợi ý nhanh</h2>
          <div className="flex flex-col gap-1.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-left text-xs text-slate-600 hover:text-sky-600 hover:bg-sky-50 px-2.5 py-2 rounded-lg transition-colors leading-snug"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-3 border-t border-slate-100">
          <div className="bg-sky-50 rounded-xl p-3 text-xs text-sky-700 space-y-1">
            <div className="font-semibold">Phân loại mức độ:</div>
            <div>🔴 Nguy kịch → Cấp cứu</div>
            <div>🟡 Cần khám → Đặt lịch</div>
            <div>🟢 Nhẹ → Theo dõi nhà</div>
          </div>
        </div>
      </aside>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100">
          <div>
            <h1 className="font-semibold text-slate-800">Agent 1 · Triage & Navigation</h1>
            <p className="text-xs text-slate-400">Phân loại triệu chứng, điều hướng và đặt lịch khám</p>
          </div>
          <button
            onClick={clearTriage}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
          >
            <Trash2 size={13} />
            Xoá chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {triageMessages.length === 0 && !streamingText && (
            <WelcomeScreen />
          )}

          {triageMessages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {/* Streaming */}
          {streamingText && (
            <div className="flex gap-3 fade-in-up">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 flex-none flex items-center justify-center">
                <Bot size={15} className="text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl shadow-sm">
                <p className="text-sm text-slate-700 whitespace-pre-wrap streaming-cursor">
                  {streamingText
                    .replace(/\[TRIAGE:\d\]/g, '')
                    .replace(/\[DEPT:[^\]]+\]/g, '')}
                </p>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {triageLoading && !streamingText && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 flex-none flex items-center justify-center">
                <Bot size={15} className="text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                  <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                  <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input box */}
        <div className="flex-none border-t border-slate-200 bg-white px-6 py-4">
          {isRecording && (
            <div className="mb-2 flex items-center gap-2 text-xs text-red-500">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Đang ghi âm... nhấn Stop để dừng
            </div>
          )}
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder="Mô tả triệu chứng của bạn... (Enter để gửi)"
              className="flex-1 resize-none border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.5' }}
            />
            {voiceSupported && (
              <button
                onClick={isRecording ? stopRec : startRec}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-none ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
            <button
              onClick={() => send()}
              disabled={!input.trim() || triageLoading}
              className="w-10 h-10 rounded-xl bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-none"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const levelConf = msg.triageLevel ? LEVEL_CONFIG[msg.triageLevel] : null

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end fade-in-up">
        <div className="bg-sky-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-xl shadow-sm">
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 flex-none flex items-center justify-center">
          <User size={15} className="text-slate-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 fade-in-up">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 flex-none flex items-center justify-center">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex flex-col gap-2 max-w-2xl">
        {/* Triage badge */}
        {levelConf && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${levelConf.bg} ${levelConf.border} ${levelConf.text} w-fit`}>
            {levelConf.icon}
            {levelConf.label}
            {msg.department && ` · ${msg.department}`}
          </div>
        )}
        <div className={`border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm ${
          msg.isError ? 'bg-red-50 border-red-200' :
          msg.triageLevel === 3 ? 'bg-red-50 border-red-100' :
          'bg-white border-slate-200'
        }`}>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-lg">
        <Bot size={28} className="text-white" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-800">Xin chào! Tôi là MediFlow Triage Agent</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md">
          Hãy mô tả triệu chứng của bạn. Tôi sẽ đánh giá mức độ, gợi ý chuyên khoa phù hợp và hỗ trợ đặt lịch khám.
        </p>
      </div>
      <div className="flex gap-3 mt-2">
        {['🔴 Nguy kịch', '🟡 Cần khám', '🟢 Nhẹ'].map(l => (
          <span key={l} className="text-xs px-3 py-1.5 bg-slate-100 rounded-full text-slate-600">{l}</span>
        ))}
      </div>
    </div>
  )
}
