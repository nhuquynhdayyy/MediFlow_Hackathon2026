import axios from 'axios'
import { auth } from './firebase'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'

const BASE = '/api'
const api = axios.create({ baseURL: BASE, timeout: 60000 })

// â”€â”€ Generic helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const post = (url, data) => api.post(url, data).then((r) => r.data)
const get = (url) => api.get(url).then((r) => r.data)
const put = (url, data) => api.put(url, data).then((r) => r.data)

const parseJsonMaybe = (text, fallback = {}) => {
  if (!text || typeof text !== 'string') return fallback
  const cleaned = text.trim().replace('```json', '').replace('```', '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    try {
      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')
      if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return fallback
    }
  }
  return fallback
}

const buildDocAssistInput = (data = {}) => {
  const symptoms = data.symptoms || ''
  const diagnosis = data.diagnosis || data.current_diagnosis || ''
  const history = data.history || data.medical_history || ''
  const treatmentPlan = data.treatment_plan || ''
  const chiefComplaint = data.chief_complaint || ''
  const patientName = data.patient_name || data.name || 'Khong ro'

  return {
    prompt: [
      `Benh nhan: ${patientName}`,
      chiefComplaint ? `Ly do kham: ${chiefComplaint}` : '',
      symptoms ? `Trieu chung: ${symptoms}` : '',
      diagnosis ? `Chan doan hien tai: ${diagnosis}` : '',
      history ? `Tien su: ${history}` : '',
      treatmentPlan ? `Ke hoach dieu tri: ${treatmentPlan}` : '',
    ].filter(Boolean).join('\n'),
    patient_context: data,
    api_key: data.api_key,
    model: data.model,
  }
}

// â”€â”€ Triage Agent 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const triageChat = (message, history, apiKey, model, sessionId) =>
  post('/triage/chat', { message, history, api_key: apiKey, model, session_id: sessionId })

/**
 * Streaming triage chat â€” calls onChunk(text) for each token,
 * calls onDone() when finished.
 */
export const triageChatStream = async (message, history, apiKey, model, onChunk, onDone, onError) => {
  try {
    const resp = await fetch(`${BASE}/triage/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, api_key: apiKey, model }),
    })
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { onDone?.(); return }
        try {
          const obj = JSON.parse(payload)
          if (obj.error) { onError?.(obj.error); return }
          if (obj.chunk) onChunk(obj.chunk)
        } catch (_) { /* skip malformed */ }
      }
    }
    onDone?.()
  } catch (e) {
    onError?.(e.message)
  }
}

// â”€â”€ EMR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const getPatients = () => get('/emr/patients')
export const getPatient = (id) => get(`/emr/patient/${id}`)
export const saveEMR = (id, data) => post('/emr/save', { patient_id: id, emr_data: data })
export const getHistory = (id) => get(`/emr/history/${id}`)

// â”€â”€ DocAssist AI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const docPost = (endpoint, prompt, patientContext, apiKey, model) =>
  post(endpoint, { prompt, patient_context: patientContext, api_key: apiKey, model })

export const aiDiagnosis = (p, ctx, k, m) => docPost('/ai/diagnosis', p, ctx, k, m)
export const aiTreatment = (p, ctx, k, m) => docPost('/ai/treatment', p, ctx, k, m)
export const aiPrescription = (p, ctx, k, m) => {
  if (typeof p === 'string') return docPost('/ai/prescription', p, ctx, k, m)
  const payload = buildDocAssistInput(p || {})
  return post('/ai/prescription', payload).then((r) => ({
    ...r,
    data: parseJsonMaybe(r.result, { prescriptions: [] }),
  }))
}
export const aiLabSuggestions = (p, ctx, k, m) => docPost('/ai/lab-suggestions', p, ctx, k, m)
export const aiSoap = (p, ctx, k, m) => docPost('/ai/soap-summary', p, ctx, k, m)
export const voiceToEMR = (transcript, patientId, apiKey, model) =>
  post('/ai/voice-to-emr', { transcript, patient_id: patientId, api_key: apiKey, model })
export const aiLabSuggest = (data) =>
  post('/ai/lab-suggestions', buildDocAssistInput(data)).then((r) => ({
    ...r,
    data: parseJsonMaybe(r.result, { urgent: [], routine: [], optional: [], imaging: [] }),
  }))
export const aiDrugSuggest = (data) =>
  post('/ai/drug-suggestions', buildDocAssistInput(data)).then((r) => ({
    ...r,
    data: parseJsonMaybe(r.result, { suggestions: [], warnings: [] }),
  }))

/**
 * DocAssist streaming chat â€” SSE from /api/chat/stream
 */
export const docChatStream = async (prompt, apiKey, model, onChunk, onDone, onError) => {
  try {
    const resp = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, api_key: apiKey, model }),
    })
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6)
        if (payload === '[DONE]') { onDone?.(); return }
        try {
          const obj = JSON.parse(payload)
          if (obj.error) { onError?.(obj.error); return }
          if (obj.chunk) onChunk(obj.chunk)
        } catch (_) { /* skip */ }
      }
    }
    onDone?.()
  } catch (e) {
    onError?.(e.message)
  }
}

// â”€â”€ Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const generateQR = (patientIdOrPayload, amount, description) => {
  if (typeof patientIdOrPayload === 'object' && patientIdOrPayload !== null) {
    return post('/payment/generate-qr', patientIdOrPayload)
  }
  return post('/payment/generate-qr', { patient_id: patientIdOrPayload, amount, description })
}

// â”€â”€ Appointments & Patients (Firestore) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const createAppointment = (data) =>
  post('/appointments/create', data)

export const getAppointments = (uid) =>
  get(`/appointments/${uid}`)

export const savePatientProfile = (data) =>
  post('/patients/save', data)

export const saveChatSession = (data) =>
  post('/chat-sessions/save', data)

// â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const createMedicalRecord = (data) =>
  post('/medical-records/create', data)

export const getMedicalRecordsByPatient = (patientId) =>
  get(`/medical-records/patient/${patientId}`)

export const updateMedicalRecord = (patientId, data) =>
  put(`/medical-records/update/${patientId}`, data)

export const healthCheck = () => axios.get('/health').then(r => r.data)

export const register = async (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password)
}

export const login = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password)
}

export const logout = () => signOut(auth);

