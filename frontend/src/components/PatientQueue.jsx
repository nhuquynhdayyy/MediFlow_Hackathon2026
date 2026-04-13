import React from 'react'
import { useStore } from '../store'
import { Clock, AlertCircle, CheckCircle, Circle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

const SEV_CONFIG = {
  high:   { label: 'Ưu tiên cao', cls: 'bg-red-50 text-red-600',    Icon: AlertCircle,   dot: 'bg-red-400' },
  medium: { label: 'Trung bình',  cls: 'bg-amber-50 text-amber-600', Icon: Circle,        dot: 'bg-amber-400' },
  low:    { label: 'Thông thường', cls: 'bg-green-50 text-green-600', Icon: CheckCircle,  dot: 'bg-green-400' },
}

export default function PatientQueue() {
  const { patients, activePatient, setActivePatient, setEmr, resetEmr } = useStore()

  const selectPatient = (p) => {
    setActivePatient(p)
    setEmr({
      chief_complaint: p.chief_complaint || '',
      symptoms:        p.symptoms        || '',
      history:         p.history         || '',
      diagnosis:       p.diagnosis       || '',
      treatment_plan:  p.treatment_plan  || '',
      notes:           '',
      prescriptions:   [],
      lab_orders:      [],
      soap:            null,
    })
  }

  return (
    <aside className="w-64 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Hàng đợi khám ({patients.length})
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {patients.map(p => {
          const sev = SEV_CONFIG[p.triage_severity] || SEV_CONFIG.low
          const isActive = activePatient?.id === p.id

          return (
            <button
              key={p.id}
              onClick={() => selectPatient(p)}
              className={`w-full text-left rounded-xl p-3 border transition-all ${
                isActive
                  ? 'border-teal-400 bg-teal-50'
                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.age} tuổi · {p.gender} · Phòng {p.room}</div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${sev.cls}`}>
                  #{p.visit_no}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-1.5 line-clamp-2">{p.chief_complaint}</div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${sev.cls}`}>{sev.label}</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={10} />
                  {p.arrived_at
                    ? formatDistanceToNow(new Date(p.arrived_at), { locale: vi, addSuffix: true })
                    : '—'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* System status */}
      <div className="border-t border-gray-100 p-3">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Hệ thống</div>
        <StatusRow label="FPT AI LLM"  status="online" />
        <StatusRow label="Firebase EMR" status="online" />
        <StatusRow label="Voice-to-EMR" status="beta"   />
        <StatusRow label="QR Payment"   status="online" />
      </div>
    </aside>
  )
}

function StatusRow({ label, status }) {
  const cfg = {
    online: { dot: 'bg-green-400', text: 'Hoạt động' },
    beta:   { dot: 'bg-amber-400', text: 'Thử nghiệm' },
    offline:{ dot: 'bg-gray-300',  text: 'Offline' },
  }[status] || {}

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-gray-600 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {label}
      </span>
      <span className="text-xs text-gray-400">{cfg.text}</span>
    </div>
  )
}
