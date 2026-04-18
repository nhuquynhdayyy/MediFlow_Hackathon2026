import { useState } from 'react'
import { X, QrCode, Loader, DollarSign } from 'lucide-react'
import { useStore } from '../store'
import { generateQR } from '../services/api'

export default function QRModal() {
  const { showQR, qrData, closeQR, selectedPatient } = useStore()
  if (!showQR) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <QrCode size={18} className="text-teal-500" />
            QR Thanh toÃ¡n
          </h3>
          <button onClick={closeQR} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {qrData && (
          <div className="text-center space-y-3">
            <img
              src={qrData.qr_url}
              alt="QR Code"
              className="w-48 h-48 mx-auto rounded-xl border border-slate-200"
              onError={e => { e.target.style.display = 'none' }}
            />
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-left space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">NgÃ¢n hÃ ng</span>
                <span className="font-medium">{qrData.bank}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sá»‘ tÃ i khoáº£n</span>
                <span className="font-mono font-medium">{qrData.account}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sá»‘ tiá»n</span>
                <span className="font-bold text-teal-600">
                  {qrData.amount?.toLocaleString('vi-VN')} Ä‘
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ná»™i dung</span>
                <span className="text-xs text-right max-w-32 leading-snug">{qrData.description}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">QuÃ©t mÃ£ QR báº±ng app ngÃ¢n hÃ ng Ä‘á»ƒ thanh toÃ¡n</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Button to trigger QR generation
export function QRButton() {
  const { selectedPatient, setQRData, apiKey } = useStore()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [show, setShow] = useState(false)

  const generate = async () => {
    if (!selectedPatient || !amount) return
    setLoading(true)
    try {
      const r = await generateQR(selectedPatient.id, parseFloat(amount), `Thanh toan kham ${selectedPatient.name}`)
      setQRData(r.data)
      setShow(false)
      setAmount('')
    } catch (e) {
      alert('Lá»—i táº¡o QR: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!selectedPatient) return null

  return (
    <div className="relative">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors border border-emerald-200"
      >
        <QrCode size={13} />
        Táº¡o QR
      </button>
      {show && (
        <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-20 w-48 space-y-2">
          <p className="text-xs font-medium text-slate-600">Nháº­p sá»‘ tiá»n (VNÄ)</p>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="VD: 150000"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button
            onClick={generate}
            disabled={loading || !amount}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-medium disabled:opacity-50"
          >
            {loading ? <Loader size={12} className="animate-spin" /> : <DollarSign size={12} />}
            Táº¡o QR
          </button>
        </div>
      )}
      {show && <div className="fixed inset-0 z-10" onClick={() => setShow(false)} />}
    </div>
  )
}

/**
 * QRModal â€” Bill thanh toÃ¡n + chuyá»ƒn Pharmacy
 * Bill tá»± Ä‘á»™ng tÃ­nh tá»«: sá»‘ lÆ°á»£ng xÃ©t nghiá»‡m Ä‘Ã£ chá»n + sá»‘ thuá»‘c Ä‘Ã£ kÃª + tiá»n khÃ¡m cÆ¡ báº£n
 */

