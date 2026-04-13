import React, { useEffect, useState } from 'react'
import { generateQR } from '../services/api'
import { X, Copy } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function QRModal({ patient, onClose }) {
  const [qr, setQR] = useState(null)
  const amount = 450000

  useEffect(() => {
    generateQR({ patient_id: patient?.id, amount })
      .then(setQR)
      .catch(() => setQR({ reference: 'MOCK001', amount, vietqr_url: null }))
  }, [patient])

  const copy = () => {
    navigator.clipboard.writeText(qr?.reference || '')
    toast.success('Đã copy mã thanh toán')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">QR Thanh toán</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="text-xs text-gray-500 mb-3">{patient?.name} — Lần khám #{patient?.visit_no}</div>

        {/* VietQR image */}
        <div className="bg-gray-50 rounded-xl p-4 text-center mb-3">
          {qr?.vietqr_url ? (
            <img src={qr.vietqr_url} alt="QR Code" className="w-40 h-40 mx-auto rounded-lg" />
          ) : (
            <div className="w-40 h-40 mx-auto bg-white border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-gray-300 text-xs text-center">QR Code<br />(VietQR)</div>
            </div>
          )}
          <div className="text-xs text-gray-500 mt-2">Quét để thanh toán qua VietQR</div>
        </div>

        {/* Breakdown */}
        <div className="space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
          <div className="flex justify-between"><span>Tiền khám:</span><span>200.000đ</span></div>
          <div className="flex justify-between"><span>Xét nghiệm:</span><span>180.000đ</span></div>
          <div className="flex justify-between"><span>Thuốc:</span><span>70.000đ</span></div>
          <div className="flex justify-between font-medium text-gray-900 text-sm pt-1 border-t border-gray-100">
            <span>Tổng:</span><span>{amount.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        {qr?.reference && (
          <div className="flex items-center gap-2 mt-3 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 flex-1 font-mono">{qr.reference}</span>
            <button onClick={copy} className="text-gray-400 hover:text-gray-600"><Copy size={13} /></button>
          </div>
        )}

        <button
          onClick={() => { toast.success('SMS đã gửi cho bệnh nhân'); onClose() }}
          className="w-full mt-3 bg-teal-400 hover:bg-teal-600 text-white text-xs font-medium py-2 rounded-xl transition"
        >
          Gửi SMS cho bệnh nhân
        </button>
      </div>
    </div>
  )
}
