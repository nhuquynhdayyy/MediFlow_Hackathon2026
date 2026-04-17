import React from 'react'
import { X } from 'lucide-react'
import { format } from 'date-fns'

export default function HistoryModal({ history, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-96 max-h-[70vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Bệnh án cũ</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-300 text-sm">Chưa có lịch sử khám</div>
          ) : (
            history.map((h, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 text-xs">
                <div className="font-medium text-gray-700 mb-1">
                  {h.visit_date} · {h.doctor}
                </div>
                <div className="text-gray-600"><span className="font-medium">Lý do:</span> {h.chief_complaint}</div>
                <div className="text-gray-600"><span className="font-medium">Chẩn đoán:</span> {h.diagnosis}</div>
                <div className="text-gray-600"><span className="font-medium">Điều trị:</span> {h.treatment}</div>
                {h.follow_up_date && (
                  <div className="text-gray-600"><span className="font-medium">Hẹn tái khám:</span> {h.follow_up_date}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
