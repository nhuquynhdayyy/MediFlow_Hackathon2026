"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchDepartmentLoad,
  fetchDepartments,
  fetchOverloadAnalysis,
  fetchPatientOrders,
  fetchPatientState,
  fetchPredictLoad,
  nowVsLaterAPI,
  hospitalOpsChatAPI,
  patientChatAPI,
  optimizeRouteAPI,
  suggestTimeAPI,
  updatePatientProgressAPI,
} from "@/services/api";

type TabId = "navigator" | "flow" | "now-later" | "operations";
type ChatRole = "user" | "bot";

type DeptMeta = {
  vi: string;
  group: string;
  roomCode?: string;
  side?: string;
  note?: string;
  mapX?: number;
  mapY?: number;
};

const DEPT_META: Record<string, DeptMeta> = {
  Registration: { vi: "Tiếp nhận", group: "Hành chính", roomCode: "P101", side: "Cánh trái", note: "Ngay sảnh vào", mapX: 15, mapY: 18 },
  Lab: { vi: "Xét nghiệm", group: "Cận lâm sàng", roomCode: "P201", side: "Cánh phải", note: "Sau quầy thuốc", mapX: 78, mapY: 70 },
  Imaging: { vi: "Chẩn đoán hình ảnh", group: "Cận lâm sàng", roomCode: "P202", side: "Cánh phải", note: "Đối diện khu xét nghiệm", mapX: 68, mapY: 32 },
  Pharmacy: { vi: "Quầy thuốc", group: "Cận lâm sàng", roomCode: "P203", side: "Cánh phải", note: "Gần lối ra", mapX: 58, mapY: 72 },
  Internal: { vi: "Nội tổng quát", group: "Nội khoa", roomCode: "P301", side: "Trung tâm", note: "Cuối hành lang chính", mapX: 44, mapY: 52 },
  Cardiology: { vi: "Tim mạch", group: "Nội khoa", roomCode: "P302", side: "Cánh phải", note: "Sau khu nội tổng quát", mapX: 63, mapY: 50 },
  Neurology: { vi: "Thần kinh", group: "Nội khoa", roomCode: "P303", side: "Cánh trái", note: "Bên trái nội tổng quát", mapX: 28, mapY: 52 },
  Gastroenterology: { vi: "Tiêu hóa", group: "Nội khoa", roomCode: "P304", side: "Cánh trái", note: "Cuối hành lang trái", mapX: 20, mapY: 68 },
  Pulmonology: { vi: "Hô hấp", group: "Nội khoa", roomCode: "P305", side: "Trung tâm", note: "Cạnh thang máy", mapX: 46, mapY: 32 },
  Endocrinology: { vi: "Nội tiết", group: "Nội khoa", roomCode: "P306", side: "Trung tâm", note: "Gần phòng nội tổng quát", mapX: 50, mapY: 44 },
  Nephrology: { vi: "Thận", group: "Nội khoa", roomCode: "P307", side: "Cánh phải", note: "Bên cạnh tim mạch", mapX: 72, mapY: 50 },
  Oncology: { vi: "Ung bướu", group: "Nội khoa", roomCode: "P308", side: "Cánh phải", note: "Cuối hành lang phải", mapX: 84, mapY: 50 },
  Orthopedics: { vi: "Chấn thương chỉnh hình", group: "Ngoại & Cơ xương khớp", roomCode: "P401", side: "Cánh trái", note: "Gần khu cấp cứu", mapX: 14, mapY: 78 },
  Rehabilitation: { vi: "Phục hồi chức năng", group: "Ngoại & Cơ xương khớp", roomCode: "P402", side: "Cánh trái", note: "Sau phòng chấn thương", mapX: 24, mapY: 84 },
  ENT: { vi: "Tai Mũi Họng", group: "Tai Mũi Họng", roomCode: "P501", side: "Cánh phải", note: "Đầu hành lang phải", mapX: 76, mapY: 40 },
  Pediatrics: { vi: "Nhi", group: "Sản - Nhi", roomCode: "P601", side: "Cánh trái", note: "Gần khu vui chơi trẻ em", mapX: 18, mapY: 40 },
  OBGYN: { vi: "Sản phụ khoa", group: "Sản - Nhi", roomCode: "P602", side: "Cánh trái", note: "Tầng trên khu nhi", mapX: 22, mapY: 30 },
  Dermatology: { vi: "Da liễu", group: "Khác", roomCode: "P701", side: "Trung tâm", note: "Gần quầy hướng dẫn", mapX: 40, mapY: 26 },
};

