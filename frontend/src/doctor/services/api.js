import axios from 'axios'

const BASE = '/api/doctor'
const api = axios.create({ baseURL: BASE, timeout: 60000 })

export const fetchAppointmentQueue = () =>
  api.get('/appointments').then((response) => response.data.appointments)

export const fetchPatients = fetchAppointmentQueue
export const fetchPatient = (id, appointmentId = '') =>
  api
    .get(`/emr/patient/${id}`, {
      params: appointmentId ? { appointment_id: appointmentId } : undefined,
    })
    .then((response) => response.data)
export const fetchHistory = (id) => api.get(`/emr/history/${id}`).then((response) => response.data.history)
export const saveEMR = (data) => api.post('/emr/save', data).then((response) => response.data)

export const aiDiagnosis = (data) => api.post('/ai/diagnosis', data).then((response) => response.data)
export const aiTreatment = (data) => api.post('/ai/treatment', data).then((response) => response.data)
export const aiPrescription = (data) => api.post('/ai/prescription', data).then((response) => response.data)
export const aiLabSuggest = (data) => api.post('/ai/lab-suggestions', data).then((response) => response.data)
export const aiDrugSuggest = (data) => api.post('/ai/drug-suggestions', data).then((response) => response.data)
export const aiVoiceToEMR = (data) => api.post('/ai/voice-to-emr', data).then((response) => response.data)
export const aiSoap = (data) => api.post('/ai/soap-summary', data).then((response) => response.data)
export const aiChat = (data) => api.post('/chat', data).then((response) => response.data)

export const generateQR = (data) => api.post('/payment/generate-qr', data).then((response) => response.data)

export async function* streamChat(data) {
  const response = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const reader = response.body.getReader()
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
      } catch {
        // Ignore malformed SSE lines.
      }
    }
  }
}
