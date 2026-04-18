import { useEffect, useMemo, useState } from 'react'
import { Activity, CheckCircle2, Clock3, MapPinned, MessageSquareText, Route, Sparkles } from 'lucide-react'

import { groupName, roomCode, roomSide, viName } from '../features/agent3/metadata'
import {
  fetchDepartmentLoad,
  fetchDepartments,
  fetchOverloadAnalysis,
  fetchPatientOrders,
  fetchPatientState,
  fetchPredictLoad,
  nowVsLaterAPI,
  optimizeRouteAPI,
  patientChatAPI,
  suggestTimeAPI,
  updatePatientProgressAPI,
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

function SummaryCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-xs uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
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

export default function PatientNavigatorPage({ user }) {
  const patientId = user?.uid || 'P001'
  const patientLabel = user?.full_name || user?.email || patientId

  const [departments, setDepartments] = useState([])
  const [selected, setSelected] = useState([])
  const [routeResult, setRouteResult] = useState(null)
  const [predict, setPredict] = useState(null)
  const [overload, setOverload] = useState(null)
  const [nowLater, setNowLater] = useState(null)
  const [suggest, setSuggest] = useState(null)
  const [patientState, setPatientState] = useState(null)
  const [departmentLoad, setDepartmentLoad] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [flowAccepted, setFlowAccepted] = useState(false)
  const [activePanel, setActivePanel] = useState('selector')
  const [activeBlockFilter, setActiveBlockFilter] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'Xin chào, bạn có thể hỏi: khoa Tim mạch ở tầng mấy?' },
  ])

  useEffect(() => {
    let cancelled = false

    const loadAll = async () => {
      try {
        setBusy(true)
        setError('')
        const [departmentRows, predictData, overloadData, stateData, loadData, orderData] = await Promise.all([
          fetchDepartments(),
          fetchPredictLoad(),
          fetchOverloadAnalysis(),
          fetchPatientState(patientId),
          fetchDepartmentLoad(),
          fetchPatientOrders(patientId),
        ])
        if (cancelled) return
        setDepartments(departmentRows || [])
        setPredict(predictData || null)
        setOverload(overloadData || null)
        setPatientState(stateData || { current_step: 'Registration', completed: [] })
        setDepartmentLoad(loadData || [])
        setSelected(orderData?.orders || [])
        setRouteResult(null)
        setFlowAccepted(false)
      } catch (err) {
        if (cancelled) return
        setError(err?.message || 'Không tải được dữ liệu Agent 3.')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }

    loadAll()
    return () => {
      cancelled = true
    }
  }, [patientId])

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const [predictData, overloadData, loadData] = await Promise.all([
          fetchPredictLoad(),
          fetchOverloadAnalysis(),
          fetchDepartmentLoad(),
        ])
        setPredict(predictData || null)
        setOverload(overloadData || null)
        setDepartmentLoad(loadData || [])
      } catch (_) {
        return
      }
    }, 20000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const groupedDepartments = useMemo(() => {
    const groups = {}
    for (const department of departments) {
      const group = groupName(department)
      if (!groups[group]) groups[group] = []
      groups[group].push(department)
    }
    return Object.entries(groups)
      .map(([group, items]) => [group, items.sort((a, b) => viName(a).localeCompare(viName(b)))])
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [departments])

  const routeTimeline = routeResult?.optimal_route || []
  const hasRoute = routeTimeline.length > 0
  const completedSet = useMemo(() => new Set(patientState?.completed || []), [patientState])
  const nextStep = routeTimeline.find((step) => !completedSet.has(step))
  const progressPct = routeTimeline.length
    ? Math.round((routeTimeline.filter((step) => completedSet.has(step)).length / routeTimeline.length) * 100)
    : 0
  const allDone = routeTimeline.length > 0 && routeTimeline.every((step) => completedSet.has(step))
  const avgLoad = departmentLoad.length
    ? Math.round(departmentLoad.reduce((sum, item) => sum + item.load_pct, 0) / departmentLoad.length)
    : 0
  const criticalCount = departmentLoad.filter((item) => item.alert_level === 'red').length
  const routeOrderMap = useMemo(
    () => Object.fromEntries(routeTimeline.map((step, index) => [step, index + 1])),
    [routeTimeline]
  )

  const floorPlan = useMemo(() => {
    const buckets = {}
    for (const item of departmentLoad) {
      const block = item.block || 'A1 (Khác)'
      const floor = typeof item.floor === 'number' ? item.floor : 1
      if (!buckets[block]) buckets[block] = {}
      if (!buckets[block][floor]) buckets[block][floor] = []
      buckets[block][floor].push(item.department)
    }

    return Object.entries(buckets)
      .map(([block, floors]) => ({
        block,
        floors: Object.entries(floors)
          .map(([floor, rooms]) => ({
            floor: Number(floor),
            rooms: rooms.sort((a, b) => viName(a).localeCompare(viName(b))),
          }))
          .sort((a, b) => b.floor - a.floor),
      }))
      .sort((a, b) => a.block.localeCompare(b.block))
  }, [departmentLoad])

  const refreshPatientState = async () => {
    const stateData = await fetchPatientState(patientId)
    setPatientState(stateData || { current_step: 'Registration', completed: [] })
  }

  const runOptimize = async () => {
    try {
      setBusy(true)
      setError('')
      const data = await optimizeRouteAPI({
        patient_id: patientId,
        departments: selected,
        patient_state: patientState || { current_step: 'Registration', completed: [] },
        constraints: { elderly: false, wheelchair: false, priority: 'normal' },
      })
      setRouteResult(data)
      setFlowAccepted(false)
      setActivePanel('route')
      setToast('Đã tối ưu lộ trình mới.')
    } catch (err) {
      setError(err?.message || 'Tối ưu route thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const runSuggest = async () => {
    try {
      setBusy(true)
      setSuggest(
        await suggestTimeAPI({
          patient_id: patientId,
          departments: selected,
          lookahead_hours: 3,
        })
      )
    } catch (err) {
      setError(err?.message || 'Không gợi ý được thời điểm.')
    } finally {
      setBusy(false)
    }
  }

  const runNowVsLater = async () => {
    try {
      setBusy(true)
      setNowLater(await nowVsLaterAPI(selected, 2))
    } catch (err) {
      setError(err?.message || 'Không so sánh được phương án đi sau.')
    } finally {
      setBusy(false)
    }
  }

  const completeStep = async (step) => {
    try {
      setBusy(true)
      const reroute = await updatePatientProgressAPI(patientId, {
        completed_step: step,
        current_step: null,
      })
      setPatientState(reroute?.patient_state || patientState)
      setRouteResult((prev) => {
        const nextRoute = reroute?.reroute
        if (nextRoute?.optimal_route?.length) return nextRoute
        return prev
      })
      setToast(`Đã đánh dấu hoàn thành ${viName(step)}.`)
      await refreshPatientState()
    } catch (err) {
      setError(err?.message || 'Cập nhật checklist thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const handleChatAsk = async () => {
    const text = chatInput.trim()
    if (!text) return
    setChatHistory((prev) => [...prev, { role: 'user', text }])
    setChatInput('')
    try {
      const historyPayload = chatHistory.slice(-8).map((item) => ({
        role: item.role === 'bot' ? 'assistant' : 'user',
        text: item.text,
      }))
      const response = await patientChatAPI(patientId, {
        message: text,
        history: historyPayload,
        departments_context: routeTimeline.length > 0 ? routeTimeline : selected,
      })
      setChatHistory((prev) => [...prev, { role: 'bot', text: response?.reply || 'Mình chưa có phản hồi phù hợp.' }])
    } catch (_) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'bot', text: 'Mình đang bận kết nối AI. Bạn thử hỏi lại sau vài giây nhé.' },
      ])
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.10),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#f5f7fb_100%)]">
      <div className="mx-auto max-w-[1580px] px-5 py-6 lg:px-8 lg:py-8 space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                <MapPinned size={14} />
                Agent 3 Navigator
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">Điều hướng bệnh viện theo role patient</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 shadow-inner">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Patient Context</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{patientLabel}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">{patientId}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Tải trung bình" value={`${avgLoad}%`} tone="slate" />
            <SummaryCard label="Khoa đỏ" value={criticalCount} tone="red" />
            <SummaryCard label="Giờ cao điểm" value={predict?.peak_hours?.[0] || '--:--'} tone="sky" />
            <SummaryCard label="Cảnh báo nhanh" value={overload?.recommendations?.[0] || 'Đang phân tích'} tone="indigo" />
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {[
              ['selector', 'Danh sách khoa', Route],
              ['route', 'Lộ trình + Mini-map', MapPinned],
              ['checklist', 'Checklist', CheckCircle2],
              ['chat', 'Chat trong bệnh viện', MessageSquareText],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setActivePanel(key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activePanel === key
                    ? 'bg-sky-600 text-white shadow-[0_12px_24px_rgba(2,132,199,0.28)]'
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
        {busy && <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">Đang đồng bộ dữ liệu Agent 3...</section>}
        {toast && (
          <section className="fixed right-6 top-20 z-50 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg">
            {toast}
          </section>
        )}

        {activePanel === 'selector' && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Hành trình hiện tại</h2>
                  <p className="mt-1 text-sm text-slate-500">Orders được lấy từ lịch hẹn và EMR. Bạn có thể bật/tắt để AI tối ưu lại route.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  {selected.length} mục đang được chọn
                </div>
              </div>

              <div className="mt-5 max-h-[620px] space-y-4 overflow-y-auto pr-1">
                {groupedDepartments.map(([group, items]) => (
                  <div key={group} className="rounded-3xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{group}</h3>
                      <div className="text-xs text-slate-400">{items.length} khoa/phòng</div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {items.map((department) => {
                        const active = selected.includes(department)
                        return (
                          <button
                            key={department}
                            onClick={() =>
                              setSelected((prev) =>
                                prev.includes(department) ? prev.filter((item) => item !== department) : [...prev, department]
                              )
                            }
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              active
                                ? 'border-sky-400 bg-sky-50 text-sky-900 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-semibold">{viName(department)}</div>
                            <div className="mt-1 text-xs opacity-70">
                              {department} - {roomCode(department)}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                  <Sparkles size={14} />
                  Action Deck
                </div>
                <div className="mt-5 space-y-3">
                  <button onClick={runOptimize} className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700">
                    Tối ưu lộ trình
                  </button>
                  <button onClick={runSuggest} className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
                    Gợi ý giờ đi
                  </button>
                  <button onClick={runNowVsLater} className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                    So sánh đi ngay và +2 giờ
                  </button>
                </div>
                <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current State</div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Bước hiện tại</span>
                    <span className="font-semibold text-slate-900">{viName(patientState?.current_step || 'Registration')}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Đã hoàn thành</span>
                    <span className="font-semibold text-slate-900">{patientState?.completed?.length || 0} bước</span>
                  </div>
                </div>
                {suggest && (
                  <div className="mt-4 rounded-3xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                    Nên đi sau <span className="font-bold">{suggest.recommended_offset_hours}</span> giờ, dự kiến còn{' '}
                    <span className="font-bold">{formatDuration(suggest.estimated_time)}</span>.
                  </div>
                )}
                {nowLater && (
                  <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Khuyến nghị: <span className="font-bold">{nowLater.recommendation}</span>. Đi ngay ~{' '}
                    <span className="font-bold">{formatDuration(nowLater.now?.estimated_time)}</span>, đi sau ~{' '}
                    <span className="font-bold">{formatDuration(nowLater.later?.estimated_time)}</span>.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activePanel === 'route' && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Lộ trình đề xuất</h2>
                  <p className="mt-1 text-sm text-slate-500">Route được tối ưu theo tải khoa + ràng buộc y khoa.</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                  {formatDuration(routeResult?.estimated_time)}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {routeTimeline.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 px-5 py-12 text-center text-sm text-slate-400">
                    Chưa có route. Quay lại tab "Danh sách khoa" và chọn "Tối ưu lộ trình".
                  </div>
                )}
                {routeTimeline.map((step, index) => (
                  <div key={`${step}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-slate-900">{viName(step)}</div>
                        <div className="text-xs text-slate-400">
                          {roomCode(step)} - {roomSide(step)}
                        </div>
                      </div>
                    </div>
                    {completedSet.has(step) ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Đã xong</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Đang chờ</span>
                    )}
                  </div>
                ))}
              </div>

              {routeResult?.reasoning?.length > 0 && (
                <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">AI Explanation</div>
                  <ul className="mt-3 space-y-2 text-sm text-sky-900">
                    {routeResult.reasoning.map((line) => (
                      <li key={line} className="rounded-2xl bg-white/80 px-3 py-2">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {routeResult && !flowAccepted && (
                <button
                  onClick={() => {
                    setFlowAccepted(true)
                    setActivePanel('checklist')
                  }}
                  className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Tôi đồng ý lộ trình này - Bắt đầu checklist
                </button>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Mini-map theo khu và tầng</h2>
                  <p className="mt-1 text-sm text-slate-500">Phòng nằm trong route được đánh số thứ tự và tô màu xanh.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {floorPlan.map((block) => (
                    <button
                      key={block.block}
                      onClick={() => setActiveBlockFilter(activeBlockFilter === block.block ? null : block.block)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        activeBlockFilter === block.block ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {block.block}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 max-h-[620px] space-y-4 overflow-y-auto pr-1">
                {floorPlan
                  .filter((block) => !activeBlockFilter || block.block === activeBlockFilter)
                  .map((block) => (
                    <div key={block.block} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800">
                        Khu {block.block}
                      </div>
                      <div className="mt-3 space-y-3">
                        {block.floors.map((floor) => (
                          <div key={`${block.block}-${floor.floor}`} className="grid grid-cols-[72px,1fr] gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center">
                              <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Tầng</div>
                              <div className="mt-2 text-xl font-black text-slate-900">{floor.floor}</div>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {floor.rooms.map((room) => {
                                const inRoute = Boolean(routeOrderMap[room])
                                return (
                                  <div
                                    key={`${block.block}-${floor.floor}-${room}`}
                                    className={`rounded-2xl border px-3 py-3 text-sm ${
                                      inRoute
                                        ? 'border-sky-300 bg-sky-50 text-sky-900'
                                        : 'border-slate-200 bg-white text-slate-500'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold">{viName(room)}</span>
                                      {inRoute && (
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
                                          {routeOrderMap[room]}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-xs opacity-70">{roomCode(room)}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

        {activePanel === 'checklist' && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Checklist hành trình</h2>
                  <p className="mt-1 text-sm text-slate-500">Đánh dấu từng bước khi đã đến đúng phòng/khoa.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  {progressPct}% complete
                </div>
              </div>

              {!hasRoute && (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                  <div className="text-base font-bold text-slate-900">Chưa có lộ trình để checklist</div>
                  <div className="mt-2 text-sm text-slate-500">
                    Hãy chọn các mục cần đi trong tab "Danh sách khoa", sau đó sang "Lộ trình + Mini-map" để tối ưu route.
                  </div>
                </div>
              )}

              {hasRoute && !flowAccepted && (
                <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  Hãy sang tab "Lộ trình + Mini-map", đồng ý route trước khi kích hoạt checklist.
                </div>
              )}

              {hasRoute && flowAccepted && (
                <>
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <span>Tiến độ</span>
                      <span className="text-sky-700">{progressPct}%</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-500" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {routeTimeline.map((step, index) => {
                      const done = completedSet.has(step)
                      return (
                        <div key={`${step}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                          <div className="flex items-center gap-3 text-sm text-slate-700">
                            <input type="checkbox" checked={done} readOnly className="h-4 w-4 rounded border-slate-300" />
                            <span className="font-semibold">{viName(step)}</span>
                          </div>
                          {!done && (
                            <button
                              onClick={() => completeStep(step)}
                              className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                            >
                              Tick hoàn thành
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                <CheckCircle2 size={14} />
                Journey Status
              </div>
              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {!hasRoute ? (
                  <>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Bước tiếp theo</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">Chưa có lộ trình</div>
                    <div className="mt-1 text-sm text-slate-500">Tối ưu route trước để hệ thống tạo checklist và bước kế tiếp.</div>
                  </>
                ) : allDone ? (
                  <div className="text-sm font-semibold text-emerald-700">Bạn đã hoàn tất toàn bộ quy trình khám.</div>
                ) : (
                  <>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Bước tiếp theo</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{viName(nextStep || 'Đang cập nhật')}</div>
                    <div className="mt-1 text-sm text-slate-500">{nextStep ? `${roomCode(nextStep)} - ${roomSide(nextStep)}` : 'Đang chờ hệ thống reroute.'}</div>
                  </>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    <Clock3 size={14} />
                    Peak Hour
                  </div>
                  <div className="mt-3 text-xl font-black text-slate-900">{predict?.peak_hours?.join(', ') || '--'}</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    <Activity size={14} />
                    Overload
                  </div>
                  <div className="mt-3 text-xl font-black text-slate-900">{criticalCount} khoa đỏ</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activePanel === 'chat' && (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.7fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Chat hỏi đường đi</h2>
                  <p className="mt-1 text-sm text-slate-500">Hỏi về khoa, tầng, khu, thứ tự di chuyển trong bệnh viện.</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">Realtime hospital guide</div>
              </div>

              <div className="mt-5 h-[460px] space-y-3 overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                {chatHistory.map((message, index) => (
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
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleChatAsk()}
                  placeholder="Ví dụ: từ khoa Tiêu hóa tới quầy thuốc đi thế nào?"
                  className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <button onClick={handleChatAsk} className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700">
                  Gửi
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  <Route size={14} />
                  Quick Ask
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    'Khoa Tim mạch ở tầng mấy?',
                    'Tôi đang ở quầy tiếp nhận, đến phòng Imaging bằng cách nào?',
                    'Sau khi xét nghiệm xong tôi đi đâu?',
                    'Quầy thuốc nằm ở khu nào?',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setChatInput(prompt)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-100"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Live load by department</div>
                <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
                  {departmentLoad
                    .slice()
                    .sort((a, b) => b.load_pct - a.load_pct)
                    .slice(0, 10)
                    .map((department) => (
                      <div key={department.department} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                        <div>
                          <div className="font-semibold text-slate-900">{viName(department.department)}</div>
                          <div className="text-xs text-slate-400">
                            Tầng {department.floor ?? '-'} - Chờ {formatDuration(department.wait_time)} - BS {department.doctors}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertBadge level={department.alert_level} />
                          <span className="font-bold text-slate-900">{department.load_pct}%</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
