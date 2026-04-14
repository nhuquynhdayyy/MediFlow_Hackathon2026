/**
 * api.ts — FlowPredict API Client
 * Typed client cho tất cả endpoints backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8003/api";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface Department {
  specialty?: string;
  department?: string;
  current_patients?: number;
  current_load?: number;
  capacity: number;
  load_pct: number;
  wait_time?: number;
  floor?: number;
  alert_level?: "normal" | "warning" | "critical";
}

export interface PatientProfile {
  elderly?: boolean;
  wheelchair?: boolean;
  priority?: "normal" | "urgent" | "emergency";
}

export interface OptimizeRoutePayload {
  departments: string[];          // Tên khoa user nhập
  visited?: string[];             // Đã khám rồi
  patient?: PatientProfile;
}

export interface RouteResult {
  optimal_route: string[];
  remaining_route: string[];
  visited: string[];
  total_estimated_minutes: number;
  bottleneck?: {
    department: string;
    wait_time: number;
    load_pct: number;
  };
  dependency_notes: string[];
  reasoning: string;
  time_saved_vs_worst: number;
  sequence_detail: string[];
  auto_added_prerequisites?: string[];
  not_found?: string[];
}

export interface TriagePayload {
  patient_record: string;          // Lịch sử chat dạng text
  departments?: Department[];      // Khoa cần đi (với load data)
  forecast?: ForecastPoint[];
  visited_departments?: string[];  // Đã khám
  patient_profile?: PatientProfile;
}

export interface TriageResult {
  patient_plan: string;
  recommendations: string[];
  route: string[];
  remaining_route: string[];
  visited: string[];
  details: string[];
  bottleneck?: { department: string; wait_time: number; load_pct: number };
  total_estimated_minutes: number;
  source: "fpt_ai" | "fpt_text" | "rule_engine" | "rule_engine_fallback";
}

export interface AlertPayload {
  load_by_specialty: Department[];
  forecast: ForecastPoint[];
  admin_note?: string;
}

export interface AlertResult {
  alert: string;
  recommendations: string[];
  critical_count: number;
  warning_count: number;
  source: string;
}

export interface HospitalChatPayload {
  message: string;
  load_by_specialty?: Department[];
  forecast?: ForecastPoint[];
  admin_note?: string;
}

export interface HospitalChatResult {
  assistant_message: string;
  recommendations: string[];
  action_items: string[];
  summary: string;
  critical_count: number;
  warning_count: number;
  source: string;
}

export interface ForecastPoint {
  hour: string;
  load_pct: number;
  expected_patients: number;
  alert_level: "normal" | "warning" | "critical";
}

export interface ForecastSummary {
  forecast: ForecastPoint[];
  threshold_pct: number;
  peak_hour: string;
  peak_load_pct: number;
  trough_hour: string;
  trough_load_pct: number;
  last_updated: string;
}

export interface LoadSummary {
  data: Department[];
  summary: {
    total_departments: number;
    critical_count: number;
    warning_count: number;
    avg_load_pct: number;
    critical_departments: string[];
  };
}

// ---------------------------------------------------------------------------
// HTTP HELPER
// ---------------------------------------------------------------------------

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`[${res.status}] ${endpoint}: ${error}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// STATS
// ---------------------------------------------------------------------------

export async function fetchStatsToday() {
  return fetchJson<{ status: string; data: Record<string, unknown> }>("/stats/today");
}

export async function fetchStatsBySpecialty() {
  return fetchJson<{ status: string; data: Department[] }>("/stats/by-specialty");
}

// ---------------------------------------------------------------------------
// LOAD
// ---------------------------------------------------------------------------

export async function fetchLoadBySpecialty(): Promise<LoadSummary & { status: string }> {
  return fetchJson("/load/by-specialty");
}

export async function fetchBottleneck() {
  return fetchJson<{ status: string; data: Department[] }>("/load/bottleneck");
}

// ---------------------------------------------------------------------------
// FORECAST
// ---------------------------------------------------------------------------

export async function fetchForecast24h() {
  return fetchJson<{ status: string; data: ForecastSummary }>("/forecast/24h");
}

export async function fetchForecastRealtime() {
  return fetchJson<{ status: string; data: Record<string, unknown> }>("/forecast/realtime");
}

export async function fetchHourlyPattern() {
  return fetchJson<{ status: string; data: Record<string, unknown> }>("/forecast/hourly-pattern");
}

// ---------------------------------------------------------------------------
// ALERTS (Admin)
// ---------------------------------------------------------------------------

export async function postAlertCheck(payload: AlertPayload) {
  return fetchJson<{ status: string; data: AlertResult }>("/alerts/check", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function postHospitalChat(payload: HospitalChatPayload) {
  return fetchJson<{ status: string; data: HospitalChatResult }>("/hospital/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// TRIAGE (Patient chat)
// ---------------------------------------------------------------------------

export async function postPatientTriage(payload: TriagePayload) {
  return fetchJson<{ status: string; data: TriageResult }>("/alerts/triage", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// OPTIMIZER (Route engine)
// ---------------------------------------------------------------------------

export async function postOptimizeRoute(payload: OptimizeRoutePayload) {
  return fetchJson<{ status: string; data: RouteResult }>("/optimizer/optimize-route", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function postReroute(payload: {
  remaining_departments: string[];
  visited: string[];
  patient?: PatientProfile;
}) {
  return fetchJson<{ status: string; data: RouteResult }>("/optimizer/reroute", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// HELPER: Build triage payload từ chat session
// ---------------------------------------------------------------------------

export function buildTriagePayload(
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>,
  departments: Department[],
  visitedDepts: string[],
  patientProfile?: PatientProfile
): TriagePayload {
  // Format chat history thành text cho backend
  const record = chatHistory
    .map((m) => `[${m.role === "user" ? "Bệnh nhân" : "AI"}]: ${m.content}`)
    .join("\n");

  return {
    patient_record: record,
    departments,
    visited_departments: visitedDepts,
    patient_profile: patientProfile,
  };
}