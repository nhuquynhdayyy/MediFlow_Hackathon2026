import { useEffect } from 'react'
import AIChatPanel from '../components/docassist/AIChatPanel'
import EMRForm from '../components/docassist/EMRForm'
import PatientQueue from '../components/docassist/PatientQueue'
import { buildInitialDoctorEmr } from '../doctor/emr'
import DoctorShellHeader from '../doctor/DoctorShellHeader'
import { fetchAppointmentQueue } from '../doctor/services/api'
import { useStore } from '../doctor/store'
import '../doctor/doctor.css'

export default function DoctorWorkspace({ user, onLogout }) {
  const setPatients = useStore((state) => state.setPatients)
  const setActivePatient = useStore((state) => state.setActivePatient)
  const setEmr = useStore((state) => state.setEmr)
  const resetStore = useStore((state) => state.resetStore)

  useEffect(() => {
    let alive = true
    resetStore()

    fetchAppointmentQueue()
      .then((patients) => {
        if (!alive) return
        const list = Array.isArray(patients) ? patients : []
        setPatients(list)
        if (list.length > 0) {
          setActivePatient(list[0])
          setEmr(buildInitialDoctorEmr(list[0]))
        }
      })
      .catch(() => {
        if (!alive) return
        setPatients([])
        setActivePatient(null)
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
