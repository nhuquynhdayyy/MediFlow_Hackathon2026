import { useState } from 'react'
import { Mic, MicOff, FileText, Loader, CheckCircle } from 'lucide-react'
import { useStore } from '../store'
import { voiceToEMR } from '../services/api'
import { useVoice } from '../hooks/useVoice'

export default function VoiceRecorder() {
  const { apiKey, model, selectedPatient, setEmrData, emrData } = useStore()
  const [processing, setProcessing] = useState(false)
  const [done, setDone]             = useState(false)
  const { isRecording, transcript, start, stop, reset, supported } = useVoice()

  const handleExtract = async () => {
    if (!transcript.trim()) return
    if (!apiKey) { alert('Vui lòng nhập API Key'); return }
    setProcessing(true)
    try {
      const r = await voiceToEMR(transcript, selectedPatient?.id, apiKey, model)
      const emr = r.emr || {}
      // Merge extracted fields into existing EMR (non-empty only)
      const merged = { ...emrData }
      for (const [k, v] of Object.entries(emr)) {
        if (v && v !== 'Không có thông tin') merged[k] = v
      }
      setEmrData(merged)
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      reset()
    } catch (e) {
      alert('Lỗi trích xuất: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  if (!supported) {
    return (
      <div className="text-xs text-slate-400 p-3 text-center">
        Trình duyệt không hỗ trợ Voice. Dùng Chrome để sử dụng tính năng này.
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
        <Mic size={15} className="text-teal-500" />
        Voice-to-EMR
      </h3>
      <p className="text-xs text-slate-400">Ghi âm hội thoại bác sĩ - bệnh nhân, AI sẽ tự điền hồ sơ.</p>

      {/* Transcript preview */}
      {transcript && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 max-h-24 overflow-y-auto leading-relaxed">
          {transcript}
        </div>
      )}

      {isRecording && (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Đang ghi âm...
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={isRecording ? stop : start}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-teal-500 hover:bg-teal-600 text-white'
          }`}
        >
          {isRecording ? <><MicOff size={14} /> Dừng ghi</> : <><Mic size={14} /> Bắt đầu</>}
        </button>
        {transcript && (
          <button
            onClick={handleExtract}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {processing ? <Loader size={14} className="animate-spin" /> :
             done       ? <CheckCircle size={14} /> :
             <FileText size={14} />}
            {done ? 'Đã điền!' : 'Điền EMR'}
          </button>
        )}
      </div>
    </div>
  )
}
