const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8003/api";

export interface Department {
  id: string;
  name: string;
  zone: string;
  floor: number;
  capacity: number;
  current_load: number;
  wait_time: number;
  status: "green" | "yellow" | "red";
  hourly_pattern: Record<number, number>;
}

export interface OptimizeRoutePayload {
  departments: string[];
  wait_times?: Record<string, number>;
  current_load?: Record<string, number>;
  constraints?: string[];
  hour?: number;
}

export interface OptimizeRouteResult {
  optimal_route: string[];
  estimated_time: number;
  alternative_route: string[];
  alternative_time: number;
  time_saved: number;
  baseline_time: number;
  reasoning: string[];
  route_breakdown: Array<{
    department: string;
    wait_time: number;
    current_load: number;
    status: "green" | "yellow" | "red";
    floor: number;
    zone: string;
  }>;
}

export interface PredictLoadResult {
  department: string;
  departments: Array<{
    department: string;
    peak_hour: number;
    peak_load: number;
    timeline: Array<{ hour: number; load: number; expected_wait: number }>;
  }>;
  hospital_timeline: Array<{ hour: number; average_load: number }>;
  peak_hours: number[];
  alerts: string[];
}

export interface OverloadResult {
  hour: number;
  average_load: number;
  overloaded_departments: Array<{
    department: string;
    load: number;
    wait_time: number;
    zone: string;
  }>;
  recommendations: string[];
  actions: string[];
  heatmap: Array<{ department: string; status: "green" | "yellow" | "red"; load: number }>;
  reasoning: string[];
}

export interface NowVsLaterResult {
  scenario: string;
  departments: string[];
  now: OptimizeRouteResult;
  later: OptimizeRouteResult;
  minutes_saved_if_wait: number;
  department_comparison: {
    department: string;
    now: { hour: number; load: number; wait_time: number; status: "green" | "yellow" | "red" };
    later: { hour: number; load: number; wait_time: number; status: "green" | "yellow" | "red" };
  } | null;
}

interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  const payload: ApiResponse<T> = await response.json();
  return payload.data;
}

export function getDepartments(hour = 9) {
  return request<{ hour: number; departments: Department[] }>(`/departments?hour=${hour}`);
}

export function optimizeRoute(payload: OptimizeRoutePayload) {
  return request<OptimizeRouteResult>("/optimize-route", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function predictLoad(department?: string) {
  const query = department ? `?department=${encodeURIComponent(department)}` : "";
  return request<PredictLoadResult>(`/predict-load${query}`);
}

export function getNowVsLater(params: {
  department: string;
  departments: string[];
  nowHour: number;
  laterHour: number;
}) {
  const query = new URLSearchParams({
    department: params.department,
    departments: params.departments.join(","),
    now_hour: String(params.nowHour),
    later_hour: String(params.laterHour),
  });
  return request<NowVsLaterResult>(`/now-vs-later?${query.toString()}`);
}

export function getOverloadAnalysis(hour = 9) {
  return request<OverloadResult>(`/overload-analysis?hour=${hour}`);
}
