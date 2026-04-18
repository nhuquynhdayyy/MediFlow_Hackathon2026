import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, FileText, Pill, Plus, RefreshCw, Save, UserRound } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore'

import { db } from '../services/firebase'
import { getMedicalRecordsByPatient, updateMedicalRecord } from '../services/api'
import { useStore } from '../store'

const EMPTY_MEDICATION = { name: '', dosage: '', usage: '' }

function isBlank(value) {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

function toDateInputValue(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function toSortValue(record) {
  const candidates = [
    record?.updated_at_iso,
    record?.updated_at,
    record?.current_date,
    record?.record_date,
    record?.created_at_iso,
    record?.created_at,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(candidate)) {
      const parsed = new Date(candidate)
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
    }
    if (typeof candidate?.toDate === 'function') return candidate.toDate().getTime()
    const parsed = new Date(candidate)
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
  }

  return 0
}

function normalizeMedication(item = {}) {
  const next = {
    name: item?.name || item?.drug || item?.generic || '',
    dosage: item?.dosage || item?.dose || item?.quantity || '',
    usage: item?.usage || item?.instructions || item?.note || item?.notes || '',
  }

  if (!next.usage) {
    const routeAndFrequency = [item?.route, item?.frequency].filter(Boolean).join(' ')
    const days = item?.days ? `${item.days} ngay` : ''
    next.usage = [routeAndFrequency, days].filter(Boolean).join(' | ')
  }

  return next
}

function normalizeMedicalRecord(data = {}, id = '') {
  const treatment = typeof data.treatment === 'object' && data.treatment !== null ? data.treatment : {}
  const medications = (
    treatment.medications ||
    data.prescriptions ||
    []
  ).map(normalizeMedication)

  return {
    medical_record_id: data.medical_record_id || id,
    patient_id: data.patient_id || '',
    full_name: data.full_name || data.patient_name || '',
    age: data.age ?? '',
    gender: data.gender || '',
    diagnosis: data.diagnosis || data.preliminary_diagnosis || '',
    treatment: {
      description: treatment.description || data.treatment_plan || (typeof data.treatment === 'string' ? data.treatment : ''),
      medications,
    },
    current_date: toDateInputValue(data.current_date || data.record_date || data.updated_at_iso || data.created_at_iso),
    follow_up_date: toDateInputValue(data.follow_up_date),
    notes: data.notes || '',
    updated_at_iso: data.updated_at_iso || '',
    created_at_iso: data.created_at_iso || '',
    doctor_id: data.doctor_id || '',
  }
}

function buildFormState(record, user) {
  return {
    full_name: record?.full_name || user?.full_name || '',
    age: record?.age === 0 ? '0' : String(record?.age || ''),
    gender: record?.gender || '',
    diagnosis: record?.diagnosis || '',
    treatment_description: record?.treatment?.description || '',
    medications: record?.treatment?.medications?.length
      ? record.treatment.medications.map((item) => ({ ...EMPTY_MEDICATION, ...item }))
      : [],
    current_date: record?.current_date || '',
    follow_up_date: record?.follow_up_date || '',
    notes: record?.notes || '',
  }
}

function sanitizeMedications(items = []) {
  return items
    .map((item) => ({
      name: item.name?.trim?.() || '',
      dosage: item.dosage?.trim?.() || '',
      usage: item.usage?.trim?.() || '',
    }))
    .filter((item) => item.name || item.dosage || item.usage)
}

export default function MedicalRecordsPage() {
  const { user, setUser } = useStore()
  const [records, setRecords] = useState([])
  const [currentRecord, setCurrentRecord] = useState(null)
  const [form, setForm] = useState(() => buildFormState(null, user))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [listenerError, setListenerError] = useState('')

  useEffect(() => {
    if (!user?.uid) return undefined

    let active = true
    setLoading(true)
    setListenerError('')

    const recordsQuery = query(
      collection(db, 'medical_records'),
      where('patient_id', '==', user.uid),
    )

    const applyRecords = (rawRecords) => {
      const nextRecords = [...rawRecords]
        .sort((left, right) => toSortValue(right) - toSortValue(left))
      const latest = nextRecords[0] || null
      setRecords(nextRecords)
      setCurrentRecord(latest)
      setForm(buildFormState(latest, user))
      setLoading(false)
    }

    const unsubscribe = onSnapshot(
      recordsQuery,
      (snapshot) => {
        if (!active) return
        const nextRecords = snapshot.docs.map((recordDoc) =>
          normalizeMedicalRecord(recordDoc.data(), recordDoc.id),
        )
        applyRecords(nextRecords)
      },
      async () => {
        if (!active) return
        setListenerError('Khong the nghe realtime tu Firestore. Dang dung API fallback.')
        try {
          const response = await getMedicalRecordsByPatient(user.uid)
          const apiRecords = (response?.data || []).map((item) => normalizeMedicalRecord(item, item.medical_record_id))
          if (!active) return
          applyRecords(apiRecords)
        } catch (error) {
          if (!active) return
          setLoading(false)
          setRecords([])
          setCurrentRecord(null)
          setForm(buildFormState(null, user))
          setListenerError(error?.message || 'Khong tai duoc ho so benh an.')
        }
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [user?.uid, user?.full_name])

  const locks = useMemo(() => ({
    diagnosis: !isBlank(currentRecord?.diagnosis),
    treatmentDescription: !isBlank(currentRecord?.treatment?.description),
    medications: (currentRecord?.treatment?.medications || []).length > 0,
    currentDate: !isBlank(currentRecord?.current_date),
    followUpDate: !isBlank(currentRecord?.follow_up_date),
    notes: !isBlank(currentRecord?.notes),
  }), [currentRecord])

  const summaryItems = [
    {
      label: 'Ho ten',
      value: currentRecord?.full_name || form.full_name || user?.full_name || 'Chua cap nhat',
      icon: <UserRound size={15} />,
    },
    {
      label: 'Ngay kham',
      value: currentRecord?.current_date || 'Dang cho bac si cap nhat',
      icon: <CalendarDays size={15} />,
    },
    {
      label: 'So ho so',
      value: `${records.length} ban ghi`,
      icon: <FileText size={15} />,
    },
  ]

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleMedicationChange = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      medications: prev.medications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const addMedicationRow = () => {
    setForm((prev) => ({
      ...prev,
      medications: [...prev.medications, { ...EMPTY_MEDICATION }],
    }))
  }

  const removeMedicationRow = (index) => {
    setForm((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const handleSave = async () => {
    if (!user?.uid) return

    const payload = {
      full_name: form.full_name.trim(),
      age: form.age.trim(),
      gender: form.gender.trim(),
      diagnosis: form.diagnosis.trim(),
      treatment: {
        description: form.treatment_description.trim(),
        medications: sanitizeMedications(form.medications),
      },
      current_date: form.current_date,
      follow_up_date: form.follow_up_date,
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      await updateMedicalRecord(user.uid, payload)

      if (payload.full_name && payload.full_name !== user?.full_name) {
        await setDoc(
          doc(db, 'users', user.uid),
          { full_name: payload.full_name },
          { merge: true },
        )
        setUser({ ...user, full_name: payload.full_name })
      }

      toast.success('Ho so benh an da duoc cap nhat.')
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || 'Khong the cap nhat ho so.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_36%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)]">
      <div className="max-w-6xl mx-auto px-4 py-5 md:px-6 md:py-6 space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-[30px] border border-teal-100 bg-white/90 p-6 shadow-[0_22px_60px_-30px_rgba(13,148,136,0.45)]">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 font-semibold text-teal-700">
                <RefreshCw size={12} />
                Realtime medical records
              </span>
              {listenerError && (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                  <AlertCircle size={12} />
                  API fallback
                </span>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">Ho so benh an</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Ho so nay se tu dong cap nhat ngay khi bac si luu benh an tu Agent 2. Cac muc
              bac si da nhap se duoc giu nguyen, con cac truong trong ban co the bo sung them.
            </p>
            {listenerError && (
              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                {listenerError}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {item.icon}
                  {item.label}
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-800">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.18fr,0.82fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_64px_-36px_rgba(15,23,42,0.35)] md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Thong tin dang hien thi cho benh nhan</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cac o mau vang la thong tin dang cho bo sung. Cac o khoa da duoc bac si dien.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                Luu bo sung
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-400">Dang tai ho so benh an...</div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <FormField
                  label="Ho ten"
                  value={form.full_name}
                  onChange={(value) => handleFieldChange('full_name', value)}
                />
                <FormField
                  label="Tuoi"
                  value={form.age}
                  inputMode="numeric"
                  onChange={(value) => handleFieldChange('age', value)}
                />
                <FormField
                  label="Gioi tinh"
                  value={form.gender}
                  onChange={(value) => handleFieldChange('gender', value)}
                />
                <FormField
                  label="Ngay kham"
                  type="date"
                  value={form.current_date}
                  onChange={(value) => handleFieldChange('current_date', value)}
                  readOnly={locks.currentDate}
                  highlighted={!locks.currentDate}
                  hint={locks.currentDate ? 'Da khoa tu benh an bac si' : 'Ban co the bo sung neu dang de trong'}
                />
                <FormField
                  label="Chan doan"
                  value={form.diagnosis}
                  onChange={(value) => handleFieldChange('diagnosis', value)}
                  readOnly={locks.diagnosis}
                  highlighted={!locks.diagnosis}
                  hint={locks.diagnosis ? 'Da khoa tu benh an bac si' : 'Chi duoc bo sung khi bac si chua nhap'}
                />
                <FormField
                  label="Ngay tai kham"
                  type="date"
                  value={form.follow_up_date}
                  onChange={(value) => handleFieldChange('follow_up_date', value)}
                  readOnly={locks.followUpDate}
                  highlighted={!locks.followUpDate}
                  hint={locks.followUpDate ? 'Da khoa tu benh an bac si' : 'Ban co the bo sung neu dang de trong'}
                />

                <div className="md:col-span-2">
                  <FormField
                    label="Noi dung dieu tri"
                    multiline
                    rows={4}
                    value={form.treatment_description}
                    onChange={(value) => handleFieldChange('treatment_description', value)}
                    readOnly={locks.treatmentDescription}
                    highlighted={!locks.treatmentDescription}
                    hint={locks.treatmentDescription ? 'Da khoa tu benh an bac si' : 'Chi duoc bo sung khi bac si chua nhap'}
                  />
                </div>

                <div className="md:col-span-2 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Thuoc va cach dung</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Day la danh sach thuoc trong phan treatment.medications.
                      </div>
                    </div>
                    {!locks.medications && (
                      <button
                        type="button"
                        onClick={addMedicationRow}
                        className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-50"
                      >
                        <Plus size={13} />
                        Them dong thuoc
                      </button>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {form.medications.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/90 px-4 py-5 text-sm text-slate-400">
                        {locks.medications ? 'Bac si chua them don thuoc cho lan kham nay.' : 'Ban co the them thuoc neu truong nay dang con thieu.'}
                      </div>
                    ) : (
                      form.medications.map((medication, index) => (
                        <div
                          key={`${index}-${medication.name}-${medication.dosage}`}
                          className="rounded-[22px] border border-white bg-white p-4 shadow-sm"
                        >
                          <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_1.2fr]">
                            <MiniField
                              label="Ten thuoc"
                              value={medication.name}
                              onChange={(value) => handleMedicationChange(index, 'name', value)}
                              readOnly={locks.medications}
                            />
                            <MiniField
                              label="Lieu dung"
                              value={medication.dosage}
                              onChange={(value) => handleMedicationChange(index, 'dosage', value)}
                              readOnly={locks.medications}
                            />
                            <MiniField
                              label="Cach dung"
                              value={medication.usage}
                              onChange={(value) => handleMedicationChange(index, 'usage', value)}
                              readOnly={locks.medications}
                            />
                          </div>
                          {!locks.medications && (
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeMedicationRow(index)}
                                className="text-xs font-semibold text-rose-500 transition hover:text-rose-600"
                              >
                                Xoa dong nay
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FormField
                    label="Ghi chu"
                    multiline
                    rows={4}
                    value={form.notes}
                    onChange={(value) => handleFieldChange('notes', value)}
                    readOnly={locks.notes}
                    highlighted={!locks.notes}
                    hint={locks.notes ? 'Da khoa tu benh an bac si' : 'Chi duoc bo sung khi bac si chua nhap'}
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-[30px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Pill size={16} className="text-teal-600" />
                Ban tom tat hien tai
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <SummaryRow label="Chan doan" value={currentRecord?.diagnosis || 'Dang cho cap nhat'} />
                <SummaryRow
                  label="Dieu tri"
                  value={currentRecord?.treatment?.description || 'Dang cho cap nhat'}
                />
                <SummaryRow label="Ngay tai kham" value={currentRecord?.follow_up_date || 'Chua co'} />
                <SummaryRow label="Bac si" value={currentRecord?.doctor_id || 'Chua ghi nhan'} />
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Lich su gan day</div>
              <div className="mt-4 space-y-3">
                {records.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                    Chua co ho so nao duoc tao cho tai khoan nay.
                  </div>
                ) : (
                  records.map((record) => (
                    <div
                      key={record.medical_record_id || `${record.current_date}-${record.diagnosis}`}
                      className="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            {record.current_date || 'Khong ro ngay kham'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{record.diagnosis || 'Chua co chan doan'}</div>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          {record.follow_up_date ? `Tai kham ${record.follow_up_date}` : 'Theo doi them'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  readOnly = false,
  highlighted = false,
  hint = '',
  multiline = false,
  rows = 3,
  type = 'text',
  inputMode,
}) {
  const sharedClassName = `mt-3 w-full rounded-2xl border px-4 py-3 text-sm text-slate-800 outline-none transition ${
    readOnly
      ? 'border-slate-200 bg-slate-100/80 text-slate-500'
      : highlighted
        ? 'border-amber-200 bg-amber-50/70 focus:border-amber-300'
        : 'border-slate-200 bg-white focus:border-teal-300'
  }`

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</label>
        {hint && (
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            readOnly ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
          }`}>
            {hint}
          </span>
        )}
      </div>

      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          className={`${sharedClassName} resize-none leading-6`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          inputMode={inputMode}
          className={sharedClassName}
        />
      )}
    </div>
  )
}

function MiniField({ label, value, onChange, readOnly }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        className={`mt-2 w-full rounded-2xl border px-3.5 py-2.5 text-sm outline-none ${
          readOnly
            ? 'border-slate-200 bg-slate-100 text-slate-500'
            : 'border-slate-200 bg-white text-slate-800 focus:border-teal-300'
        }`}
      />
    </label>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{value}</div>
    </div>
  )
}
