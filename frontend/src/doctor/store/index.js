import { create } from 'zustand'

const createInitialState = () => ({
  emr: {
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
  },
  patients: [],
  activePatient: null,
  chatMessages: [],
  loading: {},
})

export const useStore = create((set) => ({
  ...createInitialState(),

  setEmrField: (field, val) => set((state) => ({ emr: { ...state.emr, [field]: val } })),
  setEmr: (data) => set((state) => ({ emr: { ...state.emr, ...data } })),
  resetEmr: () => set({ emr: createInitialState().emr }),

  setPatients: (patients) => set({ patients }),
  setActivePatient: (patient) => set({ activePatient: patient }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, { id: `msg-${Date.now()}-${Math.random()}`, ...message }],
    })),
  updateChatMessage: (id, text) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((message) =>
        message.id === id ? { ...message, text } : message
      ),
    })),
  finishChatMessage: (id) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((message) =>
        message.id === id ? { ...message, streaming: false } : message
      ),
    })),
  clearChat: () => set({ chatMessages: [] }),

  setLoading: (key, value) =>
    set((state) => ({ loading: { ...state.loading, [key]: value } })),

  resetStore: () => set(createInitialState()),
}))
