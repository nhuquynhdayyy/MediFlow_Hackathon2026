import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── EMR fields ──────────────────────────────────────────────────────────────
  emr: {
    chief_complaint: '',
    symptoms:        '',
    history:         '',
    diagnosis:       '',
    treatment_plan:  '',
    follow_up_date:  '',
    notes:           '',
    prescriptions:   [],
    lab_orders:      [],
    _labData:        [],
    soap:            null,
  },
  setEmrField: (field, val) => set(s => ({ emr: { ...s.emr, [field]: val } })),
  setEmr:      (data)       => set(s => ({ emr: { ...s.emr, ...data }     })),
  resetEmr:    ()           => set({ emr: {
    chief_complaint: '', symptoms: '', history: '',
    diagnosis: '', treatment_plan: '', follow_up_date: '', notes: '',
    prescriptions: [], lab_orders: [], _labData: [], soap: null,
  }}),

  // ── Patient queue ───────────────────────────────────────────────────────────
  patients:         [],
  setPatients:      (p) => set({ patients: p }),
  activePatient:    null,
  setActivePatient: (p) => set({ activePatient: p }),

  // ── AI Chat messages ────────────────────────────────────────────────────────
  chatMessages: [],
  addChatMessage: (msg) => set(s => ({
    chatMessages: [...s.chatMessages, { id: `msg-${Date.now()}-${Math.random()}`, ...msg }]
  })),
  updateChatMessage: (id, text) => set(s => ({
    chatMessages: s.chatMessages.map(m => m.id === id ? { ...m, text } : m)
  })),
  finishChatMessage: (id) => set(s => ({
    chatMessages: s.chatMessages.map(m => m.id === id ? { ...m, streaming: false } : m)
  })),
  clearChat: () => set({ chatMessages: [] }),

  // ── Loading states ──────────────────────────────────────────────────────────
  loading:    {},
  setLoading: (key, val) => set(s => ({ loading: { ...s.loading, [key]: val } })),
}))
