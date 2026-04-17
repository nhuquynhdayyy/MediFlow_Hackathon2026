import { useState } from 'react'
import { Settings, Eye, EyeOff, CheckCircle, XCircle, Loader } from 'lucide-react'
import { useStore } from '../store'
import { healthCheck } from '../services/api'

const MODELS = [
  { value: 'Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
  { value: 'SaoLa3.1-medium', label: 'SaoLa 3.1 (VI)' },
  { value: 'QwQ-32B', label: 'QwQ 32B' },
  { value: 'DeepSeek-R1', label: 'DeepSeek R1' },
]

export default function SettingsBar() {
  const { apiKey, model, setApiKey, setModel } = useStore()
  const [showKey, setShowKey] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(null) // null | 'loading' | 'ok' | 'error'

  const testConnection = async () => {
    setStatus('loading')
    try {
      await healthCheck()
      setStatus('ok')
      setTimeout(() => setStatus(null), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus(null), 3000)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-colors"
      >
        <Settings size={14} />
        Cai dat
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 space-y-3">
          <h3 className="font-semibold text-slate-800 text-sm">Cau hinh AI</h3>

          {/* API Key */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">FPT API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-400 pr-8"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Model</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Test button */}
          <button
            onClick={testConnection}
            disabled={status === 'loading'}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {status === 'loading' && <Loader size={14} className="animate-spin" />}
            {status === 'ok' && <CheckCircle size={14} />}
            {status === 'error' && <XCircle size={14} />}
            {status === 'ok' ? 'Ket noi OK!' :
              status === 'error' ? 'Loi ket noi' :
                'Test ket noi'}
          </button>

          <p className="text-xs text-slate-400 text-center">
            Láº¥y API key táº¡i{' '}
            <a href="https://marketplace.fptcloud.com" target="_blank" rel="noreferrer" className="text-sky-500 underline">
              marketplace.fptcloud.com
            </a>
          </p>
        </div>
      )}

      {/* Overlay to close */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}

