import React, { useState } from 'react'
import { buildInitialDoctorEmr } from '../../doctor/emr'
import { useStore } from '../store'
import { Clock, Users, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const SEV_CONFIG = {
  high: { label: 'Uu tien cao', cls: 'bg-red-50 text-red-600' },
  medium: { label: 'Trung binh', cls: 'bg-amber-50 text-amber-600' },
  low: { label: 'Thong thuong', cls: 'bg-green-50 text-green-600' },
}

function formatDistanceVi(isoValue) {
  const value = new Date(isoValue)
  if (Number.isNaN(value.getTime())) return '-'

  const diffMs = Date.now() - value.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000))

  if (diffMinutes < 1) return 'vua xong'
  if (diffMinutes < 60) return `${diffMinutes} phut truoc`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} gio truoc`

  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} ngay truoc`
}

export default function PatientQueue() {
  const { patients, activePatient, setActivePatient, setEmr } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const getQueueKey = (patient) => patient.queue_item_id || patient.appointment_id || patient.id

  const selectPatient = (patient) => {
    setActivePatient(patient)
    setEmr(buildInitialDoctorEmr(patient))
  }

  if (collapsed) {
    return (
      <aside className="w-[76px] panel-shell rounded-[24px] flex flex-col items-center py-3 px-2 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 hover:bg-teal-700 transition"
          title="Mo hang doi kham"
        >
          <PanelLeftOpen size={18} />
        </button>

        <div className="mt-3 flex flex-col items-center gap-2 w-full">
          {patients.slice(0, 6).map((patient) => {
            const isActive = getQueueKey(activePatient || {}) === getQueueKey(patient)
            return (
              <button
                key={getQueueKey(patient)}
                onClick={() => {
                  selectPatient(patient)
                  setCollapsed(false)
                }}
                className={`w-10 h-10 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-teal-100 text-teal-700 border border-teal-200'
                    : 'bg-white/80 text-slate-500 border border-slate-100 hover:bg-slate-50'
                }`}
                title={patient.name}
              >
                {patient.name
                  .split(' ')
                  .map((word) => word[0])
                  .slice(-2)
                  .join('')}
              </button>
            )
          })}
        </div>

        <div className="mt-auto text-[10px] text-slate-400 text-center leading-tight">
          {patients.length}
          <br />
          BN
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-[248px] panel-shell rounded-[24px] flex flex-col overflow-hidden shrink-0">
      <div className="px-3 py-3 border-b border-slate-100 bg-gradient-to-b from-white to-teal-50/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
            <Users size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">Hang doi kham</div>
            <div className="text-[11px] text-slate-500">{patients.length} benh nhan</div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:bg-white hover:text-slate-700 transition flex items-center justify-center"
            title="Thu gon hang doi kham"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {patients.map((patient) => {
          const severity = SEV_CONFIG[patient.triage_severity] || SEV_CONFIG.low
          const isActive = getQueueKey(activePatient || {}) === getQueueKey(patient)

          return (
            <button
              key={getQueueKey(patient)}
              onClick={() => selectPatient(patient)}
              className={`w-full text-left rounded-[18px] border px-3 py-2.5 transition-all ${
                isActive
                  ? 'border-teal-300 bg-gradient-to-br from-teal-50 to-white shadow-md shadow-teal-100/70'
                  : 'border-white/60 bg-white/80 hover:border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{patient.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                    {patient.age} tuoi - {patient.gender} - {patient.room}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${severity.cls}`}>
                    #{patient.visit_no}
                  </span>
                  {isActive && <ChevronRight size={13} className="text-teal-600" />}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${severity.cls}`}>
                  {severity.label}
                </span>
                <span className="text-[11px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
                  <Clock size={9} />
                  {patient.arrived_at ? formatDistanceVi(patient.arrived_at) : '-'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
