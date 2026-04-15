import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ── Settings ──────────────────────────────────────
  apiKey: localStorage.getItem('mf_api_key') || '',
  model: localStorage.getItem('mf_model') || 'Llama-3.3-70B-Instruct',
  setApiKey: (key) => {
    localStorage.setItem('mf_api_key', key)
    set({ apiKey: key })
  },
  setModel: (m) => {
    localStorage.setItem('mf_model', m)
    set({ model: m })
  },

  // ── Triage chat (Agent 1) ─────────────────────────
  triageMessages: [],
  triageSession: null,
  triageLoading: false,
  addTriageMessage: (msg) =>
    set((s) => ({ triageMessages: [...s.triageMessages, msg] })),
  setTriageLoading: (v) => set({ triageLoading: v }),
  setTriageSession: (id) => set({ triageSession: id }),
  clearTriage: () => set({ triageMessages: [], triageSession: null }),

  // ── DocAssist (Agent 2) ───────────────────────────
  selectedPatient: null,
  patients: [],
  setPatients: (list) => set({ patients: list }),
  setSelectedPatient: (p) => set({ selectedPatient: p }),

  // EMR form state
  emrData: {},
  setEmrData: (data) => set({ emrData: data }),
  updateEmrField: (field, value) =>
    set((s) => ({ emrData: { ...s.emrData, [field]: value } })),

  // DocAssist chat panel
  docMessages: [],
  docLoading: false,
  addDocMessage: (msg) =>
    set((s) => ({ docMessages: [...s.docMessages, msg] })),
  setDocLoading: (v) => set({ docLoading: v }),
  clearDocMessages: () => set({ docMessages: [] }),

  // AI result panels
  diagnosisResult: '',
  treatmentResult: '',
  prescriptionResult: '',
  labResult: '',
  soapResult: '',
  setAiResult: (key, val) => set({ [key]: val }),

  // QR modal
  qrData: null,
  showQR: false,
  setQRData: (data) => set({ qrData: data, showQR: true }),
  closeQR: () => set({ showQR: false, qrData: null }),

  // History modal
  showHistory: false,
  historyData: [],
  setHistoryData: (data) => set({ historyData: data, showHistory: true }),
  closeHistory: () => set({ showHistory: false }),

  user: null, // Lưu thông tin người dùng (email, tên, uid)
  setUser: (userData) => set({ user: userData }),
  logoutStore: () => set({ user: null, triageMessages: [] }),
}))
