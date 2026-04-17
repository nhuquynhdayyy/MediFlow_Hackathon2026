import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8003",
  headers: { "Content-Type": "application/json" },
});

export const fetchDepartments = async () => (await api.get("/api/departments")).data.data;
export const fetchDepartmentLoad = async () => (await api.get("/api/department-load")).data.data;
export const fetchPredictLoad = async () => (await api.get("/api/predict-load")).data.data;
export const fetchOverloadAnalysis = async () => (await api.get("/api/overload-analysis")).data.data;
export const fetchPatientOrders = async (patientId: string) =>
  (await api.get(`/api/patient/${patientId}/orders`)).data.data;
export const fetchPatientState = async (patientId: string) =>
  (await api.get(`/api/patient/${patientId}/state`)).data.data;

export const optimizeRouteAPI = async (payload: {
  patient_id: string;
  departments: string[];
  constraints?: { elderly: boolean; wheelchair: boolean; priority: string };
  patient_state?: { current_step: string | null; completed: string[] };
}) => (await api.post("/api/optimize-route", payload)).data.data;

export const suggestTimeAPI = async (payload: {
  patient_id: string;
  departments: string[];
  lookahead_hours: number;
}) => (await api.post("/api/suggest-time", payload)).data.data;

export const nowVsLaterAPI = async (departments: string[], compareAfterHours = 2) =>
  (
    await api.get(
      `/api/now-vs-later?departments=${encodeURIComponent(
        departments.join(",")
      )}&compare_after_hours=${compareAfterHours}`
    )
  ).data.data;

export const updatePatientProgressAPI = async (
  patientId: string,
  payload: { completed_step: string; current_step: string | null }
) => (await api.post(`/api/patient/${patientId}/progress`, payload)).data.data;

export const patientChatAPI = async (
  patientId: string,
  payload: {
    message: string;
    history: Array<{ role: "user" | "assistant"; text: string }>;
    departments_context?: string[];
  }
) => (await api.post(`/api/patient/${patientId}/chat`, payload)).data.data;

export const hospitalOpsChatAPI = async (payload: {
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
}) => (await api.post("/api/hospital/chat", payload)).data.data;