import { useEffect, useMemo, useState } from 'react'
import { Activity, BedDouble, Bot, Building2, Clock3, Hospital, LayoutDashboard, Route, ShieldAlert, Stethoscope, Users } from 'lucide-react'

import { viName } from '../features/agent3/metadata'
import {
  createHospitalRoom,
  createHospitalStaff,
  deleteHospitalRoom,
  deleteHospitalStaff,
  fetchDepartmentLoad,
  fetchHospitalDashboard,
  fetchHospitalPatientFlows,
  fetchHospitalRooms,
  fetchHospitalStaff,
  fetchHospitalSystemMetrics,
  hospitalOpsChatAPI,
  updateHospitalPatientFlowStatus,
  updateHospitalRoom,
  updateHospitalStaff,
} from '../services/agent3_api'

function AlertBadge({ level }) {
  const style =
    level === 'red'
      ? 'bg-red-100 text-red-700 border-red-200'
      : level === 'yellow'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
  const label = level === 'red' ? 'Đỏ' : level === 'yellow' ? 'Vàng' : 'Xanh'
  return <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${style}`}>{label}</span>
}

function StatusBadge({ status }) {
  const tone =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'in_progress'
        ? 'bg-sky-100 text-sky-700'
        : status === 'cancelled'
          ? 'bg-slate-200 text-slate-600'
          : 'bg-amber-100 text-amber-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status || 'waiting'}</span>
}

function MetricCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    red: 'border-red-200 bg-red-50 text-red-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  return (
    <div className={`rounded-[24px] border p-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] opacity-70">{label}</div>
          <div className="mt-1 text-2xl font-black leading-none">{value}</div>
        </div>
      </div>
    </div>
  )
}

function formatDuration(minutes) {
  const value = Number(minutes)
  if (!Number.isFinite(value) || value <= 0) return '--'
  if (value < 60) return `${Math.round(value)} phút`
  const hours = value / 60
  return `${hours.toFixed(hours >= 10 ? 0 : 1)} giờ`
}

const defaultStaffForm = {
  name: '',
  role: 'doctor',
  department: 'Internal',
  shift: '07:00-15:00',
  status: 'active',
}

const defaultRoomForm = {
  department: 'Internal',
  room_name: 'Phong kham moi',
  room_code: 'PK-NEW',
  block: 'A1 (Noi khoa)',
  floor: 3,
  capacity: 20,
  room_type: 'clinic',
  status: 'active',
}

