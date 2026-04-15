import { X, History, Stethoscope, Calendar } from 'lucide-react'
import { useStore } from '../store'

export default function HistoryModal() {
  const { showHistory, historyData, closeHistory, selectedPatient } = useStore()
  if (!showHistory) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 fade-in-up max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-none">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <History size={18} className="text-sky-500" />
            Lịch sử khám — {selectedPatient?.name}
          </h3>
          <button onClick={closeHistory} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {historyData.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-sm">Chưa có lịch sử khám</div>
          ) : (
            historyData.map((h, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Calendar size={14} className="text-sky-500" />
                    {h.date}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Stethoscope size={12} />
                    {h.doctor}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chẩn đoán</span>
                  <p className="text-sm text-slate-700 mt-0.5">{h.diagnosis}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Điều trị</span>
                  <p className="text-sm text-slate-600 mt-0.5">{h.treatment}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
