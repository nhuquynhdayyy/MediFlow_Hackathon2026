import { History } from 'lucide-react'
import { useStore } from '../store'
import PatientQueue from '../components/PatientQueue'
import EMRForm from '../components/EMRForm'
import AIChatPanel from '../components/AIChatPanel'
import VoiceRecorder from '../components/VoiceRecorder'
import QRModal, { QRButton } from '../components/QRModal'
import HistoryModal from '../components/HistoryModal'

export default function DocAssistPage() {
  const { selectedPatient, historyData } = useStore()

  return (
    <div className="flex h-full overflow-hidden">
      {/* Col 1: Patient queue */}
      <aside className="w-56 flex-none bg-white border-r border-slate-200 overflow-hidden flex flex-col">
        <PatientQueue />
      </aside>

      {/* Col 2: EMR form */}
      <section className="w-80 flex-none bg-white border-r border-slate-200 overflow-hidden flex flex-col">
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Ho so benh an (EMR)</h2>
          <div className="flex gap-1.5 items-center">
            <HistoryButton />
            <QRButton />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <EMRForm />
        </div>
      </section>

      {/* Col 3: Voice + AI tabs */}
      <section className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div className="flex-none bg-white border-b border-slate-200">
          <VoiceRecorder />
        </div>
        <div className="flex-1 overflow-hidden bg-white mt-px">
          <AIChatPanel />
        </div>
      </section>

      <QRModal />
      <HistoryModal />
    </div>
  )
}

function HistoryButton() {
  const { selectedPatient, setHistoryData, showHistory, historyData } = useStore()
  const open = () => {
    if (!selectedPatient) return
    useStore.getState().setHistoryData(historyData)
    useStore.setState({ showHistory: true })
  }
  return (
    <button
      onClick={open}
      disabled={!selectedPatient}
      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium transition-colors border border-sky-200 disabled:opacity-40"
    >
      <History size={13} />
      Lich su
    </button>
  )
}

