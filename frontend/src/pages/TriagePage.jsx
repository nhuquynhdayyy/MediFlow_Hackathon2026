import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Mic, MicOff, Trash2, AlertTriangle, Calendar, Home, Bot, User, Radio
} from 'lucide-react'
import { useStore } from '../store'
import { triageChatStream, createAppointment } from '../services/api'
import { useVoice } from '../hooks/useVoice'
import { useConversationalVoice, VS } from '../hooks/useConversationalVoice'
import VoiceConversationOverlay from '../components/VoiceConversationOverlay'
import { QRCodeSVG } from 'qrcode.react'

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
  const {
    apiKey, model, triageMessages, addTriageMessage, triageLoading,
    setTriageLoading, triageSession, setTriageSession, clearTriage, user,
  } = useStore()

  const [checkinQR, setCheckinQR] = useState(null) // { appointment_id, department, date, time, phone }

  const [input, setInput] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [confirmedBookings, setConfirmedBookings] = useState(new Set())
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const { isRecording, transcript, start: startRec, stop: stopRec, reset: resetRec, supported: voiceSupported } =
    useVoice({ onTranscriptUpdate: (t) => setInput(t) })

  // ── historyRef: luôn sync ngay lập tức, không chờ re-render ──────────
  const historyRef = useRef([])

  // FIX: Wrapper sync cả store lẫn ref trong cùng một lần gọi
  const addMessageAndSync = useCallback((msg) => {
    // Cập nhật ref TRƯỚC để voice hook nhìn thấy ngay (không chờ render)
    historyRef.current = [...historyRef.current, msg]
    // Sau đó mới update store (async re-render)
    addTriageMessage(msg)
  }, [addTriageMessage])

  // FIX: Sync ref khi store thay đổi từ bên ngoài (vd: clearTriage reset về [])
  useEffect(() => {
    historyRef.current = triageMessages
  }, [triageMessages])

  // FIX: Preload voices ngay khi mount để TTS có giọng vi-VN sẵn sàng
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    // Warm up: Chrome lazy-load voices, cần trigger lần đầu
    synth.getVoices()
    const handleVoicesChanged = () => synth.getVoices()
    synth.addEventListener('voiceschanged', handleVoicesChanged)
    return () => synth.removeEventListener('voiceschanged', handleVoicesChanged)
  }, [])

  const {
    voiceState, liveTranscript, aiStreamText, amplitude,
    supported: convSupported,
    activate: activateVoice,
    deactivate: deactivateVoice,
  } = useConversationalVoice({
    apiKey,
    model,
    historyRef,
    onNewMessage: addMessageAndSync,
  })

  const isVoiceActive = voiceState !== VS.IDLE

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [triageMessages, streamingText])

  // ── Send (text chat) ──────────────────────────────────────────────
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
    addMessageAndSync(userMsg)
    setTriageLoading(true)

    let accumulated = ''
    let sessionId = triageSession

    // FIX: Lấy history từ ref (đã bao gồm userMsg vừa push) và loại bỏ message cuối
    // vì backend sẽ nhận message qua tham số riêng
    const historyForApi = historyRef.current
      .slice(0, -1)           // bỏ userMsg vừa push (tránh gửi 2 lần)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }))

    await triageChatStream(
      msg,
      historyForApi,
      apiKey,
      model,
      // onChunk
      (chunk) => {
        accumulated += chunk
        setStreamingText(
          accumulated
            .replace(/\[TRIAGE:\d\]/g, '')
            .replace(/\[DEPT:[^\]]+\]/g, '')
            .replace(/\[BOOK:[^\]]+\]/g, '')
        )
      },
      // onDone
      () => {
        setStreamingText('')
        setTriageLoading(false)
        if (!sessionId) {
          sessionId = Date.now().toString()
          setTriageSession(sessionId)
        }
        let level = null, dept = null, action = null
        if (accumulated.includes('[TRIAGE:3]')) { level = 3; action = 'emergency' }
        else if (accumulated.includes('[TRIAGE:2]')) { level = 2; action = 'book' }
        else if (accumulated.includes('[TRIAGE:1]')) { level = 1; action = 'home' }
        const deptMatch = accumulated.match(/\[DEPT:([^\]]+)\]/)
        if (deptMatch) dept = deptMatch[1]

        // Parse booking data từ AI response
        const bookMatch = accumulated.match(/\[BOOK:([^\]]+)\]/)
        let bookingData = null
        if (bookMatch) {
          const parts = bookMatch[1].split('|')
          if (parts.length >= 4) {
            bookingData = {
              department: parts[0].trim(),
              scheduled_date: parts[1].trim(),
              scheduled_time: parts[2].trim(),
              patient_phone: parts[3].trim(),
              triage_level: level,
            }
          }
        }

        const clean = accumulated
          .replace(/\[TRIAGE:\d\]/g, '')
          .replace(/\[DEPT:[^\]]+\]/g, '')
          .replace(/\[BOOK:[^\]]+\]/g, '')
          .trim()
        addMessageAndSync({ role: 'assistant', content: clean, triageLevel: level, department: dept, action, bookingData })
      },
      // onError
      (err) => {
        setStreamingText('')
        setTriageLoading(false)
        addMessageAndSync({ role: 'assistant', content: `⚠️ Lỗi: ${err}`, isError: true })
      },
    )
  }, [input, apiKey, model, triageLoading, triageSession,
    addMessageAndSync, setTriageLoading, setTriageSession, resetRec])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // ── Xác nhận đặt lịch từ nút trong chat ──
  const handleConfirmBooking = useCallback(async (bookingData, msgIndex) => {
    try {
      const res = await createAppointment({
        patient_uid: user?.uid || 'anonymous',
        patient_name: user?.email || 'Bệnh nhân',
        patient_phone: bookingData.patient_phone,
        department: bookingData.department,
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        triage_level: bookingData.triage_level,
        session_id: triageSession,
      })
      setConfirmedBookings(prev => new Set([...prev, msgIndex]))
      const apptId = res.appointment_id || 'N/A'
      addMessageAndSync({
        role: 'assistant',
        content: `✅ Đặt lịch thành công!\n📋 Mã lịch hẹn: ${apptId}\n🏥 ${bookingData.department}\n📅 ${bookingData.scheduled_time} ngày ${bookingData.scheduled_date}\n📞 SĐT: ${bookingData.patient_phone}`,
      })
      // Hiện QR Check-in
      setCheckinQR({
        appointment_id: apptId,
        department: bookingData.department,
        scheduled_date: bookingData.scheduled_date,
        scheduled_time: bookingData.scheduled_time,
        patient_phone: bookingData.patient_phone,
        patient_name: user?.email || '',
      })
    } catch (e) {
      addMessageAndSync({
        role: 'assistant',
        content: `⚠️ Lỗi đặt lịch: ${e.message || 'Không thể kết nối server'}`,
        isError: true,
      })
    }
  }, [user, triageSession, addMessageAndSync])

  const handleVoiceButton = () => {
    if (!apiKey) { alert('Vui lòng nhập FPT API Key trong phần Cài đặt.'); return }
    isVoiceActive ? deactivateVoice() : activateVoice()
  }

  return (
    <>
      {/* ── Voice Mode Overlay ── */}
      <VoiceConversationOverlay
        voiceState={voiceState}
        liveTranscript={liveTranscript}
        aiStreamText={aiStreamText}
        amplitude={amplitude}
        onClose={deactivateVoice}
      />

      <div className="flex h-full">
        {/* ── Sidebar ── */}
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

          {/* Voice mode entry in sidebar */}
          {convSupported && (
            <div className="border-t border-slate-100 pt-3">
              <button
                onClick={handleVoiceButton}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isVoiceActive
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-gradient-to-r from-sky-50 to-teal-50 text-sky-700 border border-sky-200 hover:from-sky-100 hover:to-teal-100'
                  }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-none ${isVoiceActive ? 'bg-red-500' : 'bg-gradient-to-br from-sky-500 to-teal-500'
                  }`}>
                  <Radio size={14} className={`text-white ${isVoiceActive ? 'animate-pulse' : ''}`} />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold leading-none mb-0.5">
                    {isVoiceActive ? 'Đang hội thoại' : 'Voice Mode'}
                  </div>
                  <div className="text-xs opacity-60 font-normal">
                    {isVoiceActive ? 'Nhấn để thoát' : 'Trò chuyện 2 chiều'}
                  </div>
                </div>
                {isVoiceActive && (
                  <span className="ml-auto flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1 h-1 bg-red-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </button>
            </div>
          )}

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
            <div className="flex items-center gap-2">
              {convSupported && (
                <button
                  onClick={handleVoiceButton}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isVoiceActive
                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-600'
                    }`}
                >
                  <Radio size={12} className={isVoiceActive ? 'animate-pulse' : ''} />
                  {isVoiceActive ? 'Voice đang bật' : 'Bật Voice'}
                </button>
              )}
              <button
                onClick={clearTriage}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
              >
                <Trash2 size={13} />
                Xoá chat
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {triageMessages.length === 0 && !streamingText && (
              <WelcomeScreen onActivateVoice={convSupported ? activateVoice : null} />
            )}

            {triageMessages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onBook={
                msg.bookingData && !confirmedBookings.has(i)
                  ? () => handleConfirmBooking(msg.bookingData, i)
                  : null
              } />
            ))}

            {/* Streaming */}
            {streamingText && (
              <div className="flex gap-3 fade-in-up">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 flex-none flex items-center justify-center">
                  <Bot size={15} className="text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl shadow-sm">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap streaming-cursor">
                    {streamingText}
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
                  title="Ghi âm (push-to-talk)"
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-none ${isRecording
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

      {/* ── QR Check-in Modal ── */}
      {checkinQR && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center animate-in">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center mx-auto mb-4">
              <Calendar size={22} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Đặt lịch thành công!</h3>
            <p className="text-xs text-slate-400 mb-5">Quét mã QR này khi đến bệnh viện để check-in</p>

            <div className="bg-white border-2 border-slate-100 rounded-xl p-4 inline-block mb-5">
              <QRCodeSVG
                value={JSON.stringify({
                  type: 'mediflow_checkin',
                  id: checkinQR.appointment_id,
                  dept: checkinQR.department,
                  date: checkinQR.scheduled_date,
                  time: checkinQR.scheduled_time,
                  phone: checkinQR.patient_phone,
                })}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="text-left bg-slate-50 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Mã lịch hẹn</span>
                <span className="font-mono font-bold text-slate-700 text-xs">{checkinQR.appointment_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chuyên khoa</span>
                <span className="font-semibold text-slate-700">{checkinQR.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Thời gian</span>
                <span className="font-semibold text-teal-600">{checkinQR.scheduled_time} — {checkinQR.scheduled_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">SĐT</span>
                <span className="font-semibold text-slate-700">{checkinQR.patient_phone}</span>
              </div>
            </div>

            <button
              onClick={() => setCheckinQR(null)}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-sky-500 text-white rounded-xl font-bold hover:from-teal-600 hover:to-sky-600 transition-all shadow-lg shadow-teal-500/20"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function MessageBubble({ msg, onBook }) {
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
        {levelConf && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${levelConf.bg} ${levelConf.border} ${levelConf.text} w-fit`}>
            {levelConf.icon}
            {levelConf.label}
            {msg.department && ` · ${msg.department}`}
          </div>
        )}
        <div className={`border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm ${msg.isError ? 'bg-red-50 border-red-200' :
          msg.triageLevel === 3 ? 'bg-red-50 border-red-100' :
            'bg-white border-slate-200'
          }`}>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          {onBook && msg.bookingData && (
            <button
              onClick={onBook}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-sky-500 text-white rounded-xl text-sm font-semibold hover:from-teal-600 hover:to-sky-600 transition-all shadow-md shadow-teal-500/20"
            >
              <Calendar size={14} />
              Xác nhận đặt lịch — {msg.bookingData.department} ({msg.bookingData.scheduled_time} {msg.bookingData.scheduled_date})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen({ onActivateVoice }) {
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
      {onActivateVoice && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <div className="text-xs text-slate-400">— hoặc —</div>
          <button
            onClick={onActivateVoice}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-sky-500 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 hover:scale-105 transition-all"
          >
            <Radio size={15} />
            Trò chuyện bằng giọng nói
          </button>
          <p className="text-xs text-slate-400 max-w-xs">
            AI lắng nghe và phản hồi ngay lập tức — tương tác liên tục như gọi điện
          </p>
        </div>
      )}
    </div>
  )
}
