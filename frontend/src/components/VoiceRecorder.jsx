import React from 'react'
import { Mic, MicOff, ArrowRight, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useVoice } from '../hooks/useVoice'
import { aiVoiceToEMR } from '../services/api'
import { toast } from 'react-hot-toast'

function fmt(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
}

export default function VoiceRecorder() {
  const { setEmrField, addChatMessage, loading, setLoading } = useStore()
  const { isRecording, transcript, seconds, supported, toggle, clear } = useVoice()

  const processTranscript = async () => {
    if (!transcript.trim()) { toast.error('Chưa có transcript'); return }
    setLoading('voice', true)
    addChatMessage({ role: 'assistant', text: '🎙️ Đang xử lý Voice-to-EMR...', loading: true })
    try {
      const res = await aiVoiceToEMR({ transcript })   // không cần api_key
      const d = res.data
      if (d.chief_complaint) setEmrField('chief_complaint', d.chief_complaint)
      if (d.symptoms)        setEmrField('symptoms',        d.symptoms)
      if (d.history)         setEmrField('history',         d.history)
      if (d.notes)           setEmrField('notes',           d.notes)
      const text = `**Voice-to-EMR thành công** (tin cậy: ${Math.round((d.confidence||0.8)*100)}%)\n• Lý do: ${d.chief_complaint||'—'}\n• Triệu chứng: ${(d.symptoms||'').slice(0,80)}...`
      addChatMessage({ role: 'assistant', text, loading: false })
      toast.success('Đã điền EMR từ giọng nói!')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Lỗi Voice-to-EMR: ${e.message}`, loading: false })
      toast.error('Lỗi xử lý giọng nói')
    } finally { setLoading('voice', false) }
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-600">Voice-to-EMR</span>
        {!supported && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Dùng Chrome</span>}
        <span className="ml-auto text-xs text-gray-400 tabular-nums">{fmt(seconds)}</span>
      </div>
      <div className="flex gap-2 items-start">
        <button onClick={toggle} disabled={!supported}
          className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition font-medium ${isRecording ? 'bg-red-500 text-white border-red-500 recording-pulse' : 'bg-teal-400 text-white border-teal-400 hover:bg-teal-600'} disabled:opacity-40`}>
          {isRecording ? <MicOff size={13} /> : <Mic size={13} />}
          {isRecording ? 'Dừng ghi' : 'Ghi âm'}
        </button>
        <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 min-h-12 max-h-20 overflow-y-auto leading-relaxed">
          {transcript || <span className="text-gray-300">Nhấn "Ghi âm" để ghi hội thoại bác sĩ — bệnh nhân...</span>}
        </div>
        <button onClick={processTranscript} disabled={!transcript || !!loading.voice}
          className="shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-40">
          <ArrowRight size={13} /> Sang EMR
        </button>
        <button onClick={clear} disabled={!transcript} className="shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-30 p-1.5">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