export default function HospitalOpsPage({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [departmentLoad, setDepartmentLoad] = useState([])
  const [patientFlows, setPatientFlows] = useState([])
  const [staff, setStaff] = useState([])
  const [rooms, setRooms] = useState([])
  const [metrics, setMetrics] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [opsChatInput, setOpsChatInput] = useState('')
  const [opsChatHistory, setOpsChatHistory] = useState([
    { role: 'bot', text: 'Operations Copilot sẵn sàng. Bạn có thể hỏi về dự báo tải, điều phối bệnh nhân và nhân sự.' },
  ])
  const [staffForm, setStaffForm] = useState(defaultStaffForm)
  const [roomForm, setRoomForm] = useState(defaultRoomForm)
  const [editingStaffId, setEditingStaffId] = useState('')
  const [editingRoomId, setEditingRoomId] = useState('')

  const loadAll = async ({ lightweight = false } = {}) => {
    try {
      setBusy(true)
      setError('')
      const requests = lightweight
        ? [fetchHospitalDashboard(), fetchDepartmentLoad(), fetchHospitalPatientFlows()]
        : [
            fetchHospitalDashboard(),
            fetchDepartmentLoad(),
            fetchHospitalPatientFlows(),
            fetchHospitalStaff(),
            fetchHospitalRooms(),
            fetchHospitalSystemMetrics(12),
          ]
      const results = await Promise.all(requests)
      setDashboard(results[0] || null)
      setDepartmentLoad(results[1] || [])
      setPatientFlows(results[2] || [])
      if (!lightweight) {
        setStaff(results[3] || [])
        setRooms(results[4] || [])
        setMetrics(results[5] || [])
      }
    } catch (err) {
      setError(err?.message || 'Không tải được dữ liệu dashboard Agent 3.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadAll({ lightweight: true })
    }, 25000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const overview = dashboard?.overview || {}
  const prediction = dashboard?.prediction || {}
  const overload = dashboard?.overload || {}
  const latestMetric = dashboard?.latest_metric || metrics[0]

  const managedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) => {
        const floorDiff = Number(a.floor || 0) - Number(b.floor || 0)
        if (floorDiff !== 0) return floorDiff
        return String(a.department || '').localeCompare(String(b.department || ''))
      }),
    [rooms]
  )

  const handleOpsChat = async () => {
    const text = opsChatInput.trim()
    if (!text) return
    setOpsChatHistory((prev) => [...prev, { role: 'user', text }])
    setOpsChatInput('')
    try {
      const historyPayload = opsChatHistory.slice(-10).map((item) => ({
        role: item.role === 'bot' ? 'assistant' : 'user',
        text: item.text,
      }))
      const response = await hospitalOpsChatAPI({ message: text, history: historyPayload })
      setOpsChatHistory((prev) => [...prev, { role: 'bot', text: response?.reply || 'Minh chua co phan hoi phu hop.' }])
    } catch (_) {
      setOpsChatHistory((prev) => [
        ...prev,
        { role: 'bot', text: 'Copilot dang o che do du phong. Ban thu hoi lai sau vai giay.' },
      ])
    }
  }

  const handleFlowStatus = async (flow, status) => {
    try {
      setBusy(true)
      await updateHospitalPatientFlowStatus(flow.appointment_id, {
        status,
        current_step:
          status === 'in_progress'
            ? flow.next_step || flow.recommended_department || flow.department_name || null
            : flow.current_step || flow.next_step || null,
        note: `updated_by_${user?.uid || 'benhvien'}`,
      })
      setToast(`Da cap nhat ${flow.patient_name} -> ${status}.`)
      await loadAll({ lightweight: true })
    } catch (err) {
      setError(err?.message || 'Không cập nhật được luồng bệnh nhân.')
    } finally {
      setBusy(false)
    }
  }

  const submitStaff = async (event) => {
    event.preventDefault()
    try {
      setBusy(true)
      if (editingStaffId) {
        await updateHospitalStaff(editingStaffId, staffForm)
        setToast('Da cap nhat nhan su.')
      } else {
        await createHospitalStaff(staffForm)
        setToast('Da tao nhan su moi.')
      }
      setEditingStaffId('')
      setStaffForm(defaultStaffForm)
      setStaff(await fetchHospitalStaff())
    } catch (err) {
      setError(err?.message || 'Không lưu được nhân sự.')
    } finally {
      setBusy(false)
    }
  }

  const removeStaff = async (staffId) => {
    if (!window.confirm('Xóa nhân sự này?')) return
    try {
      setBusy(true)
      await deleteHospitalStaff(staffId)
      setStaff(await fetchHospitalStaff())
      if (editingStaffId === staffId) {
        setEditingStaffId('')
        setStaffForm(defaultStaffForm)
      }
      setToast('Da xoa nhan su.')
    } catch (err) {
      setError(err?.message || 'Không xóa được nhân sự.')
    } finally {
      setBusy(false)
    }
  }

  const submitRoom = async (event) => {
    event.preventDefault()
    try {
      setBusy(true)
      if (editingRoomId) {
        await updateHospitalRoom(editingRoomId, roomForm)
        setToast('Da cap nhat phong.')
      } else {
        await createHospitalRoom(roomForm)
        setToast('Da tao phong moi.')
      }
      setEditingRoomId('')
      setRoomForm(defaultRoomForm)
      setRooms(await fetchHospitalRooms())
    } catch (err) {
      setError(err?.message || 'Không lưu được phòng.')
    } finally {
      setBusy(false)
    }
  }

  const removeRoom = async (roomId) => {
    if (!window.confirm('Xóa phòng này?')) return
    try {
      setBusy(true)
      await deleteHospitalRoom(roomId)
      setRooms(await fetchHospitalRooms())
      if (editingRoomId === roomId) {
        setEditingRoomId('')
        setRoomForm(defaultRoomForm)
      }
      setToast('Da xoa phong.')
    } catch (err) {
      setError(err?.message || 'Không xóa được phòng.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f3f6fb_100%)]">
      <div className="mx-auto max-w-[1580px] px-5 py-6 lg:px-8 lg:py-8 space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                <Hospital size={14} />
                Role bệnh viện
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">FlowPredict dashboard và điều phối nội viện</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 shadow-inner">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Operator</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{user?.full_name || user?.email || 'bệnh viện'}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">{user?.uid || 'local-operator'}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Activity} label="Tải trung bình" value={`${overview.average_load ?? 0}%`} tone="slate" />
            <MetricCard icon={ShieldAlert} label="Khoa đỏ" value={(overview.critical_departments || []).length} tone="red" />
            <MetricCard icon={Users} label="Luồng đang xử lý" value={overview.active_patient_flows ?? 0} tone="sky" />
            <MetricCard icon={Stethoscope} label="Bác sĩ / Điều dưỡng" value={`${overview.doctor_total ?? 0} / ${overview.nurse_total ?? 0}`} tone="emerald" />
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {[
              ['dashboard', 'Dashboard', LayoutDashboard],
              ['flows', 'Điều phối bệnh nhân', Route],
              ['resources', 'Nhân sự và phòng', Building2],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === key
                    ? 'bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </section>

        {error && <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</section>}
        {busy && <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">Đang đồng bộ dashboard Agent 3...</section>}
        {toast && (
          <section className="fixed right-6 top-20 z-50 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg">
            {toast}
          </section>
        )}

        {activeTab === 'dashboard' && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.78fr)]">
            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Timeline dự báo tải 1-3 giờ</h2>
                    <p className="mt-1 text-sm text-slate-500">FlowPredict dự báo trung bình toàn hệ thống và giờ cao điểm.</p>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                    Peak: {(prediction.peak_hours || []).join(', ') || '--'}
                  </div>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {(prediction.timeline || []).map((slot) => (
                    <div key={slot.hour} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-700">{slot.hour}</span>
                        <span className="text-lg font-black text-slate-900">{slot.average_load}%</span>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            slot.average_load > 80 ? 'bg-red-500' : slot.average_load >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(slot.average_load, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.8fr)]">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Tải realtime theo khoa/phòng</h2>
                      <p className="mt-1 text-sm text-slate-500">Queue status được đồng bộ từ backend Agent 3.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      {departmentLoad.length} khoa/phòng
                    </div>
                  </div>
                  <div className="mt-5 max-h-[470px] space-y-2 overflow-y-auto pr-1">
                    {departmentLoad
                      .slice()
                      .sort((a, b) => b.load_pct - a.load_pct)
                      .map((item) => (
                        <div key={item.department} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                          <div>
                            <div className="font-semibold text-slate-900">{viName(item.department)}</div>
                            <div className="text-xs text-slate-400">
                              Tang {item.floor ?? '-'} · Chờ {formatDuration(item.wait_time)} · BS {item.doctors}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertBadge level={item.alert_level} />
                            <span className="font-bold text-slate-900">{item.load_pct}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                      <ShieldAlert size={14} />
                      Phân tích quá tải
                    </div>
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Quá tải hiện tại</div>
                      <div className="mt-2 text-lg font-black text-slate-900">
                        {(overload.overloaded_departments || []).map((item) => viName(item)).join(', ') || 'Không có'}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {(overload.recommendations || []).map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-3xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                      {latestMetric?.forecast_overloaded_departments?.length
                        ? `Dự báo quá tải: ${latestMetric.forecast_overloaded_departments.map((item) => viName(item)).join(', ')}`
                        : 'Chưa có khoa dự báo quá tải cao trong metric mới nhất.'}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Lịch sử metrics</div>
                    <div className="mt-4 space-y-2">
                      {(metrics || []).slice(0, 6).map((metric) => (
                        <div key={metric.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{metric.average_load}% average load</span>
                            <span className="text-xs text-slate-400">{metric.created_at_iso?.slice(11, 19) || '--:--:--'}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            Waiting {metric.waiting_patients ?? 0} · Rooms {metric.room_total ?? 0} · Staff {metric.staff_total ?? 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                <Bot size={14} />
                Operations Copilot
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Hỏi đáp về điều phối bệnh nhân, cảnh báo quá tải và đề xuất điều động bác sĩ/điều dưỡng.
              </p>

              <div className="mt-5 h-[420px] space-y-3 overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                {opsChatHistory.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-3xl px-4 py-3 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'ml-10 bg-sky-600 text-white shadow-[0_12px_24px_rgba(2,132,199,0.18)]'
                        : 'mr-10 border border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {message.text}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <input
                  value={opsChatInput}
                  onChange={(event) => setOpsChatInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleOpsChat()}
                  placeholder="Ví dụ: 2 giờ tới khoa nào cần bổ sung điều dưỡng?"
                  className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <button onClick={handleOpsChat} className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700">
                  Gửi
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Giờ cao điểm</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{(prediction.peak_hours || []).join(', ') || '--'}</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Bệnh nhân chờ</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{overview.waiting_patients ?? 0}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'flows' && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Điều phối bệnh nhân theo luồng Agent 3</h2>
                  <p className="mt-1 text-sm text-slate-500">Theo dõi route, bước tiếp theo và trạng thái của từng lịch hẹn.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {patientFlows.length} bệnh nhân
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {patientFlows.map((flow) => (
                  <div key={flow.appointment_id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-black text-slate-900">{flow.patient_name || flow.patient_id}</div>
                          <StatusBadge status={flow.status} />
                        </div>
                        <div className="text-sm text-slate-500">
                          Appointment <span className="font-mono text-xs">{flow.appointment_id}</span> · {flow.scheduled_at || 'Chưa có lịch'}
                        </div>
                        <div className="grid gap-2 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Current</div>
                            <div className="mt-2 font-semibold text-slate-900">{viName(flow.current_step || flow.recommended_department || flow.department_name || '-')}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Next step</div>
                            <div className="mt-2 font-semibold text-slate-900">{viName(flow.next_step || '-')}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">ETA</div>
                            <div className="mt-2 font-semibold text-slate-900">{formatDuration(flow.estimated_time)}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(flow.recommended_route || []).map((step, index) => (
                            <span key={`${flow.appointment_id}-${step}-${index}`} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              {index + 1}. {viName(step)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3 lg:w-[270px] lg:grid-cols-1">
                        <button
                          onClick={() => handleFlowStatus(flow, 'waiting')}
                          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Đặt waiting
                        </button>
                        <button
                          onClick={() => handleFlowStatus(flow, 'in_progress')}
                          className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                        >
                          Đang xử lý
                        </button>
                        <button
                          onClick={() => handleFlowStatus(flow, 'completed')}
                          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Hoàn thành
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  <Clock3 size={14} />
                  Priority watchlist
                </div>
                <div className="mt-4 space-y-2">
                  {patientFlows
                    .filter((flow) => flow.status !== 'completed')
                    .slice(0, 6)
                    .map((flow) => (
                      <div key={`watch-${flow.appointment_id}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-900">{flow.patient_name || flow.patient_id}</span>
                          <StatusBadge status={flow.status} />
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Next: {viName(flow.next_step || flow.recommended_department || flow.department_name || '-')}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                  <BedDouble size={14} />
                  Queue pressure
                </div>
                <div className="mt-4 space-y-2">
                  {departmentLoad
                    .slice()
                    .sort((a, b) => b.wait_time - a.wait_time)
                    .slice(0, 8)
                    .map((item) => (
                      <div key={`queue-${item.department}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                        <div>
                          <div className="font-semibold text-slate-900">{viName(item.department)}</div>
                          <div className="text-xs text-slate-400">Chờ {formatDuration(item.wait_time)} · BS {item.doctors}</div>
                        </div>
                        <AlertBadge level={item.alert_level} />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'resources' && (
          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Quản lý bác sĩ và điều dưỡng</h2>
                  <p className="mt-1 text-sm text-slate-500">Thêm, sửa, xóa nhân sự không động vào Agent 2.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {staff.length} nhân sự
                </div>
              </div>

              <form onSubmit={submitStaff} className="mt-5 grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <input
                  value={staffForm.name}
                  onChange={(event) => setStaffForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Họ và tên"
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={staffForm.role}
                    onChange={(event) => setStaffForm((prev) => ({ ...prev, role: event.target.value }))}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="doctor">doctor</option>
                    <option value="nurse">nurse</option>
                  </select>
                  <input
                    value={staffForm.department}
                    onChange={(event) => setStaffForm((prev) => ({ ...prev, department: event.target.value }))}
                    placeholder="Department"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={staffForm.shift}
                    onChange={(event) => setStaffForm((prev) => ({ ...prev, shift: event.target.value }))}
                    placeholder="Shift"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <select
                    value={staffForm.status}
                    onChange={(event) => setStaffForm((prev) => ({ ...prev, status: event.target.value }))}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="active">active</option>
                    <option value="off">off</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                    {editingStaffId ? 'Cập nhật nhân sự' : 'Thêm nhân sự'}
                  </button>
                  {editingStaffId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaffId('')
                        setStaffForm(defaultStaffForm)
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Hủy edit
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {staff.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.role} · {item.department} · {item.shift} · {item.status}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingStaffId(item.id)
                            setStaffForm({
                              name: item.name || '',
                              role: item.role || 'doctor',
                              department: item.department || 'Internal',
                              shift: item.shift || '07:00-15:00',
                              status: item.status || 'active',
                            })
                          }}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => removeStaff(item.id)}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Quản lý phòng khám và hospital map</h2>
                  <p className="mt-1 text-sm text-slate-500">Phòng mới được lưu riêng trong Agent 3 map, không overwrite shell cũ.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {managedRooms.length} phòng
                </div>
              </div>

              <form onSubmit={submitRoom} className="mt-5 grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={roomForm.department}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, department: event.target.value }))}
                    placeholder="Department"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <input
                    value={roomForm.room_name}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, room_name: event.target.value }))}
                    placeholder="Room name"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={roomForm.room_code}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, room_code: event.target.value }))}
                    placeholder="Room code"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <input
                    value={roomForm.block}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, block: event.target.value }))}
                    placeholder="Block"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    type="number"
                    value={roomForm.floor}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, floor: Number(event.target.value) }))}
                    placeholder="Floor"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <input
                    type="number"
                    value={roomForm.capacity}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, capacity: Number(event.target.value) }))}
                    placeholder="Capacity"
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <select
                    value={roomForm.room_type}
                    onChange={(event) => setRoomForm((prev) => ({ ...prev, room_type: event.target.value }))}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="clinic">clinic</option>
                    <option value="service">service</option>
                    <option value="support">support</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                    {editingRoomId ? 'Cap nhat phong' : 'Them phong'}
                  </button>
                  {editingRoomId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoomId('')
                        setRoomForm(defaultRoomForm)
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Huy edit
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {managedRooms.map((room) => (
                  <div key={room.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{room.room_name || room.department}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {room.department} · {room.room_code} · {room.block} · Tang {room.floor} · cap {room.capacity}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingRoomId(room.id)
                            setRoomForm({
                              department: room.department || 'Internal',
                              room_name: room.room_name || room.department || 'Phong moi',
                              room_code: room.room_code || 'PK-NEW',
                              block: room.block || 'A1 (Noi khoa)',
                              floor: Number(room.floor || 1),
                              capacity: Number(room.capacity || 20),
                              room_type: room.room_type || 'clinic',
                              status: room.status || 'active',
                            })
                          }}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Sua
                        </button>
                        <button
                          onClick={() => removeRoom(room.id)}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Xoa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
