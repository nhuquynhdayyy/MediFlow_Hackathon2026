import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader, Wand2, Stethoscope, FlaskConical, FileText, Pill } from 'lucide-react'
import { useStore } from '../store'
import { docChatStream, aiDiagnosis, aiTreatment, aiPrescription, aiLabSuggestions } from '../services/api'

const AI_ACTIONS = [
  { key: 'diagnosis',    label: 'Chẩn đoán',    icon: <Stethoscope size={13} />, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
  { key: 'treatment',    label: 'Điều trị',      icon: <Wand2 size={13} />,       color: 'text-sky-600 bg-sky-50 hover:bg-sky-100' },
  { key: 'prescription', label: 'Đơn thuốc',     icon: <Pill size={13} />,        color: 'text-teal-600 bg-teal-50 hover:bg-teal-100' },
  { key: 'lab',          label: 'Xét nghiệm',    icon: <FlaskConical size={13} />, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
]

export default function AIChatPanel() {
  const { apiKey, model, docMessages, addDocMessage, docLoading, setDocLoading,
          selectedPatient, emrData, setAiResult } = useStore()
  const [input, setInput]         = useState('')
  const [streaming, setStreaming]  = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [docMessages, streaming])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || docLoading) return
    if (!apiKey) { alert('Vui lòng nhập API Key'); return }

    setInput('')
    addDocMessage({ role: 'user', content: msg })
    setDocLoading(true)
    setStreaming('')

    let acc = ''
    await docChatStream(
      msg, apiKey, model,
      (chunk) => { acc += chunk; setStreaming(acc) },
      () => {
        setStreaming('')
        setDocLoading(false)
        addDocMessage({ role: 'assistant', content: acc })
      },
      (err) => {
        setStreaming('')
        setDocLoading(false)
        addDocMessage({ role: 'assistant', content: `⚠️ ${err}`, isError: true })
      },
    )
  }

  const runAiAction = async (actionKey) => {
    if (!selectedPatient || !apiKey) {
      alert(!apiKey ? 'Vui lòng nhập API Key' : 'Chọn bệnh nhân trước')
      return
    }
    const ctx = { ...selectedPatient, ...emrData }
    const prompt = `Bệnh nhân: ${selectedPatient.name}, ${selectedPatient.age} tuổi
Triệu chứng: ${emrData.symptoms || selectedPatient.symptoms}
Tiền sử: ${emrData.medical_history || selectedPatient.medical_history}`

    setActionLoading(actionKey)
    try {
      let r
      if (actionKey === 'diagnosis')    r = await aiDiagnosis(prompt, ctx, apiKey, model)
      if (actionKey === 'treatment')    r = await aiTreatment(prompt, ctx, apiKey, model)
      if (actionKey === 'prescription') r = await aiPrescription(prompt, ctx, apiKey, model)
      if (actionKey === 'lab')          r = await aiLabSuggestions(prompt, ctx, apiKey, model)

      const resultKey = actionKey === 'lab' ? 'labResult' :
                        actionKey + 'Result'
      setAiResult(resultKey, r.result)
      addDocMessage({
        role: 'assistant',
        content: r.result,
        actionType: actionKey,
      })
    } catch (e) {
      addDocMessage({ role: 'assistant', content: `⚠️ Lỗi: ${e.message}`, isError: true })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-slate-100 bg-white">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Bot size={15} className="text-teal-500" />
          DocAssist AI Chat
        </h3>
        {/* Quick AI action buttons */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {AI_ACTIONS.map(a => (
            <button
              key={a.key}
              onClick={() => runAiAction(a.key)}
              disabled={!!actionLoading}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${a.color} disabled:opacity-50`}
            >
              {actionLoading === a.key ? <Loader size={11} className="animate-spin" /> : a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {docMessages.length === 0 && !streaming && (
          <div className="text-center text-slate-400 text-xs py-8">
            <Bot size={28} className="mx-auto mb-2 opacity-30" />
            Hỏi DocAssist AI hoặc nhấn nút gợi ý nhanh ở trên
          </div>
        )}
        {docMessages.map((m, i) => (
          <div key={i} className={`flex gap-2 fade-in-up ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-sky-500 flex items-center justify-center flex-none">
                <Bot size={12} className="text-white" />
              </div>
            )}
            <div className={`rounded-xl px-3 py-2 text-xs max-w-full leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-teal-500 text-white rounded-tr-sm'
                : m.isError
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-slate-50 text-slate-700 border border-slate-200 rounded-tl-sm'
            }`}>
              {m.content}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-none">
                <User size={12} className="text-slate-500" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming */}
        {streaming && (
          <div className="flex gap-2 fade-in-up">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-sky-500 flex items-center justify-center flex-none">
              <Bot size={12} className="text-white" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed streaming-cursor max-w-full">
              {streaming}
            </div>
          </div>
        )}

        {docLoading && !streaming && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-sky-500 flex items-center justify-center">
              <Bot size={12} className="text-white" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-none border-t border-slate-100 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Hỏi DocAssist..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || docLoading}
            className="w-8 h-8 rounded-lg bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
