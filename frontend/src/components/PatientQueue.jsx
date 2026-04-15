import { useEffect } from 'react'
import { User, Clock, Stethoscope, CheckCircle } from 'lucide-react'
import { useStore } from '../store'
import { getPatients, getHistory } from '../services/api'

const STATUS_CONFIG = {
  waiting:         { label: 'Chờ khám',   color: 'bg-amber-100 text-amber-700' },
  in_consultation: { label: 'Đang khám',  color: 'bg-sky-100 text-sky-700' },
  done:            { label: 'Hoàn tất',   color: 'bg-green-100 text-green-700' },
}

export default function PatientQueue() {
  const { patients, setPatients, selectedPatient, setSelectedPatient, setEmrData,
          setHistoryData, clearDocMessages } = useStore()

  useEffect(() => {
    getPatients()
      .then(r => setPatients(r.data))
      .catch(console.error)
  }, [setPatients])

  const select = async (patient) => {
    setSelectedPatient(patient)
    clearDocMessages()
    // Pre-fill EMR
    setEmrData({
      chief_complaint:     patient.chief_complaint || '',
      symptoms:            patient.symptoms || '',
      medical_history:     patient.medical_history || '',
      allergies:           patient.allergies || '',
      current_medications: patient.current_medications || '',
      preliminary_diagnosis: '',
      treatment_plan:      '',
    })
    // Load history
    try {
      const h = await getHistory(patient.id)
      setHistoryData(h.data)
    } catch (_) {}
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Hàng đợi bệnh nhân</h2>
        <p className="text-xs text-slate-400">{patients.length} bệnh nhân hôm nay</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {patients.map((p) => {
          const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.waiting
          const isSelected = selectedPatient?.id === p.id
          return (
            <button
              key={p.id}
              onClick={() => select(p)}
              className={`w-full text-left px-4 py-3 border-b border-slate-50 transition-colors ${
                isSelected ? 'bg-teal-50 border-l-2 border-l-teal-500' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-sky-500 flex items-center justify-center flex-none">
                  <User size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-slate-800 truncate">{p.name}</span>
                    <span className="text-xs text-slate-400 flex-none">#{p.queue_number}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{p.chief_complaint}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sc.color}`}>
                      {sc.label}
                    </span>
                    <span className="text-xs text-slate-400">{p.department}</span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
        {patients.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
            <Clock size={24} className="mb-2 opacity-40" />
            Chưa có bệnh nhân
          </div>
        )}
      </div>
    </div>
  )
}
