/**
 * LabTab — Xét nghiệm & Chẩn đoán hình ảnh
 * - AI gợi ý danh sách xét nghiệm
 * - Bác sĩ chọn từng cái hoặc "Chọn tất cả" / "Bỏ chọn tất cả"
 * - Danh sách đã chọn được lưu vào EMR
 */
import React, { useState, useMemo } from 'react'
import { useStore } from '../store'
import { aiLabSuggest } from '../services/api'
import { toast } from 'react-hot-toast'
import {
  Sparkles, Loader2, AlertTriangle, Circle, Camera,
  CheckSquare, Square, CheckCheck, X as XIcon,
} from 'lucide-react'

const PRIORITY_CONFIG = {
  urgent:  { label: 'Cấp thiết',  cls: 'bg-red-50 text-red-700 border-red-200',      dot: 'bg-red-400'    },
  imaging: { label: 'Hình ảnh',   cls: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-400'   },
  routine: { label: 'Cần thiết',  cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400'  },
  optional:{ label: 'Tùy chọn',   cls: 'bg-gray-50 text-gray-600 border-gray-200',    dot: 'bg-gray-300'   },
}
const PRIORITY_ORDER = ['urgent', 'imaging', 'routine', 'optional']

export default function LabTab() {
  const { emr, setEmrField, loading, setLoading } = useStore()
  const [suggestedLabs, setSuggestedLabs] = useState(emr._labData || [])
  const [selected, setSelected]           = useState(new Set(emr.lab_orders || []))

  // ── AI gợi ý ────────────────────────────────────────────────────────────
  const handleAI = async () => {
    setLoading('lab', true)
    try {
      const res = await aiLabSuggest({
        symptoms:      emr.symptoms,
        diagnosis:     emr.diagnosis,
        history:       emr.history,
        existing_labs: [],
      })
      const d = res.data
      const all = [
        ...(d.urgent  || []).map(x => ({ ...x, priority: 'urgent'   })),
        ...(d.routine || []).map(x => ({ ...x, priority: 'routine'  })),
        ...(d.optional|| []).map(x => ({ ...x, priority: 'optional' })),
        ...(d.imaging || []).map(x => ({ ...x, priority: 'imaging'  })),
      ]
      setSuggestedLabs(all)
      setEmrField('_labData', all)

      // Auto-select urgent + imaging
      const autoSelect = new Set(
        all.filter(x => x.priority === 'urgent' || x.priority === 'imaging').map(x => x.test)
      )
      setSelected(autoSelect)
      syncToEMR(autoSelect)

      toast.success(`Gợi ý ${all.length} xét nghiệm — đã tự chọn ${autoSelect.size} ưu tiên cao`)
    } catch {
      toast.error('Lỗi gợi ý xét nghiệm')
    } finally { setLoading('lab', false) }
  }

  const syncToEMR = (sel) => {
    setEmrField('lab_orders', [...sel])
  }

  // ── Toggle chọn ─────────────────────────────────────────────────────────
  const toggle = (test) => {
    const next = new Set(selected)
    if (next.has(test)) next.delete(test)
    else next.add(test)
    setSelected(next)
    syncToEMR(next)
  }

  const selectAll = () => {
    const next = new Set(suggestedLabs.map(x => x.test))
    setSelected(next)
    syncToEMR(next)
  }

  const clearAll = () => {
    setSelected(new Set())
    syncToEMR(new Set())
  }

  const selectGroup = (priority) => {
    const tests = suggestedLabs.filter(x => x.priority === priority).map(x => x.test)
    const next = new Set(selected)
    const allIn = tests.every(t => next.has(t))
    if (allIn) tests.forEach(t => next.delete(t))
    else       tests.forEach(t => next.add(t))
    setSelected(next)
    syncToEMR(next)
  }

  // group by priority
  const grouped = useMemo(() => {
    const g = {}
    PRIORITY_ORDER.forEach(p => { g[p] = suggestedLabs.filter(x => x.priority === p) })
    return g
  }, [suggestedLabs])

  const totalSelected = selected.size

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-gray-500">
          Xét nghiệm & Chẩn đoán hình ảnh
          {totalSelected > 0 && (
            <span className="ml-2 bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs font-medium">
              Đã chọn: {totalSelected}
            </span>
          )}
        </span>
        <button onClick={handleAI} disabled={!!loading.lab}
          className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-lg px-3 py-1.5 transition disabled:opacity-50">
          {loading.lab ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
          AI gợi ý xét nghiệm
        </button>
      </div>

      {/* Select all / clear */}
      {suggestedLabs.length > 0 && (
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <button onClick={selectAll}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-teal-200 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition">
            <CheckCheck size={12} /> Chọn tất cả
          </button>
          <button onClick={clearAll}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition">
            <XIcon size={12} /> Bỏ chọn
          </button>
          <span className="text-xs text-gray-400 ml-auto">
            {totalSelected}/{suggestedLabs.length} được chọn
          </span>
        </div>
      )}

      {/* Empty state */}
      {suggestedLabs.length === 0 && (
        <div className="text-center py-10 text-gray-300 text-sm">
          Nhấn "AI gợi ý xét nghiệm" để phân tích<br />
          <span className="text-xs">AI tự động chọn các xét nghiệm ưu tiên cao</span>
        </div>
      )}

      {/* Groups */}
      {PRIORITY_ORDER.map(priority => {
        const items = grouped[priority]
        if (!items?.length) return null
        const cfg = PRIORITY_CONFIG[priority]
        const allGroupSelected = items.every(x => selected.has(x.test))
        const someGroupSelected = items.some(x => selected.has(x.test))

        return (
          <div key={priority}>
            {/* Group header */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-gray-400">{items.length} xét nghiệm</span>
              </div>
              {/* Group select toggle */}
              <button
                onClick={() => selectGroup(priority)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
              >
                {allGroupSelected
                  ? <CheckSquare size={13} className="text-teal-500" />
                  : someGroupSelected
                  ? <CheckSquare size={13} className="text-gray-300" />
                  : <Square size={13} />
                }
                {allGroupSelected ? 'Bỏ nhóm' : 'Chọn nhóm'}
              </button>
            </div>

            {/* Items */}
            <div className="space-y-1.5">
              {items.map((item, i) => {
                const isChecked = selected.has(item.test)
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-teal-300 bg-teal-50/60'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="mt-0.5 shrink-0">
                      {isChecked
                        ? <CheckSquare size={15} className="text-teal-500" />
                        : <Square size={15} className="text-gray-300" />
                      }
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isChecked}
                      onChange={() => toggle(item.test)}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isChecked ? 'text-teal-800' : 'text-gray-800'}`}>
                        {item.test}
                      </div>
                      {item.reason && (
                        <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.reason}</div>
                      )}
                      {item.expected_result && (
                        <div className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
                          Dự kiến: {item.expected_result}
                        </div>
                      )}
                    </div>

                    {/* Priority dot */}
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Selected summary */}
      {totalSelected > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <div className="text-xs font-medium text-teal-800 mb-2 flex items-center gap-1">
            <CheckCheck size={12} /> Xét nghiệm đã chọn ({totalSelected})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...selected].map(test => (
              <span key={test}
                className="inline-flex items-center gap-1 text-xs bg-white border border-teal-200 text-teal-700 px-2 py-0.5 rounded-full">
                {test}
                <button onClick={() => toggle(test)} className="hover:text-red-400 transition">
                  <XIcon size={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
