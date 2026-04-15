/**
 * QRModal — Bill thanh toán + chuyển Pharmacy
 * Bill tự động tính từ: số lượng xét nghiệm đã chọn + số thuốc đã kê + tiền khám cơ bản
 */
import React, { useEffect, useState } from 'react'
import { generateQR } from '../services/api'
import { useStore } from '../store'
import { X, Copy, CheckCircle, ChevronRight, Pill, FlaskConical, Stethoscope, ArrowRight, Printer } from 'lucide-react'
import { toast } from 'react-hot-toast'

// ── Bảng giá mock (production: từ HIS) ───────────────────────────────────────
const CONSULT_FEE   = 200000   // tiền khám
const LAB_UNIT      = 45000    // giá trung bình 1 xét nghiệm
const IMAGING_UNIT  = 150000   // giá trung bình 1 CĐHA
const DRUG_UNIT     = 15000    // giá trung bình 1 loại thuốc / ngày

const IMAGING_TESTS = ['X-quang','Siêu âm','CT','MRI','ECG','Điện tim','Nội soi']

function isImaging(testName) {
  return IMAGING_TESTS.some(k => testName.includes(k))
}

function calcBill(emr, patient) {
  const labs       = (emr.lab_orders||[]).filter(t => !isImaging(t))
  const imagings   = (emr.lab_orders||[]).filter(t =>  isImaging(t))
  const drugs      = emr.prescriptions||[]
  const drugCost   = drugs.reduce((sum, rx) => sum + (rx.days||7) * DRUG_UNIT, 0)
  const labCost    = labs.length    * LAB_UNIT
  const imagCost   = imagings.length * IMAGING_UNIT

  return {
    items: [
      { label: 'Tiền khám bệnh',          amount: CONSULT_FEE,  icon: 'stethoscope', detail: `BS phụ trách phòng ${patient?.room||'K1'}` },
      labs.length>0    && { label: `Xét nghiệm (${labs.length})`,    amount: labCost,   icon: 'flask',  detail: labs.slice(0,3).join(', ')+(labs.length>3?`… +${labs.length-3}`:'') },
      imagings.length>0 && { label: `CĐHA (${imagings.length})`,     amount: imagCost,  icon: 'flask',  detail: imagings.join(', ') },
      drugs.length>0   && { label: `Thuốc (${drugs.length} loại)`,   amount: drugCost,  icon: 'pill',   detail: drugs.slice(0,2).map(d=>d.drug||d.name||'?').join(', ')+(drugs.length>2?`… +${drugs.length-2}`:'') },
    ].filter(Boolean),
    total: CONSULT_FEE + labCost + imagCost + drugCost,
    labs, imagings, drugs,
  }
}

const vnd = n => n.toLocaleString('vi-VN') + 'đ'

