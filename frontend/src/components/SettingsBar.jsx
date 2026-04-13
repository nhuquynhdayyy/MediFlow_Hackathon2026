import React, { useEffect, useState } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export default function SettingsBar() {
  const [status, setStatus] = useState('checking')  // checking | ok | error

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(d => setStatus(d.api_key_configured ? 'ok' : 'error'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <header className="flex items-center gap-4 px-4 py-2 bg-teal-400 text-white shrink-0 shadow-sm">
      <div>
        <div className="text-base font-semibold leading-none">MediFlow AI — DocAssist</div>
        <div className="text-xs opacity-75 leading-none mt-0.5">Agent 2 · Trợ lý lâm sàng</div>
      </div>

      {/* Backend status */}
      <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ml-auto ${
        status === 'ok'       ? 'bg-white/20' :
        status === 'error'    ? 'bg-red-500/40' :
                                'bg-white/10'
      }`}>
        {status === 'checking' && <Loader2 size={12} className="spin" />}
        {status === 'ok'       && <Wifi size={12} />}
        {status === 'error'    && <WifiOff size={12} />}
        <span>
          {status === 'checking' && 'Đang kiểm tra...'}
          {status === 'ok'       && 'FPT AI · Sẵn sàng'}
          {status === 'error'    && 'Lỗi — Kiểm tra .env'}
        </span>
      </div>

      <div className="text-xs opacity-60">GDGoC Hackathon 2026 · Đại đại đi</div>
    </header>
  )
}
