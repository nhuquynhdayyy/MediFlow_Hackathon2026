import React, { useState } from 'react'
import { useStore } from '../store'
import { toast } from 'react-hot-toast'
import { Loader2, Sparkles, Save, Printer, QrCode, History } from 'lucide-react'
import { aiDiagnosis, aiTreatment, aiSoap, aiPrescription, aiLabSuggest, saveEMR, fetchHistory } from '../services/api'
import VoiceRecorder from './VoiceRecorder'
import PrescriptionTab from './PrescriptionTab'
import LabTab from './LabTab'
import QRModal from './QRModal'
import HistoryModal from './HistoryModal'

const TABS = ['Hồ sơ bệnh án', 'Đơn thuốc', 'Xét nghiệm']

export default function EMRForm() {
  const { activePatient, emr, setEmrField, setEmr, addChatMessage, loading, setLoading } = useStore()
  const [tab, setTab] = useState(0)
  const [showQR, setShowQR] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])

  // Build context object — KHÔNG có api_key
  const ctx = () => ({
    patient_name:      activePatient?.name || '',
    patient_info:      `${activePatient?.age || ''} tuổi · ${activePatient?.gender || ''} · Phòng ${activePatient?.room || ''}`,
    chief_complaint:   emr.chief_complaint,
    symptoms:          emr.symptoms,
    history:           emr.history,
    current_diagnosis: emr.diagnosis,
    treatment_plan:    emr.treatment_plan,
  })

  const requirePatient = () => {
    if (!activePatient) { toast.error('Chọn bệnh nhân trước'); return false }
    return true
  }

  const handleDiagnosis = async () => {
    if (!requirePatient()) return
    setLoading('diagnosis', true)
    addChatMessage({ role: 'assistant', text: '🔍 Đang phân tích triệu chứng...', loading: true })
    try {
      const res = await aiDiagnosis(ctx())
      const d = res.data
      const text = `**Chẩn đoán sơ bộ:** ${d.primary_diagnosis}\n\n**Phân biệt:** ${d.differential?.join(', ')}\n\n**Mức độ khẩn:** ${d.urgency}\n\n**Lý giải:** ${d.reasoning}`
      addChatMessage({ role: 'assistant', text, loading: false })
      if (d.primary_diagnosis && !emr.diagnosis) setEmrField('diagnosis', d.primary_diagnosis)
      toast.success('Đã phân tích chẩn đoán')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Lỗi: ${e.message}`, loading: false })
      toast.error('Lỗi AI — kiểm tra backend')
    } finally { setLoading('diagnosis', false) }
  }

  const handleTreatment = async () => {
    if (!requirePatient()) return
    setLoading('treatment', true)
    addChatMessage({ role: 'assistant', text: '💊 Đang tra cứu phác đồ...', loading: true })
    try {
      const res = await aiTreatment(ctx())
      const d = res.data
      const meds = d.medications?.map(m => `• ${m.name} ${m.dose} — ${m.frequency} × ${m.duration}`).join('\n') || ''
      const text = `**Phác đồ điều trị:**\n${meds}\n\n**Theo dõi:** ${d.monitoring?.join(', ')}\n\n**Tái khám:** ${d.follow_up}`
      addChatMessage({ role: 'assistant', text, loading: false })
      if (!emr.treatment_plan && meds) setEmrField('treatment_plan', meds)
      toast.success('Đã lấy phác đồ')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Lỗi: ${e.message}`, loading: false })
      toast.error('Lỗi AI')
    } finally { setLoading('treatment', false) }
  }

  const handleSOAP = async () => {
    if (!requirePatient()) return
    setLoading('soap', true)
    addChatMessage({ role: 'assistant', text: '📋 Đang tóm tắt SOAP...', loading: true })
    try {
      const res = await aiSoap(ctx())
      const d = res.data
      const text = `**S:** ${d.S}\n\n**O:** ${d.O}\n\n**A:** ${d.A}\n\n**P:** ${d.P}\n\n**ICD-10:** ${d.icd10_code || '—'}`
      addChatMessage({ role: 'assistant', text, loading: false })
      setEmrField('soap', d)
      toast.success('Đã tóm tắt SOAP')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Lỗi: ${e.message}`, loading: false })
      toast.error('Lỗi AI')
    } finally { setLoading('soap', false) }
  }

  const handleSave = async () => {
    if (!activePatient) { toast.error('Chọn bệnh nhân trước'); return }
    setLoading('save', true)
    try {
      const res = await saveEMR({
        patient_id: activePatient.id, patient_name: activePatient.name,
        chief_complaint: emr.chief_complaint, symptoms: emr.symptoms,
        history: emr.history, diagnosis: emr.diagnosis,
        treatment_plan: emr.treatment_plan, prescriptions: emr.prescriptions || [],
        follow_up_date: emr.follow_up_date || '',
        lab_orders: emr.lab_orders || [], notes: emr.notes || '',
        soap: emr.soap || null, doctor_id: 'DR001',
      })
      toast.success(`Hồ sơ đã lưu! Mã EMR: ${res.emr_id}`)
    } catch { toast.error('Lỗi lưu hồ sơ') }
    finally { setLoading('save', false) }
  }

  const handleHistory = async () => {
    if (!activePatient) return
    try { setHistory(await fetchHistory(activePatient.id)) }
    catch { setHistory([]) }
    setShowHistory(true)
  }

  const isL = (k) => !!loading[k]

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Patient header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
        {activePatient ? (
          <>
            <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center text-sm font-medium text-teal-600 shrink-0">
              {activePatient.name.split(' ').map(w => w[0]).slice(-2).join('')}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{activePatient.name}</div>
              <div className="text-xs text-gray-500">{activePatient.age} tuổi · {activePatient.gender} · Phòng {activePatient.room} · #{activePatient.visit_no}</div>
            </div>
            <div className="ml-auto flex gap-2 shrink-0">
              <button onClick={handleHistory} className="btn-ghost text-xs"><History size={13} /> Bệnh án cũ</button>
              <button onClick={() => setShowQR(true)} className="btn-ghost text-xs"><QrCode size={13} /> QR Thanh toán</button>
              <button onClick={handleSave} disabled={isL('save')} className="btn-primary text-xs">
                {isL('save') ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Lưu hồ sơ
              </button>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-400">← Chọn bệnh nhân từ danh sách bên trái</div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4 shrink-0">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`text-xs px-3 py-2.5 border-b-2 transition-colors ${tab === i ? 'border-teal-400 text-teal-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 0 && (
          <div className="space-y-3">
            <EMRField label="Lý do khám"           value={emr.chief_complaint} onChange={v => setEmrField('chief_complaint', v)} rows={2} />
            <EMRField label="Tiền sử bệnh / thuốc đang dùng" value={emr.history} onChange={v => setEmrField('history', v)} rows={2} />
            <EMRField label="Triệu chứng hiện tại (sinh hiệu, mô tả chi tiết)" value={emr.symptoms} onChange={v => setEmrField('symptoms', v)} rows={3} />
            <EMRField label="Chẩn đoán sơ bộ" value={emr.diagnosis} onChange={v => setEmrField('diagnosis', v)} rows={2} placeholder="Nhấn 'AI gợi ý chẩn đoán' để điền tự động..." />
            <EMRField label="Kế hoạch điều trị" value={emr.treatment_plan} onChange={v => setEmrField('treatment_plan', v)} rows={3} placeholder="Nhấn 'AI đề xuất điều trị' để điền tự động..." />
            <DateField label="Hẹn ngày tái khám" value={emr.follow_up_date} onChange={v => setEmrField('follow_up_date', v)} />
            <EMRField label="Ghi chú bác sĩ"   value={emr.notes}          onChange={v => setEmrField('notes', v)} rows={2} />
            {emr.soap && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <div className="text-xs font-medium text-blue-700 mb-2">Tóm tắt SOAP (AI)</div>
                <div className="grid grid-cols-2 gap-2">
                  {['S','O','A','P'].map(k => (
                    <div key={k} className="bg-white rounded-lg p-2">
                      <div className="text-xs font-medium text-blue-600">{k}</div>
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{emr.soap[k]}</div>
                    </div>
                  ))}
                </div>
                {emr.soap.icd10_code && <div className="text-xs text-blue-600 mt-1.5">ICD-10: {emr.soap.icd10_code}</div>}
              </div>
            )}
          </div>
        )}
        {tab === 1 && <PrescriptionTab />}
        {tab === 2 && <LabTab />}
      </div>

      <VoiceRecorder />

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
        <AIBtn label="AI gợi ý chẩn đoán" loading={isL('diagnosis')} onClick={handleDiagnosis} />
        <AIBtn label="AI đề xuất điều trị" loading={isL('treatment')} onClick={handleTreatment} />
        <AIBtn label="Tóm tắt SOAP"        loading={isL('soap')}      onClick={handleSOAP} />
        <div className="ml-auto">
          <button onClick={() => window.print()} className="btn-ghost text-xs"><Printer size={13} /> In hồ sơ</button>
        </div>
      </div>

      {showQR      && <QRModal patient={activePatient} onClose={() => setShowQR(false)} />}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} />}
    </div>
  )
}

function EMRField({ label, value, onChange, rows = 2, placeholder }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm text-gray-800 bg-transparent outline-none resize-none placeholder-gray-300 leading-relaxed" />
    </div>
  )
}

function AIBtn({ label, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-lg px-3 py-1.5 transition disabled:opacity-50">
      {loading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}{label}
    </button>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm text-gray-800 bg-transparent outline-none"
      />
    </div>
  )
}
