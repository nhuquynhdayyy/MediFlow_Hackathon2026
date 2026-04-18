import React, { useEffect, useState } from 'react'
import { Wifi, WifiOff, Loader2, Activity, ShieldCheck } from 'lucide-react'

export default function SettingsBar() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(d => setStatus(d.api_key_configured ? 'ok' : 'error'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <header className="shrink-0 px-4 pt-4">
      <div className="panel-shell-strong rounded-[24px] px-5 py-4 text-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-600/20">
              <Activity size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-none tracking-tight">MediFlow AI</div>
              <div className="text-sm text-slate-500 mt-1">DocAssist - Tro ly lam sang cho quy trinh EMR</div>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
            <ShieldCheck size={15} />
            <span className="text-xs font-medium">Clinical workflow active</span>
          </div>

          <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-2xl ml-auto border ${
            status === 'ok'
              ? 'bg-teal-50 text-teal-700 border-teal-100'
              : status === 'error'
              ? 'bg-rose-50 text-rose-700 border-rose-100'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}>
            {status === 'checking' && <Loader2 size={12} className="spin" />}
            {status === 'ok' && <Wifi size={12} />}
            {status === 'error' && <WifiOff size={12} />}
            <span>
              {status === 'checking' && 'Dang kiem tra'}
              {status === 'ok' && 'FPT AI san sang'}
              {status === 'error' && 'Kiem tra .env / backend'}
            </span>
          </div>

          <div className="hidden lg:block text-xs text-slate-400">GDGoC Hackathon 2026</div>
        </div>
      </div>
    </header>
  )
}
