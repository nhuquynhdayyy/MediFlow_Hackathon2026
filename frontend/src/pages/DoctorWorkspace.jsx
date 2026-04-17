import { useEffect } from 'react'
import AIChatPanel from '../components/docassist/AIChatPanel'
import EMRForm from '../components/docassist/EMRForm'
import PatientQueue from '../components/docassist/PatientQueue'
import DoctorShellHeader from '../doctor/DoctorShellHeader'
import { fetchPatients } from '../doctor/services/api'
import { useStore } from '../doctor/store'
import '../doctor/doctor.css'

const FALLBACK_PATIENTS = [
  {
    id: 'P001',
    name: 'Nguyen Van An',
    age: 65,
    gender: 'Nam',
    room: 'K1',
    visit_no: '2847',
    triage_severity: 'high',
    arrived_at: new Date().toISOString(),
    chief_complaint: 'Dau nguc kem kho tho tu 2 ngay nay',
    history: 'THA do II, DTD type 2',
    symptoms: 'Dau nguc trai lan vai trai, muc 7/10. SpO2 96%. HA 155/95. Nhip tim 92.',
    current_medications: ['Amlodipine 5mg', 'Metformin 500mg'],
    allergies: '',
    diagnosis: '',
    treatment_plan: '',
  },
  {
    id: 'P002',
    name: 'Tran Thi Bich',
    age: 42,
    gender: 'Nu',
    room: 'K2',
    visit_no: '2848',
    triage_severity: 'medium',
    arrived_at: new Date().toISOString(),
    chief_complaint: 'Dau dau, chong mat',
    history: 'Khong co tien su',
    symptoms: 'Dau dau am i 3/10. HA 110/70. Khong sot.',
    current_medications: [],
    allergies: '',
    diagnosis: '',
    treatment_plan: '',
  },
]

function buildInitialEmr(patient) {
  return {
    chief_complaint: patient.chief_complaint || '',
    symptoms: patient.symptoms || '',
    history: patient.history || '',
    diagnosis: patient.diagnosis || '',
    treatment_plan: patient.treatment_plan || '',
    notes: '',
    prescriptions: [],
    lab_orders: [],
    soap: null,
  }
}

export default function DoctorWorkspace({ user, onLogout }) {
  const setPatients = useStore((state) => state.setPatients)
  const setActivePatient = useStore((state) => state.setActivePatient)
  const setEmr = useStore((state) => state.setEmr)
  const resetStore = useStore((state) => state.resetStore)

  useEffect(() => {
    let alive = true
    resetStore()

    fetchPatients()
      .then((patients) => {
        if (!alive) return
        const list = Array.isArray(patients) && patients.length > 0 ? patients : FALLBACK_PATIENTS
        setPatients(list)
        if (list.length > 0) {
          setActivePatient(list[0])
          setEmr(buildInitialEmr(list[0]))
        }
      })
      .catch(() => {
        if (!alive) return
        setPatients(FALLBACK_PATIENTS)
        setActivePatient(FALLBACK_PATIENTS[0])
        setEmr(buildInitialEmr(FALLBACK_PATIENTS[0]))
      })

    return () => {
      alive = false
    }
  }, [resetStore, setActivePatient, setEmr, setPatients])

  return (
    <div className="doctor-app flex flex-col h-full overflow-hidden">
      <DoctorShellHeader user={user} onLogout={onLogout} />
      <div className="flex flex-1 min-h-0 overflow-hidden px-4 pb-4 pt-3 gap-4">
        <PatientQueue />
        <EMRForm />
        <AIChatPanel />
      </div>
    </div>
  )
}
