import { useState } from 'react'
import { Mic, MicOff, FileText, Loader, CheckCircle } from 'lucide-react'
import { useStore } from '../store'
import { voiceToEMR } from '../services/api'
import { useVoice } from '../hooks/useVoice'

export default function VoiceRecorder() {
  const { apiKey, model, selectedPatient, setEmrData, emrData } = useStore()
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const { isRecording, transcript, start, stop, reset, supported } = useVoice()

  const handleExtract = async () => {
    if (!transcript.trim()) return
    if (!apiKey) { alert('Vui long nhap API Key'); return }
    setProcessing(true)
    try {
      const r = await voiceToEMR(transcript, selectedPatient?.id, apiKey, model)
      const emr = r.emr || {}
      // Merge extracted fields into existing EMR (non-empty only)
      const merged = { ...emrData }
      const normalizeValue = (value) => (typeof value === 'string' ? value.trim() : value)
      const isEmptyLike = (value) => {
        if (value == null) return true
        const t = String(value).trim().toLowerCase()
        return !t || t === 'khong co thong tin' || t === 'không có thông tin'
      }

      const normalizedMap = {
        chief_complaint: normalizeValue(emr.chief_complaint || emr.ly_do_kham),
        symptoms: normalizeValue(emr.symptoms || emr.trieu_chung),
        medical_history: normalizeValue(emr.medical_history || emr.history || emr.tien_su),
        allergies: normalizeValue(emr.allergies),
        current_medications: normalizeValue(emr.current_medications),
        preliminary_diagnosis: normalizeValue(
          emr.preliminary_diagnosis || emr.assessment || emr.chan_doan_so_bo
        ),
        treatment_plan: normalizeValue(emr.treatment_plan || emr.plan),
      }

      for (const [k, v] of Object.entries(normalizedMap)) {
        if (!isEmptyLike(v)) merged[k] = v
      }

      for (const [k, v] of Object.entries(emr)) {
        if (!isEmptyLike(v)) merged[k] = v
      }
      setEmrData(merged)
      setDone(true)
      setTimeout(() => setDone(false), 3000)
      reset()
    } catch (e) {
      alert('Loi trich xuat: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  if (!supported) {
    return (
      <div className="text-xs text-slate-400 p-3 text-center">
        Trinh duyet khong ho tro Voice. Dung Chrome de su dung tinh nang nay.
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
        <Mic size={15} className="text-teal-500" />
        Voice-to-EMR
      </h3>
      <p className="text-xs text-slate-400">Ghi am hoi thoai bac si - benh nhan, AI se tu dien ho so.</p>

      {/* Transcript preview */}
      {transcript && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 max-h-24 overflow-y-auto leading-relaxed">
          {transcript}
        </div>
      )}

      {isRecording && (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Dang ghi am...
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={isRecording ? stop : start}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-teal-500 hover:bg-teal-600 text-white'
            }`}
        >
          {isRecording ? <><MicOff size={14} /> Dung ghi</> : <><Mic size={14} /> Bat dau</>}
        </button>
        {transcript && (
          <button
            onClick={handleExtract}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {processing ? <Loader size={14} className="animate-spin" /> :
              done ? <CheckCircle size={14} /> :
                <FileText size={14} />}
            {done ? 'Da dien!' : 'Dien EMR'}
          </button>
        )}
      </div>
    </div>
  )
}

