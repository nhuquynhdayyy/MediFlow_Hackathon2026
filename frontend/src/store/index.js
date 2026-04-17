import { create } from 'zustand'

const DEFAULT_EMR_DATA = {
  chief_complaint: '',
  symptoms: '',
  medical_history: '',
  allergies: '',
  current_medications: '',
  preliminary_diagnosis: '',
  treatment_plan: '',
}

const DEFAULT_EMR = {
  chief_complaint: '',
  symptoms: '',
  history: '',
  diagnosis: '',
  treatment_plan: '',
  follow_up_date: '',
  notes: '',
  prescriptions: [],
  lab_orders: [],
  _labData: [],
  soap: null,
}

const mapAgent1ToAgent2 = (emrData = {}) => ({
  chief_complaint: emrData.chief_complaint || '',
  symptoms: emrData.symptoms || '',
  history: emrData.medical_history || '',
  diagnosis: emrData.preliminary_diagnosis || '',
  treatment_plan: emrData.treatment_plan || '',
  allergies: emrData.allergies || '',
  current_medications: emrData.current_medications || '',
})

const mapAgent2ToAgent1 = (emr = {}) => ({
  chief_complaint: emr.chief_complaint || '',
  symptoms: emr.symptoms || '',
  medical_history: emr.history || '',
  preliminary_diagnosis: emr.diagnosis || '',
  treatment_plan: emr.treatment_plan || '',
})

export const useStore = create((set, get) => ({
  // â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Triage chat (Agent 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  triageMessages: [],
  triageSession: null,
  triageLoading: false,
  addTriageMessage: (msg) =>
    set((s) => ({ triageMessages: [...s.triageMessages, msg] })),
  setTriageLoading: (v) => set({ triageLoading: v }),
  setTriageSession: (id) => set({ triageSession: id }),
  clearTriage: () => set({ triageMessages: [], triageSession: null }),

  // â”€â”€ DocAssist (Agent 2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  selectedPatient: null,
  activePatient: null,
  patients: [],
  setPatients: (list) => set({ patients: list }),
  setSelectedPatient: (p) => set({ selectedPatient: p, activePatient: p }),
  setActivePatient: (p) => set({ activePatient: p, selectedPatient: p }),

  // EMR form state
  emrData: DEFAULT_EMR_DATA,
  emr: DEFAULT_EMR,
  setEmrData: (data) => set((s) => ({
    emrData: { ...DEFAULT_EMR_DATA, ...s.emrData, ...data },
    emr: { ...DEFAULT_EMR, ...s.emr, ...mapAgent1ToAgent2({ ...s.emrData, ...data }) },
  })),
  setEmr: (data) => set((s) => ({
    emr: { ...DEFAULT_EMR, ...s.emr, ...data },
    emrData: { ...DEFAULT_EMR_DATA, ...s.emrData, ...mapAgent2ToAgent1({ ...s.emr, ...data }) },
  })),
  setEmrField: (field, value) => set((s) => {
    const nextEmr = { ...s.emr, [field]: value }
    const mappedForAgent1 = mapAgent2ToAgent1(nextEmr)
    return {
      emr: nextEmr,
      emrData: { ...s.emrData, ...mappedForAgent1 },
    }
  }),
  updateEmrField: (field, value) =>
    set((s) => {
      const nextEmrData = { ...s.emrData, [field]: value }
      return {
        emrData: nextEmrData,
        emr: { ...s.emr, ...mapAgent1ToAgent2(nextEmrData) },
      }
    }),

  // DocAssist chat panel
  docMessages: [],
  docLoading: false,
  loading: {},
  addDocMessage: (msg) =>
    set((s) => ({ docMessages: [...s.docMessages, msg] })),
  setDocLoading: (v) => set({ docLoading: v }),
  setLoading: (key, val) => set((s) => ({ loading: { ...s.loading, [key]: val } })),
  clearDocMessages: () => set({ docMessages: [] }),

  // AI result panels
  diagnosisResult: '',
  treatmentResult: '',
  prescriptionResult: '',
  labResult: '',
  soapResult: '',
  setAiResult: (key, val) => set({ [key]: val }),

  // Appointments
  appointments: [],
  setAppointments: (list) => set({ appointments: list }),
  addAppointment: (appt) =>
    set((s) => ({ appointments: [appt, ...s.appointments] })),

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

  user: null, // LÆ°u thÃ´ng tin ngÆ°á»i dÃ¹ng (email, tÃªn, uid)
  setUser: (userData) => set({ user: userData }),
  logoutStore: () => set({ user: null, triageMessages: [] }),
}))

