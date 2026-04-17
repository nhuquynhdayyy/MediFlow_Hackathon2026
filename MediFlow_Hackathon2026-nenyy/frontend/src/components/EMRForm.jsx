import React, { useState } from 'react'
import { useStore } from '../store'
import { toast } from 'react-hot-toast'
import { Loader2, Sparkles, Save, Printer, QrCode, History } from 'lucide-react'
import { aiDiagnosis, aiTreatment, aiSoap, saveEMR, fetchHistory } from '../services/api'
import VoiceRecorder from './VoiceRecorder'
import PrescriptionTab from './PrescriptionTab'
import LabTab from './LabTab'
import QRModal from './QRModal'
import HistoryModal from './HistoryModal'

const TABS = ['Ho so benh an', 'Don thuoc', 'Xet nghiem']

export default function EMRForm() {
  const { activePatient, emr, setEmrField, addChatMessage, loading, setLoading } = useStore()
  const [tab, setTab] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])

  const ctx = () => ({
    patient_name: activePatient?.name || '',
    patient_info: `${activePatient?.age || ''} tuoi - ${activePatient?.gender || ''} - Phong ${activePatient?.room || ''}`,
    chief_complaint: emr.chief_complaint,
    symptoms: emr.symptoms,
    history: emr.history,
    current_diagnosis: emr.diagnosis,
    treatment_plan: emr.treatment_plan,
  })

  const requirePatient = () => {
    if (!activePatient) {
      toast.error('Chon benh nhan truoc')
      return false
    }
    return true
  }

  const handleDiagnosis = async () => {
    if (!requirePatient()) return
    setLoading('diagnosis', true)
    addChatMessage({ role: 'assistant', text: 'Dang phan tich trieu chung...', loading: true })
    try {
      const res = await aiDiagnosis(ctx())
      const d = res.data
      const text = `**Chan doan so bo:** ${d.primary_diagnosis}\n\n**Phan biet:** ${d.differential?.join(', ')}\n\n**Muc do khan:** ${d.urgency}\n\n**Ly giai:** ${d.reasoning}`
      addChatMessage({ role: 'assistant', text, loading: false })
      if (d.primary_diagnosis && !emr.diagnosis) setEmrField('diagnosis', d.primary_diagnosis)
      toast.success('Da phan tich chan doan')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Loi: ${e.message}`, loading: false })
      toast.error('Loi AI')
    } finally {
      setLoading('diagnosis', false)
    }
  }

  const handleTreatment = async () => {
    if (!requirePatient()) return
    setLoading('treatment', true)
    addChatMessage({ role: 'assistant', text: 'Dang tra cuu phac do...', loading: true })
    try {
      const res = await aiTreatment(ctx())
      const d = res.data
      const meds = d.medications?.map(m => `- ${m.name} ${m.dose} - ${m.frequency} x ${m.duration}`).join('\n') || ''
      const text = `**Phac do dieu tri:**\n${meds}\n\n**Theo doi:** ${d.monitoring?.join(', ')}\n\n**Tai kham:** ${d.follow_up}`
      addChatMessage({ role: 'assistant', text, loading: false })
      if (!emr.treatment_plan && meds) setEmrField('treatment_plan', meds)
      toast.success('Da lay phac do')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Loi: ${e.message}`, loading: false })
      toast.error('Loi AI')
    } finally {
      setLoading('treatment', false)
    }
  }

  const handleSOAP = async () => {
    if (!requirePatient()) return
    setLoading('soap', true)
    addChatMessage({ role: 'assistant', text: 'Dang tom tat SOAP...', loading: true })
    try {
      const res = await aiSoap(ctx())
      const d = res.data
      const text = `**S:** ${d.S}\n\n**O:** ${d.O}\n\n**A:** ${d.A}\n\n**P:** ${d.P}\n\n**ICD-10:** ${d.icd10_code || '-'}` 
      addChatMessage({ role: 'assistant', text, loading: false })
      setEmrField('soap', d)
      toast.success('Da tom tat SOAP')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Loi: ${e.message}`, loading: false })
      toast.error('Loi AI')
    } finally {
      setLoading('soap', false)
    }
  }

  const handleSave = async () => {
    if (!activePatient) {
      toast.error('Chon benh nhan truoc')
      return
    }
    setLoading('save', true)
    try {
      const res = await saveEMR({
        patient_id: activePatient.id,
        patient_name: activePatient.name,
        chief_complaint: emr.chief_complaint,
        symptoms: emr.symptoms,
        history: emr.history,
        diagnosis: emr.diagnosis,
        treatment_plan: emr.treatment_plan,
        prescriptions: emr.prescriptions || [],
        follow_up_date: emr.follow_up_date || '',
        lab_orders: emr.lab_orders || [],
        notes: emr.notes || '',
        soap: emr.soap || null,
        doctor_id: 'DR001',
      })
      toast.success(`Ho so da luu. Ma EMR: ${res.emr_id}`)
    } catch {
      toast.error('Loi luu ho so')
    } finally {
      setLoading('save', false)
    }
  }

  const handleHistory = async () => {
    if (!activePatient) return
    try {
      setHistory(await fetchHistory(activePatient.id))
    } catch {
      setHistory([])
    }
    setShowHistory(true)
  }

  const isL = (k) => !!loading[k]

  return (
    <div className="flex-1 flex flex-col overflow-hidden panel-shell-strong rounded-[30px]">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-white via-white to-teal-50/70">
        {activePatient ? (
          <>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-sm font-semibold text-white shrink-0 shadow-lg shadow-teal-600/20">
              {activePatient.name.split(' ').map(w => w[0]).slice(-2).join('')}
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold text-gray-900 truncate">{activePatient.name}</div>
              <div className="text-xs text-gray-500">{activePatient.age} tuoi - {activePatient.gender} - Phong {activePatient.room} - #{activePatient.visit_no}</div>
            </div>
            <div className="ml-auto flex gap-2 shrink-0">
              <button onClick={handleHistory} className="btn-ghost text-xs"><History size={13} /> Benh an cu</button>
              <button onClick={() => setShowQR(true)} className="btn-ghost text-xs"><QrCode size={13} /> QR thanh toan</button>
              <button onClick={handleSave} disabled={isL('save')} className="btn-primary text-xs">
                {isL('save') ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Luu ho so
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-400">Chon benh nhan tu danh sach ben trai</div>
        )}
      </div>

      <div className="flex border-b border-slate-100 px-5 shrink-0 bg-white/60">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`text-xs px-4 py-3 border-b-2 transition-colors ${tab === i ? 'border-teal-600 text-teal-700 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-white/70 to-slate-50/40">
        {tab === 0 && (
          <div className="space-y-3">
            <EMRField label="Ly do kham" value={emr.chief_complaint} onChange={v => setEmrField('chief_complaint', v)} rows={2} />
            <EMRField label="Tien su benh / thuoc dang dung" value={emr.history} onChange={v => setEmrField('history', v)} rows={2} />
            <EMRField label="Trieu chung hien tai (sinh hieu, mo ta chi tiet)" value={emr.symptoms} onChange={v => setEmrField('symptoms', v)} rows={3} />
            <EMRField label="Chan doan so bo" value={emr.diagnosis} onChange={v => setEmrField('diagnosis', v)} rows={2} placeholder="Nhan AI goi y chan doan de dien tu dong..." />
            <EMRField label="Ke hoach dieu tri" value={emr.treatment_plan} onChange={v => setEmrField('treatment_plan', v)} rows={3} placeholder="Nhan AI de xuat dieu tri de dien tu dong..." />
            <DateField label="Hen ngay tai kham" value={emr.follow_up_date} onChange={v => setEmrField('follow_up_date', v)} />
            <EMRField label="Ghi chu bac si" value={emr.notes} onChange={v => setEmrField('notes', v)} rows={3} />
            {emr.soap && (
              <div className="bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-2xl p-4 shadow-sm">
                <div className="text-xs font-medium text-sky-700 mb-2">Tom tat SOAP (AI)</div>
                <div className="grid grid-cols-2 gap-2">
                  {['S', 'O', 'A', 'P'].map(k => (
                    <div key={k} className="bg-white rounded-xl p-3 border border-sky-100/70">
                      <div className="text-xs font-medium text-sky-600">{k}</div>
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{emr.soap[k]}</div>
                    </div>
                  ))}
                </div>
                {emr.soap.icd10_code && <div className="text-xs text-sky-700 mt-2">ICD-10: {emr.soap.icd10_code}</div>}
              </div>
            )}
          </div>
        )}
        {tab === 1 && <PrescriptionTab />}
        {tab === 2 && <LabTab />}
      </div>

      <VoiceRecorder />

      <div className="flex items-center gap-2 flex-wrap px-5 py-4 border-t border-slate-100 bg-white/80 shrink-0">
        <AIBtn label="AI goi y chan doan" loading={isL('diagnosis')} onClick={handleDiagnosis} />
        <AIBtn label="AI de xuat dieu tri" loading={isL('treatment')} onClick={handleTreatment} />
        <AIBtn label="Tom tat SOAP" loading={isL('soap')} onClick={handleSOAP} />
        <div className="ml-auto">
          <button onClick={() => window.print()} className="btn-ghost text-xs"><Printer size={13} /> In ho so</button>
        </div>
      </div>

      {showQR && <QRModal patient={activePatient} onClose={() => setShowQR(false)} />}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} />}
    </div>
  )
}

function EMRField({ label, value, onChange, rows = 2, placeholder }) {
  return (
    <div className="bg-white/90 border border-slate-100 rounded-2xl p-4 shadow-sm">
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em] mb-2">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm text-gray-800 bg-transparent outline-none resize-none placeholder-gray-300 leading-relaxed"
      />
    </div>
  )
}

function AIBtn({ label, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 rounded-xl px-3.5 py-2 transition disabled:opacity-50 shadow-sm"
    >
      {loading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
      {label}
    </button>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <div className="bg-white/90 border border-slate-100 rounded-2xl p-4 shadow-sm">
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em] mb-2">{label}</label>
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm text-gray-800 bg-transparent outline-none"
      />
    </div>
  )
}
