import React from 'react'
import { useStore } from '../store'
import { aiPrescription } from '../services/api'
import { toast } from 'react-hot-toast'
import { Sparkles, Loader2, Plus, Trash2 } from 'lucide-react'

export default function PrescriptionTab() {
  const { activePatient, emr, setEmrField, loading, setLoading } = useStore()
  const prescriptions = emr.prescriptions || []

  const handleAI = async () => {
    if (!emr.diagnosis) { toast.error('Vui lòng nhập chẩn đoán trước'); return }
    setLoading('prescription', true)
    try {
      const res = await aiPrescription({          // không cần api_key
        diagnosis:           emr.diagnosis,
        patient_info:        `${activePatient?.age||''} tuổi, ${activePatient?.gender||''}`,
        history:             emr.history,
        current_medications: activePatient?.current_medications || [],
        allergies:           activePatient?.allergies || '',
      })
      const list = res.data?.prescriptions || []
      setEmrField('prescriptions', list)
      if (res.data?.interactions?.length)
        toast(`⚠️ Tương tác: ${res.data.interactions.join(', ')}`, { icon: '⚠️' })
      else
        toast.success(`Đã tạo ${list.length} thuốc`)
    } catch { toast.error('Lỗi AI đơn thuốc') }
    finally { setLoading('prescription', false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Đơn thuốc lần khám này</span>
        <button onClick={handleAI} disabled={!!loading.prescription}
          className="btn-ai text-xs">
          {loading.prescription ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
          AI tạo đơn thuốc
        </button>
      </div>
      {prescriptions.length === 0
        ? <div className="text-center py-8 text-gray-300 text-sm">Nhấn "AI tạo đơn thuốc" hoặc thêm thủ công</div>
        : <div className="space-y-2">
            {prescriptions.map((rx, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{rx.drug || rx.name}</div>
                  {rx.generic && <div className="text-xs text-gray-400">{rx.generic}</div>}
                  <div className="text-xs text-gray-600 mt-1">{rx.dose} · {rx.route||'Uống'} · {rx.frequency} · {rx.days} ngày</div>
                  {rx.instructions && <div className="text-xs text-blue-600 mt-0.5">{rx.instructions}</div>}
                </div>
                <button onClick={() => setEmrField('prescriptions', prescriptions.filter((_,idx)=>idx!==i))}
                  className="text-gray-300 hover:text-red-400 transition shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
      }
      <button onClick={() => setEmrField('prescriptions', [...prescriptions, {drug:'',dose:'',frequency:'',days:7,route:'Uống',instructions:''}])}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-200 rounded-xl px-3 py-2 w-full justify-center transition">
        <Plus size={13} /> Thêm thuốc thủ công
      </button>
    </div>
  )
}
