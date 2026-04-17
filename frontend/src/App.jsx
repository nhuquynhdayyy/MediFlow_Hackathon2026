import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Activity, Stethoscope } from 'lucide-react'
import TriagePage from './pages/TriagePage'
import DocAssistPage from './pages/DocAssistPage'
import SettingsBar from './components/SettingsBar'
import AuthOverlay from './components/AuthOverlay';
import { useStore } from './store'

export default function App() {
  const { user, logoutStore } = useStore();
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <AuthOverlay />
      {/* ── Top Nav ── */}
      <nav className="flex-none h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-4 z-50 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">MF</span>
          </div>
          <span className="font-bold text-slate-800 text-lg leading-none">
            MediFlow <span className="text-sky-500">AI</span>
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {user?.role !== 'doctor' && (
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                  ? 'bg-sky-50 text-sky-600'
                  : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Activity size={15} />
              Agent 1 · Triage
            </NavLink>
          )}
          {user?.role === 'doctor' && (
            <NavLink
              to="/docassist"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                  ? 'bg-teal-50 text-teal-600'
                  : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Stethoscope size={15} />
              Agent 2 · DocAssist
            </NavLink>
          )}
        </div>

        {/* Settings pushed right */}
        <div className="ml-auto">
          <SettingsBar />
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route 
            path="/" 
            element={user?.role === 'doctor' ? <Navigate to="/docassist" /> : <TriagePage />} 
          />
          <Route path="/docassist" element={<DocAssistPage />} />
        </Routes>
      </main>

      <nav className="...">
        {/* Thêm nút Logout ở góc phải Nav */}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{user.email}</span>
            <button onClick={logoutStore} className="text-xs text-red-500 font-bold">Thoát</button>
          </div>
        )}
      </nav>
    </div>
  )
}
