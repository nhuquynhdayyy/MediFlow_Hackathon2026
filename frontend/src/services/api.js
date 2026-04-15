import axios from 'axios'

const BASE = '/api'

// ── Generic helper ────────────────────────────────────────────────────────
const post = (url, data) => axios.post(`${BASE}${url}`, data).then(r => r.data)
const get  = (url)       => axios.get(`${BASE}${url}`).then(r => r.data)

// ── Triage Agent 1 ────────────────────────────────────────────────────────
export const triageChat = (message, history, apiKey, model, sessionId) =>
  post('/triage/chat', { message, history, api_key: apiKey, model, session_id: sessionId })

/**
 * Streaming triage chat — calls onChunk(text) for each token,
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

// ── EMR ───────────────────────────────────────────────────────────────────
export const getPatients   = ()          => get('/emr/patients')
export const getPatient    = (id)        => get(`/emr/patient/${id}`)
export const saveEMR       = (id, data)  => post('/emr/save', { patient_id: id, emr_data: data })
export const getHistory    = (id)        => get(`/emr/history/${id}`)

// ── DocAssist AI ──────────────────────────────────────────────────────────
const docPost = (endpoint, prompt, patientContext, apiKey, model) =>
  post(endpoint, { prompt, patient_context: patientContext, api_key: apiKey, model })

export const aiDiagnosis    = (p, ctx, k, m) => docPost('/ai/diagnosis',        p, ctx, k, m)
export const aiTreatment    = (p, ctx, k, m) => docPost('/ai/treatment',        p, ctx, k, m)
export const aiPrescription = (p, ctx, k, m) => docPost('/ai/prescription',     p, ctx, k, m)
export const aiLabSuggestions=(p, ctx, k, m) => docPost('/ai/lab-suggestions',  p, ctx, k, m)
export const aiSoap         = (p, ctx, k, m) => docPost('/ai/soap-summary',     p, ctx, k, m)
export const voiceToEMR     = (transcript, patientId, apiKey, model) =>
  post('/ai/voice-to-emr', { transcript, patient_id: patientId, api_key: apiKey, model })

/**
 * DocAssist streaming chat — SSE from /api/chat/stream
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

// ── Payment ───────────────────────────────────────────────────────────────
export const generateQR = (patientId, amount, description) =>
  post('/payment/generate-qr', { patient_id: patientId, amount, description })

// ── Health ────────────────────────────────────────────────────────────────
export const healthCheck = () => axios.get('/health').then(r => r.data)

import { auth } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

export const register = async (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const login = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = () => signOut(auth);
