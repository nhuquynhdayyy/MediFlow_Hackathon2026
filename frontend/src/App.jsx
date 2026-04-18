import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Activity, Building2, LogOut, MapPinned } from 'lucide-react'

import AuthOverlay from './components/AuthOverlay'
import SettingsBar from './components/SettingsBar'
import DoctorWorkspace from './pages/DoctorWorkspace'
import HospitalOpsPage from './pages/HospitalOpsPage'
import PatientNavigatorPage from './pages/PatientNavigatorPage'
import TriagePage from './pages/TriagePage'
import { useStore } from './store'

function UserPanel({ user, onLogout }) {
  if (!user) return null

  return (
    <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
      <div className="text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{user.role}</p>
        <p className="text-xs font-medium text-slate-600">{user.email}</p>
      </div>
      <button onClick={onLogout} className="p-2 text-slate-400 transition-colors hover:text-red-500" title="Dang xuat">
        <LogOut size={16} />
      </button>
    </div>
  )
}

function Brand() {
  return (
    <div className="mr-4 flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-500">
        <span className="text-sm font-black text-white">MF</span>
      </div>
      <span className="text-lg font-black tracking-tight text-slate-900">
        MediFlow <span className="text-sky-500">AI</span>
      </span>
    </div>
  )
}

export default function App() {
  const { user, logoutStore } = useStore()

  if (user?.role === 'doctor') {
    return (
      <div className="h-screen overflow-hidden bg-slate-50">
        <AuthOverlay />
        <Routes>
          <Route path="/docassist" element={<DoctorWorkspace user={user} onLogout={logoutStore} />} />
          <Route path="*" element={<Navigate to="/docassist" replace />} />
        </Routes>
      </div>
    )
  }

  if (user?.role === 'benhvien') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
        <AuthOverlay />
        <nav className="flex h-16 flex-none items-center gap-4 border-b border-slate-200 bg-white px-4 shadow-sm">
          <Brand />
          <NavLink
            to="/benhvien"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Building2 size={16} />
            Dashboard benhvien
          </NavLink>
          <div className="ml-auto">
            <UserPanel user={user} onLogout={logoutStore} />
          </div>
        </nav>
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/benhvien" element={<HospitalOpsPage user={user} />} />
            <Route path="*" element={<Navigate to="/benhvien" replace />} />
          </Routes>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <AuthOverlay />

      <nav className="flex h-16 flex-none items-center gap-4 border-b border-slate-200 bg-white px-4 shadow-sm">
        <Brand />

        <div className="flex flex-wrap gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Activity size={16} />
            Agent 1 Triage
          </NavLink>
          <NavLink
            to="/navigator"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <MapPinned size={16} />
            Agent 3 Navigator
          </NavLink>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <SettingsBar />
          <UserPanel user={user} onLogout={logoutStore} />
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<TriagePage />} />
          <Route path="/navigator" element={<PatientNavigatorPage user={user} />} />
          <Route path="/docassist" element={<Navigate to="/" replace />} />
          <Route path="/benhvien" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