function viName(dep: string): string {
  return DEPT_META[dep]?.vi || dep;
}

function groupName(dep: string): string {
  return DEPT_META[dep]?.group || "Khác";
}

function AlertBadge({ level }: { level: string }) {
  const style =
    level === "red"
      ? "bg-red-100 text-red-700 border-red-200"
      : level === "yellow"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-emerald-100 text-emerald-700 border-emerald-200";
  const label = level === "red" ? "Đỏ" : level === "yellow" ? "Vàng" : "Xanh";
  return <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${style}`}>{label}</span>;
}

export default function Home() {
  const [tab, setTab] = useState<TabId>("navigator");
  const [patientId, setPatientId] = useState("P001");
  const [departments, setDepartments] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [routeResult, setRouteResult] = useState<any>(null);
  const [predict, setPredict] = useState<any>(null);
  const [overload, setOverload] = useState<any>(null);
  const [nowLater, setNowLater] = useState<any>(null);
  const [suggest, setSuggest] = useState<any>(null);
  const [patientState, setPatientState] = useState<any>(null);
  const [departmentLoad, setDepartmentLoad] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flowAccepted, setFlowAccepted] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [activeNavigatorPanel, setActiveNavigatorPanel] = useState<"selector" | "route" | "checklist" | "chat">("selector");
  const [activeBlockFilter, setActiveBlockFilter] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: ChatRole; text: string }>>([
    { role: "bot", text: "Xin chào, bạn có thể hỏi: 'Khoa Tim mạch ở tầng mấy?'" },
  ]);
  const [opsChatInput, setOpsChatInput] = useState("");
  const [opsChatHistory, setOpsChatHistory] = useState<Array<{ role: ChatRole; text: string }>>([
    { role: "bot", text: "Operations Copilot sẵn sàng. Bạn có thể hỏi về lưu lượng, xu hướng tăng/giảm và điều phối nhân sự." },
  ]);

  const tabs: Array<{ id: TabId; label: string; short: string }> = [
    { id: "navigator", label: "Điều hướng bệnh nhân", short: "Navigator" },
    { id: "flow", label: "Dự báo lưu lượng", short: "FlowPredict" },
    { id: "now-later", label: "Đi ngay vs đi sau", short: "Now vs Later" },
    { id: "operations", label: "Điều hành bệnh viện", short: "Operations" },
  ];

  useEffect(() => {
    const init = async () => {
      try {
        setError(null);
        const [dep, p, o, s, load] = await Promise.all([
          fetchDepartments(),
          fetchPredictLoad(),
          fetchOverloadAnalysis(),
          fetchPatientState(patientId),
          fetchDepartmentLoad(),
        ]);
        setDepartments(dep);
        setPredict(p);
        setOverload(o);
        setPatientState(s);
        setDepartmentLoad(load);
        const emr = await fetchPatientOrders(patientId);
        setSelected(emr.orders || []);
        setFlowAccepted(false);
        setRouteResult(null);
      } catch (e: any) {
        setError(e?.message || "Không tải được dữ liệu từ backend");
      }
    };
    init();
  }, [patientId]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [p, o, load] = await Promise.all([fetchPredictLoad(), fetchOverloadAnalysis(), fetchDepartmentLoad()]);
        setPredict(p);
        setOverload(o);
        setDepartmentLoad(load);
      } catch (_e) {
        // keep current data
      }
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const optimize = async () => {
    try {
      setBusy(true);
      setError(null);
      const data = await optimizeRouteAPI({
        patient_id: patientId,
        departments: selected,
        patient_state: patientState,
        constraints: { elderly: false, wheelchair: false, priority: "normal" },
      });
      setRouteResult(data);
      setFlowAccepted(false);
      setToast("Đã tối ưu lộ trình mới. Hãy xác nhận để bắt đầu checklist.");
    } catch (e: any) {
      setError(e?.message || "Tối ưu route thất bại");
    } finally {
      setBusy(false);
    }
  };

  const runNowVsLater = async () => {
    try {
      setBusy(true);
      setNowLater(await nowVsLaterAPI(selected, 2));
    } catch (e: any) {
      setError(e?.message || "Không so sánh được now vs later");
    } finally {
      setBusy(false);
    }
  };

  const runSuggest = async () => {
    try {
      setBusy(true);
      setSuggest(await suggestTimeAPI({ patient_id: patientId, departments: selected, lookahead_hours: 3 }));
    } catch (e: any) {
      setError(e?.message || "Không gợi ý được thời điểm");
    } finally {
      setBusy(false);
    }
  };

  const completeStep = async (step: string) => {
    try {
      setBusy(true);
      const reroute = await updatePatientProgressAPI(patientId, { completed_step: step, current_step: null });
      setPatientState(reroute.patient_state);
      setRouteResult(reroute.reroute);
      setToast(`Đã ghi nhận hoàn thành ${viName(step)} và cập nhật lại lộ trình.`);
    } catch (e: any) {
      setError(e?.message || "Cập nhật tiến trình thất bại");
    } finally {
      setBusy(false);
    }
  };

  const routeTimeline: string[] = useMemo(() => routeResult?.optimal_route || [], [routeResult]);
  const completedSet = useMemo(
    () => new Set<string>(patientState?.completed || []),
    [patientState]
  );
  const criticalCount = departmentLoad.filter((d) => d.alert_level === "red").length;
  const avgLoad = departmentLoad.length
    ? Math.round(departmentLoad.reduce((sum, d) => sum + d.load_pct, 0) / departmentLoad.length)
    : 0;

  const groupedDepartments = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const dep of departments) {
      const group = groupName(dep);
      if (!groups[group]) groups[group] = [];
      groups[group].push(dep);
    }
    return groups;
  }, [departments]);

  const nextStep = routeTimeline.find((s) => !completedSet.has(s));
  const allDone = routeTimeline.length > 0 && routeTimeline.every((s) => completedSet.has(s));
  
  const completedCount = routeTimeline.filter((s) => completedSet.has(s)).length;
  const progressPct = routeTimeline.length ? Math.round((completedCount / routeTimeline.length) * 100) : 0;
  
  const routeOrderMap = useMemo(
    () => Object.fromEntries(routeTimeline.map((step, idx) => [step, idx + 1])),
    [routeTimeline]
  );
  const floorPlan = useMemo(() => {
    const buckets: Record<string, Record<number, string[]>> = {};
    for (const item of departmentLoad) {
      const block = item.block || "A (Khác)";
      const floor = typeof item.floor === "number" ? item.floor : 1;
      if (!buckets[block]) buckets[block] = {};
      if (!buckets[block][floor]) buckets[block][floor] = [];
      buckets[block][floor].push(item.department);
    }
    return Object.entries(buckets)
      .map(([block, floorsObj]) => {
        const floors = Object.entries(floorsObj)
          .map(([floor, rooms]) => ({ floor: Number(floor), rooms: rooms.sort((a, b) => viName(a).localeCompare(viName(b))) }))
          .sort((a, b) => a.floor - b.floor);
        return { block, floors };
      })
      .sort((a, b) => a.block.localeCompare(b.block));
  }, [departmentLoad]);

  const handleChatAsk = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatHistory((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    try {
      const historyPayload = chatHistory.slice(-8).map((m) => ({
        role: (m.role === "bot" ? "assistant" : "user") as "assistant" | "user",
        text: m.text,
      }));
      const res = await patientChatAPI(patientId, {
        message: text,
        history: historyPayload,
        departments_context: routeTimeline.length > 0 ? routeTimeline : selected,
      });
      setChatHistory((prev) => [...prev, { role: "bot", text: res.reply || "Mình chưa có phản hồi phù hợp." }]);
    } catch (_e) {
      const fallback = "Mình đang bận kết nối AI. Bạn thử hỏi lại sau vài giây nhé.";
      setChatHistory((prev) => [...prev, { role: "bot", text: fallback }]);
    }
  };

  const handleOpsChatAsk = async () => {
    const text = opsChatInput.trim();
    if (!text) return;
    setOpsChatHistory((prev) => [...prev, { role: "user", text }]);
    setOpsChatInput("");
    try {
      const historyPayload = opsChatHistory.slice(-10).map((m) => ({
        role: (m.role === "bot" ? "assistant" : "user") as "assistant" | "user",
        text: m.text,
      }));
      const res = await hospitalOpsChatAPI({ message: text, history: historyPayload });
      setOpsChatHistory((prev) => [...prev, { role: "bot", text: res.reply || "Mình chưa có phản hồi phù hợp." }]);
    } catch (_e) {
      setOpsChatHistory((prev) => [
        ...prev,
        { role: "bot", text: "Mình đang bận kết nối AI vận hành. Bạn thử lại sau vài giây nhé." },
      ]);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const togglePanel = (key: "selector" | "route" | "checklist" | "chat") => {
    setActiveNavigatorPanel(key);
  };

  return (
    <main className="mx-auto max-w-[1600px] p-7 lg:p-8 space-y-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Navigator AI</h1>
            <p className="text-sm text-slate-500 mt-1">Điều hướng khám bệnh theo thời gian thực</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-slate-600">Patient ID</span>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm font-semibold"
            >
              {["P001", "P002", "P003"].map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Tải trung bình</p>
            <p className="text-2xl font-bold text-slate-900">{avgLoad}%</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-500">Khoa đỏ</p>
            <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-xs text-sky-500">Giờ cao điểm</p>
            <p className="text-xl font-bold text-sky-700">{predict?.peak_hours?.[0] || "--:--"}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs text-indigo-500">Khuyến nghị nhanh</p>
            <p className="text-sm font-bold text-indigo-700">{overload?.recommendations?.[0] || "Đang phân tích..."}</p>
          </div>
        </div>
      </section>

      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === item.id
                ? "bg-sky-600 text-white shadow"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="hidden md:inline">{item.label}</span>
            <span className="md:hidden">{item.short}</span>
          </button>
        ))}
      </div>

      {error && <section className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</section>}
      {busy && <section className="bg-sky-50 border border-sky-200 text-sky-700 rounded-xl p-3 text-sm">Đang đồng bộ dữ liệu với backend...</section>}
      {toast && (
        <section className="fixed right-6 top-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold">
          {toast}
        </section>
      )}

      {tab === "navigator" && (
        <>
          <section className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-600 mr-2">Menu hiển thị:</span>
            <button
              onClick={() => togglePanel("selector")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                activeNavigatorPanel === "selector" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              Danh sách khoa
            </button>
            <button
              onClick={() => togglePanel("route")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                activeNavigatorPanel === "route" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              Lộ trình + Mini-map
            </button>
            <button
              onClick={() => togglePanel("checklist")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                activeNavigatorPanel === "checklist" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              Checklist
            </button>
            <button
              onClick={() => togglePanel("chat")}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                activeNavigatorPanel === "chat" ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              Chat điều hướng
            </button>
          </section>

          <section className="grid grid-cols-1 gap-4">
          {activeNavigatorPanel === "selector" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-lg">Chọn khoa theo nhóm chuyên khoa</h2>
            <p className="text-xs text-slate-500">Order mặc định lấy từ EMR. Bạn có thể chỉnh theo thực tế.</p>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {Object.entries(groupedDepartments).map(([group, list]) => (
                <div key={group} className="border border-slate-200 rounded-xl p-3">
                  <p className="font-semibold text-sm mb-2">{group}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {list.map((dep) => (
                      <button
                        key={dep}
                        onClick={() =>
                          setSelected((prev) =>
                            prev.includes(dep) ? prev.filter((x) => x !== dep) : [...prev, dep]
                          )
                        }
                        className={`px-3 py-2 text-sm rounded-lg border text-left transition ${
                          selected.includes(dep)
                            ? "bg-sky-100 border-sky-500 text-sky-800"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {viName(dep)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={optimize} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-2 font-semibold">
                Tối ưu lộ trình
              </button>
              <button onClick={runSuggest} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 font-semibold">
                Gợi ý giờ đi
              </button>
              <button onClick={runNowVsLater} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 font-semibold">
                So sánh +2 giờ
              </button>
            </div>
          </div>
          )}

          {activeNavigatorPanel === "route" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Lộ trình đề xuất</h2>
              <span className="text-xs px-2 py-1 rounded bg-sky-100 text-sky-700 font-semibold">
                Tối ưu: {routeResult?.estimated_time ?? "--"} phút
              </span>
            </div>
            <div className="space-y-2">
              {routeTimeline.map((step: string, idx: number) => (
                <div key={step + idx} className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                    <span className="font-semibold text-slate-800">{viName(step)}</span>
                  </span>
                  {completedSet.has(step) ? (
                    <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 font-semibold">Đã xong</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-semibold">Chưa xong</span>
                  )}
                </div>
              ))}
              {routeTimeline.length === 0 && (
                <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400">
                  Hãy nhấn "Tối ưu lộ trình" để tạo danh sách đi khám.
                </div>
              )}
            </div>
            {routeResult?.reasoning?.length > 0 && (
              <div className="mt-2 bg-sky-50 border border-sky-200 rounded p-3">
                <p className="font-semibold text-sm mb-1">Giải thích từ AI</p>
                <ul className="list-disc ml-5 text-sm space-y-1">
                  {routeResult.reasoning.map((line: string) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {routeTimeline.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-3 bg-white">
                <div className="flex flex-col sm:flex-row items-baseline sm:justify-between mb-2">
                  <p className="font-semibold text-sm">Mini-map theo Khu và Tầng</p>
                  <div className="flex bg-slate-100 p-1 rounded-lg gap-1 mt-2 sm:mt-0">
                    {floorPlan.map(b => (
                      <button
                        key={`tab-${b.block}`}
                        onClick={() => setActiveBlockFilter(activeBlockFilter === b.block ? null : b.block)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                          activeBlockFilter === b.block || (!activeBlockFilter && floorPlan.length === 1)
                            ? "bg-white text-sky-700 shadow-sm border border-slate-200"
                            : "text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {b.block}
                      </button>
                    ))}
                    {activeBlockFilter && floorPlan.length > 1 && (
                      <button
                         onClick={() => setActiveBlockFilter(null)}
                         className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
                      >
                         Tất cả
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  Mô phỏng bệnh viện dạng xếp chồng theo Khu -{'>'} Tầng. Phòng trong lộ trình được tô xanh và gắn số thứ tự.
                </div>
                <div className="relative rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3">
                  <div className="relative max-h-96 overflow-y-auto pr-1 space-y-4">
                    {floorPlan.filter(b => !activeBlockFilter || b.block === activeBlockFilter).map((blockItem) => (
                      <div key={`block-${blockItem.block}`} className="border border-slate-200 rounded-xl bg-white p-3 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-3 bg-slate-50 py-1.5 px-3 rounded-lg border-l-4 border-sky-600">
                          Khu {blockItem.block}
                        </h3>
                        <div className="relative space-y-2">
                          <div className="absolute left-[58px] top-0 bottom-0 w-[2px] bg-slate-200" />
                          {[...blockItem.floors]
                            .sort((a, b) => b.floor - a.floor)
                            .map((floorItem) => (
                              <div
                                key={`stack-floor-${blockItem.block}-${floorItem.floor}`}
                                className="relative grid grid-cols-[52px,24px,1fr] items-stretch gap-2"
                              >
                                <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-center">
                                  <p className="text-[11px] text-slate-500">Tầng</p>
                                  <p className="text-sm font-bold text-slate-700">{floorItem.floor}</p>
                                </div>
                                <div className="flex items-center justify-center">
                                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white" />
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {floorItem.rooms.map((room) => {
                                      const order = routeOrderMap[room];
                                      const inRoute = Boolean(order);
                                      return (
                                        <div
                                          key={`stack-room-${blockItem.block}-${floorItem.floor}-${room}`}
                                          className={`rounded-md border px-2 py-1.5 text-xs flex items-center justify-between ${
                                            inRoute
                                              ? "bg-sky-100 border-sky-400 text-sky-800"
                                              : "bg-slate-50 border-slate-200 text-slate-500"
                                          }`}
                                        >
                                          <span className="truncate pr-1">
                                            {viName(room)} ({DEPT_META[room]?.roomCode || "N/A"})
                                          </span>
                                          {inRoute && (
                                            <span className="w-5 h-5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">
                                              {order}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-h-32 overflow-y-auto">
                    {routeTimeline.map((step, idx) => (
                      <div key={`legend-${step}-${idx}`} className="text-xs rounded border border-slate-200 px-2 py-1.5 bg-slate-50">
                        <span className="font-semibold text-sky-700">#{idx + 1}</span>{" "}
                        {viName(step)} - {DEPT_META[step]?.roomCode || "Chưa có mã"} - {DEPT_META[step]?.side || "Khu trung tâm"}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {suggest && (
              <div className="mt-2 p-3 bg-indigo-50 rounded border border-indigo-200 text-sm">
                Nên đi sau {suggest.recommended_offset_hours} giờ để còn khoảng {suggest.estimated_time} phút.
              </div>
            )}
            {routeResult && !flowAccepted && (
              <button
                onClick={() => setFlowAccepted(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2 font-semibold"
              >
                Tôi đồng ý lộ trình này - Bắt đầu checklist
              </button>
            )}
          </div>
          )}

          {activeNavigatorPanel === "checklist" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-lg">Checklist thực hiện</h2>
            {!flowAccepted && <p className="text-sm text-slate-500">Sau khi đồng ý lộ trình, checklist sẽ được kích hoạt.</p>}
            {flowAccepted && (
              <>
                <div className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">Tiến độ hoàn thành</span>
                    <span className="font-bold text-sky-700">{progressPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full">
                    <div className="h-2 rounded-full bg-sky-600" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {routeTimeline.map((step, idx) => {
                    const done = completedSet.has(step);
                    return (
                      <div key={step + idx} className="flex items-center justify-between border border-slate-200 rounded-lg p-2">
                        <span className="text-sm flex items-center gap-2">
                          <input type="checkbox" checked={done} readOnly />
                          {viName(step)}
                        </span>
                        {!done && (
                          <button
                            onClick={() => completeStep(step)}
                            className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-2 py-1 rounded"
                          >
                            Tick hoàn thành
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-lg border p-3 bg-slate-50 text-sm">
                  {allDone ? (
                    <span className="font-semibold text-emerald-700">Bạn đã hoàn tất toàn bộ quy trình khám. Chúc mừng!</span>
                  ) : (
                    <span>Bước tiếp theo: <b>{nextStep ? viName(nextStep) : "Đang cập nhật..."}</b></span>
                  )}
                </div>
              </>
            )}
          </div>
          )}

          {activeNavigatorPanel === "chat" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-lg">Chat hỏi vị trí khoa</h2>
            <p className="text-sm text-slate-500">Bạn có thể hỏi kiểu: “Khoa Tim mạch ở tầng mấy?”</p>
            <div className="h-64 overflow-y-auto border border-slate-200 rounded p-2 space-y-2 bg-slate-50">
              {chatHistory.map((m, idx) => (
                <div key={idx} className={`text-sm p-2 rounded ${m.role === "user" ? "bg-sky-100 ml-8" : "bg-white mr-8"}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatAsk()}
                placeholder="Ví dụ: Khoa Tim mạch ở tầng mấy?"
                className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
              />
              <button onClick={handleChatAsk} className="bg-sky-600 hover:bg-sky-700 text-white rounded px-3 py-2 text-sm font-semibold">
                Gửi
              </button>
            </div>
          </div>
          )}
        </section>
        </>
      )}

      {tab === "flow" && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="font-bold text-lg mb-3">Timeline dự báo tải (1-3 giờ)</h2>
            <div className="space-y-2">
              {predict?.timeline?.map((slot: any) => (
                <div key={slot.hour} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex justify-between">
                    <span className="font-semibold">{slot.hour}</span>
                    <span className="font-bold">{slot.average_load}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full mt-2">
                    <div
                      className={`h-2 rounded-full ${
                        slot.average_load > 80 ? "bg-red-500" : slot.average_load >= 50 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(slot.average_load, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="font-bold text-lg mb-3">Tải realtime theo khoa</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {departmentLoad.map((d) => (
                <div key={d.department} className="flex justify-between items-center border border-slate-200 rounded-xl p-3 text-sm">
                  <div>
                    <p className="font-semibold">{viName(d.department)}</p>
                    <p className="text-xs text-slate-500">Tầng {d.floor ?? "-"} - Chờ {d.wait_time}p - BS {d.doctors}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertBadge level={d.alert_level} />
                    <span className="font-bold">{d.load_pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "now-later" && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-bold text-lg">Demo đi ngay vs đi sau (9h vs 11h)</h2>
          <button onClick={runNowVsLater} className="bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-2 font-semibold">
            So sánh đi ngay và +2 giờ
          </button>
          {nowLater && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                <p className="font-semibold text-slate-800">Đi ngay</p>
                <p>Lộ trình: {nowLater.now.optimal_route.map((s: string) => viName(s)).join(" -> ")}</p>
                <p>Thời gian: {nowLater.now.estimated_time} phút</p>
              </div>
              <div className="border border-emerald-200 rounded-xl p-3 bg-emerald-50">
                <p className="font-semibold text-emerald-800">Đi sau (+2 giờ)</p>
                <p>Lộ trình: {nowLater.later.optimal_route.map((s: string) => viName(s)).join(" -> ")}</p>
                <p>Thời gian: {nowLater.later.estimated_time} phút</p>
              </div>
            </div>
          )}
          {nowLater && (
            <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50">
              <p className="text-sm font-semibold text-indigo-800">Khuyến nghị: {nowLater.recommendation}</p>
            </div>
          )}
        </section>
      )}

      {tab === "operations" && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 lg:col-span-8">
            <h2 className="font-bold text-lg">AI điều hành bệnh viện</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <p className="text-xs text-slate-500">Giờ cao điểm</p>
                <p className="text-xl font-bold">{overload?.peak_hours?.join(", ") || "-"}</p>
              </div>
              <div className="rounded-xl border border-red-200 p-3 bg-red-50">
                <p className="text-xs text-red-500">Khoa quá tải</p>
                <p className="text-sm font-bold text-red-700">
                  {(overload?.overloaded_departments || []).map((d: string) => viName(d)).join(", ") || "Không có"}
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {(overload?.recommendations || []).map((r: string) => (
                <li key={r} className="border border-slate-200 rounded-xl p-3 text-sm bg-white">
                  {r}
                </li>
              ))}
            </ul>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <p className="font-semibold text-sm mb-2">Top khoa theo tải realtime</p>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {departmentLoad
                  .slice()
                  .sort((a, b) => b.load_pct - a.load_pct)
                  .slice(0, 8)
                  .map((d) => (
                    <div key={`ops-load-${d.department}`} className="flex items-center justify-between text-sm border border-slate-200 bg-white rounded-lg p-2">
                      <span>{viName(d.department)}</span>
                      <div className="flex items-center gap-2">
                        <AlertBadge level={d.alert_level} />
                        <span className="font-semibold">{d.load_pct}%</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:col-span-4 space-y-3">
            <h3 className="font-bold">Operations Copilot (FPT AI)</h3>
            <p className="text-xs text-slate-500">
              Hỏi đáp cho điều dưỡng, y tá, bác sĩ về lưu lượng và điều phối nhân sự.
            </p>
            <div className="h-56 overflow-y-auto border border-slate-200 rounded p-2 space-y-2 bg-slate-50">
              {opsChatHistory.map((m, idx) => (
                <div key={`ops-chat-${idx}`} className={`text-sm p-2 rounded ${m.role === "user" ? "bg-sky-100 ml-6" : "bg-white mr-6"}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={opsChatInput}
                onChange={(e) => setOpsChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpsChatAsk()}
                placeholder="Ví dụ: 2 giờ tới khoa nào cần tăng thêm điều dưỡng?"
                className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
              />
              <button
                onClick={handleOpsChatAsk}
                className="bg-sky-600 hover:bg-sky-700 text-white rounded px-3 py-2 text-sm font-semibold"
              >
                Gửi
              </button>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Forecast Overload</h4>
              <ul className="space-y-2">
                {(overload?.forecast_overloaded_departments || []).map((dep: string) => (
                  <li key={dep} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <span>{viName(dep)}</span>
                    <AlertBadge level="red" />
                  </li>
                ))}
                {(overload?.forecast_overloaded_departments || []).length === 0 && (
                  <li className="text-sm text-slate-400">Chưa có khoa dự báo quá tải cao.</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
