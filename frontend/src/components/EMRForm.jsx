import { useState } from 'react'
import { Save, Mic, MicOff, Wand2, Loader } from 'lucide-react'
import { useStore } from '../store'
import { saveEMR, voiceToEMR, aiSoap } from '../services/api'
import { useVoice } from '../hooks/useVoice'

const FIELDS = [
  { key: 'chief_complaint',      label: 'Lý do khám',          rows: 2 },
  { key: 'symptoms',             label: 'Triệu chứng',          rows: 3 },
  { key: 'medical_history',      label: 'Tiền sử bệnh',         rows: 2 },
  { key: 'allergies',            label: 'Dị ứng',               rows: 1 },
  { key: 'current_medications',  label: 'Thuốc đang dùng',      rows: 1 },
  { key: 'preliminary_diagnosis',label: 'Chẩn đoán sơ bộ',      rows: 2 },
  { key: 'treatment_plan',       label: 'Kế hoạch điều trị',    rows: 3 },
]

export default function EMRForm() {
  const { selectedPatient, emrData, updateEmrField, setEmrData, apiKey, model, setAiResult } = useStore()
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [voiceField, setVoiceField] = useState(null)

  const { isRecording, transcript, start, stop, reset, supported } = useVoice({
    onTranscriptUpdate: (t) => {
      if (voiceField) updateEmrField(voiceField, t)
    }
  })

  const startVoiceFor = (fieldKey) => {
    reset()
    setVoiceField(fieldKey)
    start()
  }
  const stopVoice = () => { stop(); setVoiceField(null) }

  const handleSave = async () => {
    if (!selectedPatient) return
    setSaving(true)
    try {
      await saveEMR(selectedPatient.id, emrData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert('Lỗi lưu hồ sơ: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const generateSoap = async () => {
    if (!selectedPatient || !apiKey) return
    setAiLoading(true)
    try {
      const prompt = `Bệnh nhân: ${selectedPatient.name}, ${selectedPatient.age} tuổi
Lý do khám: ${emrData.chief_complaint}
Triệu chứng: ${emrData.symptoms}
Tiền sử: ${emrData.medical_history}`
      const r = await aiSoap(prompt, { ...selectedPatient, ...emrData }, apiKey, model)
      setAiResult('soapResult', r.result)
    } catch (e) {
      alert('Lỗi: ' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  if (!selectedPatient) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
        <div className="text-3xl">📋</div>
        Chọn bệnh nhân để xem hồ sơ
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Patient info banner */}
      <div className="flex-none bg-gradient-to-r from-teal-500 to-sky-500 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{selectedPatient.name}</div>
            <div className="text-xs opacity-80">
              {selectedPatient.age} tuổi · {selectedPatient.gender} · {selectedPatient.department}
            </div>
          </div>
          <div className="text-right text-xs opacity-80">
            <div>SĐT: {selectedPatient.phone}</div>
            <div>BHYT: {selectedPatient.insurance}</div>
          </div>
        </div>
        {/* Vital signs */}
        {selectedPatient.vital_signs && (
          <div className="flex gap-4 mt-2 text-xs opacity-90">
            <span>💉 {selectedPatient.vital_signs.bp} mmHg</span>
            <span>❤️ {selectedPatient.vital_signs.hr} bpm</span>
            <span>🌡 {selectedPatient.vital_signs.temp}°C</span>
            <span>🫁 SpO₂ {selectedPatient.vital_signs.spo2}%</span>
          </div>
        )}
      </div>

      {/* Form fields */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {FIELDS.map(({ key, label, rows }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
              {supported && (
                <button
                  onClick={() => isRecording && voiceField === key ? stopVoice() : startVoiceFor(key)}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors ${
                    isRecording && voiceField === key
                      ? 'bg-red-100 text-red-600'
                      : 'bg-slate-100 text-slate-500 hover:bg-teal-50 hover:text-teal-600'
                  }`}
                >
                  {isRecording && voiceField === key ? <><MicOff size={11} /> Dừng</> : <><Mic size={11} /> Ghi âm</>}
                </button>
              )}
            </div>
            <textarea
              rows={rows}
              value={emrData[key] || ''}
              onChange={e => updateEmrField(key, e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              placeholder={`Nhập ${label.toLowerCase()}...`}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex-none border-t border-slate-100 px-4 py-3 flex gap-2">
        <button
          onClick={generateSoap}
          disabled={aiLoading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {aiLoading ? <Loader size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Tóm tắt SOAP
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Đã lưu ✓' : 'Lưu hồ sơ'}
        </button>
      </div>
    </div>
  )
}
