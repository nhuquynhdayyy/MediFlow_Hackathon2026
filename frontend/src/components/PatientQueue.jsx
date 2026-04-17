import React, { useState } from 'react'
import { useStore } from '../store'
import {
  Clock, AlertCircle, CheckCircle, Circle,
  Users, ChevronRight, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

const SEV_CONFIG = {
  high: { label: 'Uu tien cao', cls: 'bg-red-50 text-red-600' },
  medium: { label: 'Trung binh', cls: 'bg-amber-50 text-amber-600' },
  low: { label: 'Thong thuong', cls: 'bg-green-50 text-green-600' },
}

export default function PatientQueue() {
  const { patients, activePatient, setActivePatient, setEmr } = useStore()
  const [collapsed, setCollapsed] = useState(false)

  const selectPatient = (p) => {
    setActivePatient(p)
    setEmr({
      chief_complaint: p.chief_complaint || '',
      symptoms: p.symptoms || '',
      history: p.history || '',
      diagnosis: p.diagnosis || '',
      treatment_plan: p.treatment_plan || '',
      notes: '',
      prescriptions: [],
      lab_orders: [],
      soap: null,
    })
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
          {patients.slice(0, 6).map((p) => {
            const isActive = activePatient?.id === p.id
            return (
              <button
                key={p.id}
                onClick={() => {
                  selectPatient(p)
                  setCollapsed(false)
                }}
                className={`w-10 h-10 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-teal-100 text-teal-700 border border-teal-200'
                    : 'bg-white/80 text-slate-500 border border-slate-100 hover:bg-slate-50'
                }`}
                title={p.name}
              >
                {p.name.split(' ').map(w => w[0]).slice(-2).join('')}
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
        {patients.map(p => {
          const sev = SEV_CONFIG[p.triage_severity] || SEV_CONFIG.low
          const isActive = activePatient?.id === p.id

          return (
            <button
              key={p.id}
              onClick={() => selectPatient(p)}
              className={`w-full text-left rounded-[18px] border px-3 py-2.5 transition-all ${
                isActive
                  ? 'border-teal-300 bg-gradient-to-br from-teal-50 to-white shadow-md shadow-teal-100/70'
                  : 'border-white/60 bg-white/80 hover:border-slate-200 hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">{p.age} tuoi - {p.gender} - {p.room}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${sev.cls}`}>#{p.visit_no}</span>
                  {isActive && <ChevronRight size={13} className="text-teal-600" />}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${sev.cls}`}>{sev.label}</span>
                <span className="text-[11px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
                  <Clock size={9} />
                  {p.arrived_at
                    ? formatDistanceToNow(new Date(p.arrived_at), { locale: vi, addSuffix: true })
                    : '-'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
