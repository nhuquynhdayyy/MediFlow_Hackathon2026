import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Activity, LogOut } from 'lucide-react'
import TriagePage from './pages/TriagePage'
import DoctorWorkspace from './pages/DoctorWorkspace'
import SettingsBar from './components/SettingsBar'
import AuthOverlay from './components/AuthOverlay'
import { useStore } from './store'

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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <AuthOverlay />

      <nav className="flex-none h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-4 z-50 shadow-sm">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">MF</span>
          </div>
          <span className="font-bold text-slate-800 text-lg leading-none">
            MediFlow <span className="text-sky-500">AI</span>
          </span>
        </div>

        <div className="flex gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Activity size={15} /> Agent 1 · Triage
          </NavLink>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <SettingsBar />
          {user && (
            <div className="flex items-center gap-2 border-l pl-3 border-slate-200">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{user.role}</p>
                <p className="text-xs font-medium text-slate-600">{user.email}</p>
              </div>
              <button
                onClick={logoutStore}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Dang xuat"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<TriagePage />} />
          <Route path="/docassist" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
