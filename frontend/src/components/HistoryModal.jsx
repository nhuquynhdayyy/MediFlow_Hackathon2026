import React from 'react'
import { X } from 'lucide-react'

export default function HistoryModal({ history, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="panel-shell-strong rounded-[28px] p-5 w-[460px] max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Benh an cu</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-300 text-sm">Chua co lich su kham</div>
          ) : (
            history.map((h, i) => (
              <div key={i} className="border border-slate-100 bg-white/80 rounded-2xl p-4 text-xs shadow-sm">
                <div className="font-semibold text-gray-700 mb-2">
                  {h.visit_date} - {h.doctor}
                </div>
                <div className="text-gray-600"><span className="font-medium">Ly do:</span> {h.chief_complaint}</div>
                <div className="text-gray-600"><span className="font-medium">Chan doan:</span> {h.diagnosis}</div>
                <div className="text-gray-600"><span className="font-medium">Dieu tri:</span> {h.treatment}</div>
                {h.follow_up_date && (
                  <div className="text-gray-600"><span className="font-medium">Hen tai kham:</span> {h.follow_up_date}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
