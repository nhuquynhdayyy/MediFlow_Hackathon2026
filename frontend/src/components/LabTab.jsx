import React from 'react'
import { useStore } from '../store'
import { aiLabSuggest } from '../services/api'
import { toast } from 'react-hot-toast'
import { Sparkles, Loader2, AlertTriangle, Circle, Camera } from 'lucide-react'

const P = {
  urgent:  { label:'Cấp thiết', cls:'bg-red-50 text-red-600 border-red-100'     },
  routine: { label:'Cần thiết', cls:'bg-amber-50 text-amber-600 border-amber-100'},
  optional:{ label:'Tùy chọn', cls:'bg-gray-50 text-gray-500 border-gray-100'   },
  imaging: { label:'Hình ảnh',  cls:'bg-blue-50 text-blue-600 border-blue-100'   },
}

export default function LabTab() {
  const { emr, setEmrField, loading, setLoading } = useStore()

  const handleAI = async () => {
    setLoading('lab', true)
    try {
      const res = await aiLabSuggest({             // không cần api_key
        symptoms:      emr.symptoms,
        diagnosis:     emr.diagnosis,
        history:       emr.history,
        existing_labs: emr.lab_orders || [],
      })
      const d = res.data
      const all = [
        ...(d.urgent  ||[]).map(x=>({...x,priority:'urgent'  })),
        ...(d.routine ||[]).map(x=>({...x,priority:'routine' })),
        ...(d.optional||[]).map(x=>({...x,priority:'optional'})),
        ...(d.imaging ||[]).map(x=>({...x,priority:'imaging' })),
      ]
      setEmrField('lab_orders', all.map(x=>x.test))
      setEmrField('_labData', all)
      toast.success(`Gợi ý ${all.length} xét nghiệm`)
    } catch { toast.error('Lỗi gợi ý xét nghiệm') }
    finally { setLoading('lab', false) }
  }

  const labData = emr._labData || []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Xét nghiệm & Chẩn đoán hình ảnh</span>
        <button onClick={handleAI} disabled={!!loading.lab} className="btn-ai text-xs">
          {loading.lab ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
          AI gợi ý xét nghiệm
        </button>
      </div>
      {labData.length === 0
        ? <div className="text-center py-8 text-gray-300 text-sm">Nhấn "AI gợi ý xét nghiệm" để phân tích</div>
        : ['urgent','imaging','routine','optional'].map(priority => {
            const items = labData.filter(x=>x.priority===priority)
            if (!items.length) return null
            const cfg = P[priority]
            return (
              <div key={priority}>
                <div className={`text-xs font-medium px-2 py-1 rounded-lg mb-1.5 inline-block border ${cfg.cls}`}>{cfg.label}</div>
                <div className="space-y-1.5">
                  {items.map((item,i)=>(
                    <div key={i} className={`border rounded-xl p-3 ${cfg.cls}`}>
                      <div className="text-sm font-medium">{item.test}</div>
                      {item.reason && <div className="text-xs opacity-80 mt-0.5">{item.reason}</div>}
                      {item.expected_result && <div className="text-xs opacity-70 mt-0.5">Dự kiến: {item.expected_result}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })
      }
    </div>
  )
}