export default function QRModal({ patient, onClose }) {
  const { emr } = useStore()
  const bill = calcBill(emr, patient)

  const [qr, setQR]               = useState(null)
  const [step, setStep]           = useState('bill')   // 'bill' | 'qr' | 'pharmacy'
  const [pharmStatus, setPharmStatus] = useState('idle') // idle | sending | sent

  useEffect(() => {
    generateQR({ patient_id: patient?.id, amount: bill.total })
      .then(setQR)
      .catch(() => setQR({ reference: 'MOCK001', amount: bill.total, vietqr_url: null }))
  }, [patient])

  const copy = () => { navigator.clipboard.writeText(qr?.reference||''); toast.success('Đã copy mã') }

  const sendToPharmacy = () => {
    setPharmStatus('sending')
    // mock API call — production: POST /api/pharmacy/queue
    setTimeout(() => {
      setPharmStatus('sent')
      toast.success('Đã chuyển đơn thuốc đến quầy thuốc!')
    }, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-96 max-h-[90vh] flex flex-col shadow-xl overflow-hidden" onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Thanh toán</h3>
            <p className="text-xs text-gray-500 mt-0.5">{patient?.name} · #{patient?.visit_no}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={16}/></button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {[['bill','Bill'],['qr','QR Pay'],['pharmacy','Pharmacy']].map(([key,label])=>(
            <button key={key} onClick={()=>setStep(key)}
              className={`flex-1 text-xs py-2.5 border-b-2 transition-colors ${step===key?'border-teal-400 text-teal-600 font-medium':'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {label}
              {key==='pharmacy' && pharmStatus==='sent' && <span className="ml-1 text-green-500">✓</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── BILL TAB ──────────────────────────────────────────────────── */}
          {step==='bill' && (
            <div className="p-5">
              <div className="space-y-2 mb-4">
                {bill.items.map((item,i)=>(
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-50">
                    <span className="mt-0.5 text-gray-400 shrink-0">
                      {item.icon==='pill' ? <Pill size={14}/> : item.icon==='flask' ? <FlaskConical size={14}/> : <Stethoscope size={14}/>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 font-medium">{item.label}</div>
                      {item.detail && <div className="text-xs text-gray-400 mt-0.5 truncate">{item.detail}</div>}
                    </div>
                    <div className="text-sm font-medium text-gray-800 shrink-0">{vnd(item.amount)}</div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-3 border-t-2 border-gray-200">
                <span className="text-sm font-semibold text-gray-900">Tổng cộng</span>
                <span className="text-lg font-bold text-teal-600">{vnd(bill.total)}</span>
              </div>

              {/* Insurance note */}
              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-xs text-blue-700">
                💡 Bệnh nhân có BHYT sẽ được giảm theo quy định. Xuất trình thẻ tại quầy thu ngân.
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={()=>setStep('qr')} className="flex-1 bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                  Thanh toán QR <ChevronRight size={15}/>
                </button>
                <button onClick={()=>window.print()} className="px-3 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-500">
                  <Printer size={15}/>
                </button>
              </div>
            </div>
          )}

          {/* ── QR TAB ────────────────────────────────────────────────────── */}
          {step==='qr' && (
            <div className="p-5">
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
                {qr?.vietqr_url ? (
                  <img src={qr.vietqr_url} alt="QR" className="w-44 h-44 mx-auto rounded-xl"/>
                ) : (
                  <div className="w-44 h-44 mx-auto bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2">
                    <div className="text-4xl">▓▓▓</div>
                    <div className="text-xs text-gray-300">VietQR</div>
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">Quét để thanh toán qua VietQR / Banking app</div>
              </div>

              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Số tiền</span>
                <span className="font-bold text-teal-600">{vnd(bill.total)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                <span>Hết hạn</span>
                <span>15 phút</span>
              </div>

              {qr?.reference && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-4">
                  <span className="text-xs text-gray-500 flex-1 font-mono">{qr.reference}</span>
                  <button onClick={copy} className="text-gray-400 hover:text-gray-600"><Copy size={13}/></button>
                </div>
              )}

              <button onClick={()=>{ toast.success('SMS đã gửi cho bệnh nhân'); setStep('pharmacy') }}
                className="w-full bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                Gửi SMS cho bệnh nhân <ChevronRight size={15}/>
              </button>
            </div>
          )}

          {/* ── PHARMACY TAB ──────────────────────────────────────────────── */}
          {step==='pharmacy' && (
            <div className="p-5">
              {/* Drug list */}
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Đơn thuốc</div>
              {bill.drugs.length===0 ? (
                <div className="text-xs text-gray-300 text-center py-4 border border-dashed border-gray-100 rounded-xl">Chưa có đơn thuốc</div>
              ) : (
                <div className="space-y-1.5 mb-4">
                  {bill.drugs.map((rx,i)=>(
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      <Pill size={13} className="text-teal-500 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">{rx.drug||rx.name||'?'}</div>
                        <div className="text-xs text-gray-400">{rx.dose} · {rx.frequency} · {rx.days||7} ngày</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Send to pharmacy button */}
              {pharmStatus==='idle' && (
                <button onClick={sendToPharmacy}
                  className="w-full bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium py-3 rounded-xl transition flex items-center justify-center gap-2">
                  <ArrowRight size={15}/> Chuyển đơn đến quầy thuốc
                </button>
              )}
              {pharmStatus==='sending' && (
                <div className="w-full bg-orange-100 text-orange-600 text-sm font-medium py-3 rounded-xl flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/>
                  Đang gửi đến Pharmacy…
                </div>
              )}
              {pharmStatus==='sent' && (
                <div className="space-y-3">
                  <div className="w-full bg-green-50 border border-green-200 text-green-700 text-sm font-medium py-3 rounded-xl flex items-center justify-center gap-2">
                    <CheckCircle size={15}/> Đã chuyển đến quầy thuốc
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-600 space-y-1.5">
                    <div className="flex justify-between"><span>Số thứ tự</span><span className="font-mono font-semibold text-teal-600">#{String(Math.floor(Math.random()*90)+10)}</span></div>
                    <div className="flex justify-between"><span>Quầy thuốc</span><span>Tầng 1, cửa B</span></div>
                    <div className="flex justify-between"><span>Thời gian ước tính</span><span>10–15 phút</span></div>
                    <div className="flex justify-between"><span>Bệnh nhân</span><span className="font-medium">{patient?.name}</span></div>
                  </div>
                  <button onClick={()=>{ toast.success('SMS xác nhận đã gửi'); }}
                    className="w-full border border-gray-200 text-gray-600 text-xs py-2 rounded-xl hover:bg-gray-50 transition">
                    Gửi SMS thông báo cho bệnh nhân
                  </button>
                </div>
              )}

              {/* Lab + imaging reminder (full list) */}
              {(bill.labs.length>0 || bill.imagings.length>0) && (
                <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
                  <div className="font-medium mb-1">Nhắc bệnh nhân cận lâm sàng (đầy đủ)</div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {bill.labs.length > 0 && (
                      <div>
                        <div className="font-medium text-amber-800 mb-0.5">Xét nghiệm</div>
                        {bill.labs.map((t, i) => <div key={`lab-${i}`}>• {t}</div>)}
                      </div>
                    )}
                    {bill.imagings.length > 0 && (
                      <div className={bill.labs.length > 0 ? 'pt-1 border-t border-amber-200/70' : ''}>
                        <div className="font-medium text-amber-800 mb-0.5">Chẩn đoán hình ảnh / thăm dò</div>
                        {bill.imagings.map((t, i) => <div key={`img-${i}`}>• {t}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
