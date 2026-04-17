import { useState } from 'react'
import { Save, Mic, MicOff, Wand2, Loader } from 'lucide-react'
import { useStore } from '../store'
import { saveEMR, aiSoap } from '../services/api'
import { useVoice } from '../hooks/useVoice'
import PrescriptionTab from './PrescriptionTab'
import LabTab from './LabTab'

const FIELDS = [
  { key: 'chief_complaint', label: 'Ly do kham', rows: 2 },
  { key: 'symptoms', label: 'Trieu chung', rows: 3 },
  { key: 'medical_history', label: 'Tien su benh', rows: 2 },
  { key: 'allergies', label: 'Di ung', rows: 1 },
  { key: 'current_medications', label: 'Thuoc dang dung', rows: 1 },
  { key: 'preliminary_diagnosis', label: 'Chan doan so bo', rows: 2 },
  { key: 'treatment_plan', label: 'Ke hoach dieu tri', rows: 3 },
]

const TABS = [
  { key: 'emr', label: 'EMR' },
  { key: 'prescription', label: 'Don thuoc' },
  { key: 'lab', label: 'Xet nghiem' },
]

export default function EMRForm() {
  const { selectedPatient, emrData, updateEmrField, apiKey, model, setAiResult } = useStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [voiceField, setVoiceField] = useState(null)
  const [tab, setTab] = useState('emr')

  const { isRecording, start, stop, reset, supported } = useVoice({
    onTranscriptUpdate: (text) => {
      if (voiceField) updateEmrField(voiceField, text)
    },
  })

  const startVoiceFor = (fieldKey) => {
    reset()
    setVoiceField(fieldKey)
    start()
  }

  const stopVoice = () => {
    stop()
    setVoiceField(null)
  }

  const handleSave = async () => {
    if (!selectedPatient) return
    setSaving(true)
    try {
      await saveEMR(selectedPatient.id, emrData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      alert(`Loi luu ho so: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const generateSoap = async () => {
    if (!selectedPatient || !apiKey) return
    setAiLoading(true)
    try {
      const prompt = `Benh nhan: ${selectedPatient.name}, ${selectedPatient.age} tuoi
Ly do kham: ${emrData.chief_complaint}
Trieu chung: ${emrData.symptoms}
Tien su: ${emrData.medical_history}`
      const response = await aiSoap(prompt, { ...selectedPatient, ...emrData }, apiKey, model)
      setAiResult('soapResult', response.result)
    } catch (error) {
      alert(`Loi: ${error.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  if (!selectedPatient) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-400">
        <div className="text-3xl">📋</div>
        Chon benh nhan de xem ho so
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none bg-gradient-to-r from-teal-500 to-sky-500 px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{selectedPatient.name}</div>
            <div className="text-xs opacity-80">
              {selectedPatient.age} tuoi · {selectedPatient.gender} · {selectedPatient.department}
            </div>
          </div>
          <div className="text-right text-xs opacity-80">
            <div>SDT: {selectedPatient.phone}</div>
            <div>BHYT: {selectedPatient.insurance}</div>
          </div>
        </div>
        {selectedPatient.vital_signs && (
          <div className="mt-2 flex gap-4 text-xs opacity-90">
            <span>BP {selectedPatient.vital_signs.bp} mmHg</span>
            <span>HR {selectedPatient.vital_signs.hr} bpm</span>
            <span>T {selectedPatient.vital_signs.temp} C</span>
            <span>SpO2 {selectedPatient.vital_signs.spo2}%</span>
          </div>
        )}
      </div>

      <div className="flex border-b border-slate-100 bg-white px-2 pt-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`border-b-2 px-3 py-2 text-xs transition-colors ${
              tab === item.key
                ? 'border-teal-500 font-semibold text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {tab === 'emr' && FIELDS.map(({ key, label, rows }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
              {supported && (
                <button
                  onClick={() => (isRecording && voiceField === key ? stopVoice() : startVoiceFor(key))}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
                    isRecording && voiceField === key
                      ? 'bg-red-100 text-red-600'
                      : 'bg-slate-100 text-slate-500 hover:bg-teal-50 hover:text-teal-600'
                  }`}
                >
                  {isRecording && voiceField === key ? <><MicOff size={11} /> Dung</> : <><Mic size={11} /> Ghi am</>}
                </button>
              )}
            </div>
            <textarea
              rows={rows}
              value={emrData[key] || ''}
              onChange={(event) => updateEmrField(key, event.target.value)}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder={`Nhap ${label.toLowerCase()}...`}
            />
          </div>
        ))}

        {tab === 'prescription' && <PrescriptionTab />}
        {tab === 'lab' && <LabTab />}
      </div>

      {tab === 'emr' && (
        <div className="flex-none border-t border-slate-100 px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={generateSoap}
              disabled={aiLoading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-200 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50"
            >
              {aiLoading ? <Loader size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Tom tat SOAP
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-500 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? 'Da luu ✓' : 'Luu ho so'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

