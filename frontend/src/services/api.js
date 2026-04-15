import axios from 'axios'

const BASE = '/api'
const api = axios.create({ baseURL: BASE, timeout: 60000 })

// ── Patients ──────────────────────────────────────────────────────────────────
export const fetchPatients = () => api.get('/emr/patients').then(r => r.data.patients)
export const fetchPatient  = (id) => api.get(`/emr/patient/${id}`).then(r => r.data)
export const fetchHistory  = (id) => api.get(`/emr/history/${id}`).then(r => r.data.history)
export const saveEMR       = (data) => api.post('/emr/save', data).then(r => r.data)

// ── AI endpoints — KHÔNG cần api_key, backend tự lấy từ .env ─────────────────
export const aiDiagnosis    = (data) => api.post('/ai/diagnosis',      data).then(r => r.data)
export const aiTreatment    = (data) => api.post('/ai/treatment',      data).then(r => r.data)
export const aiPrescription = (data) => api.post('/ai/prescription',   data).then(r => r.data)
export const aiLabSuggest   = (data) => api.post('/ai/lab-suggestions',data).then(r => r.data)
export const aiDrugSuggest  = (data) => api.post('/ai/drug-suggestions',data).then(r => r.data)
export const aiVoiceToEMR   = (data) => api.post('/ai/voice-to-emr',   data).then(r => r.data)
export const aiSoap         = (data) => api.post('/ai/soap-summary',   data).then(r => r.data)
export const aiChat         = (data) => api.post('/chat',              data).then(r => r.data)

// ── QR Payment ────────────────────────────────────────────────────────────────
export const generateQR = (data) => api.post('/payment/generate-qr', data).then(r => r.data)

// ── Streaming chat ────────────────────────────────────────────────────────────
export async function* streamChat(data) {
  const resp = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
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
      const raw = line.slice(6)
      if (raw === '[DONE]') return
      try {
        const chunk = JSON.parse(raw)
        if (chunk.content) yield chunk.content
      } catch { /* skip */ }
    }
  }
}

export const aiDetectRoles = (data) => api.post('/ai/detect-roles', data).then(r => r.data)
