import React, { useState, useRef, useEffect } from 'react'
import {
  Mic, MicOff, ArrowRight, Trash2, Save,
  History, ChevronDown, ChevronUp, X, Clock, Loader2,
} from 'lucide-react'
import { useStore } from '../store'
import { useVoice } from '../hooks/useVoice'
import { aiVoiceToEMR } from '../services/api'
import { toast } from 'react-hot-toast'

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const STORAGE_KEY = 'mediflow_voice_sessions'
const loadSessions = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
const persistSessions = (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s))

function buildVoiceNotes(data) {
  return [
    data.vital_signs ? `Sinh hieu: ${data.vital_signs}` : '',
    data.allergies ? `Di ung: ${data.allergies}` : '',
    data.current_medications ? `Thuoc dang dung: ${data.current_medications}` : '',
    data.red_flags ? `${data.red_flags}` : '',
    data.notes || '',
  ].filter(Boolean).join('\n')
}

export default function VoiceRecorder() {
  const { activePatient, setEmrField, addChatMessage, loading, setLoading } = useStore()
  const { isRecording, utterances, seconds, supported, toggle, stop, clear, getFinals } = useVoice()

  const [expanded, setExpanded] = useState(true)
  const [showSessions, setShowSessions] = useState(false)
  const [sessions, setSessions] = useState(loadSessions)
  const [saveLabel, setSaveLabel] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [utterances])

  const handleToggle = () => {
    if (isRecording) {
      stop()
      return
    }
    clear()
    toggle()
  }

  const processTranscript = async (utts) => {
    const src = (utts || getFinals()).filter(u => !u.interim)
    if (!src.length) {
      toast.error('Chua co noi dung')
      return
    }

    const transcript = src.map(u => u.text).join('\n')

    setLoading('voice', true)
    addChatMessage({ role: 'assistant', text: 'Dang trich xuat AI EMR tu hoi thoai...', loading: true })
    try {
      const res = await aiVoiceToEMR({
        transcript,
        patient_id: activePatient?.id || '',
        appointment_id: activePatient?.appointment_id || '',
        doctor_id: 'DR001',
      })
      const d = res.data || {}
      const synthesizedNotes = buildVoiceNotes(d)

      if (d.chief_complaint) setEmrField('chief_complaint', d.chief_complaint)
      if (d.symptoms) setEmrField('symptoms', d.symptoms)
      if (d.history) setEmrField('history', d.history)
      if (d.assessment) setEmrField('diagnosis', d.assessment)
      if (d.plan) setEmrField('treatment_plan', d.plan)
      if (synthesizedNotes) setEmrField('notes', synthesizedNotes)

      addChatMessage({
        role: 'assistant',
        text:
          `**AI EMR da cap nhat** (tin cay: ${Math.round((d.confidence || 0.8) * 100)}%)\n` +
          `• Ly do kham: ${d.chief_complaint || '-'}\n` +
          `• Danh gia: ${d.assessment || '-'}\n` +
          `• Ke hoach: ${d.plan || '-'}`,
        loading: false,
      })
      toast.success('Da dien EMR tu giong noi')
    } catch (e) {
      addChatMessage({ role: 'assistant', text: `Loi: ${e.message}`, loading: false })
      toast.error('Loi xu ly giong noi')
    } finally {
      setLoading('voice', false)
    }
  }

  const saveSession = () => {
    const finals = getFinals()
    if (!finals.length) {
      toast.error('Khong co noi dung de luu')
      return
    }

    const label = saveLabel.trim() || `${activePatient?.name || 'Benh nhan'} - ${new Date().toLocaleString('vi-VN')}`
    const session = {
      id: Date.now(),
      label,
      patient: activePatient?.name || '',
      patient_id: activePatient?.id || '',
      appointment_id: activePatient?.appointment_id || '',
      date: new Date().toLocaleString('vi-VN'),
      duration: seconds,
      utterances: finals,
    }
    const updated = [session, ...sessions].slice(0, 20)
    setSessions(updated)
    persistSessions(updated)
    setSaveLabel('')
    setShowSaveInput(false)
    toast.success('Da luu phien ghi am')
  }

  const deleteSession = (id) => {
    const updated = sessions.filter(s => s.id !== id)
    setSessions(updated)
    persistSessions(updated)
  }

  const finals = utterances.filter(u => !u.interim)
  const interim = utterances.find(u => u.interim)
  const hasContent = finals.length > 0

  return (
    <div className="border-t border-gray-100 bg-gray-50 shrink-0">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-xs font-medium text-gray-600">Voice-to-EMR</span>

        {!supported && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Dung Chrome</span>
        )}

        <span className={`ml-auto text-xs tabular-nums font-mono ${isRecording ? 'text-red-500' : 'text-gray-400'}`}>
          {isRecording && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mr-1 animate-pulse align-middle" />}
          {fmt(seconds)}
        </span>

        <button
          onClick={() => setShowSessions(v => !v)}
          className={`text-xs flex items-center gap-1 px-2 py-1 rounded-lg border transition ${showSessions ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-200 hover:bg-gray-100'}`}
        >
          <History size={12} />
          {sessions.length > 0 && (
            <span className="bg-teal-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">{sessions.length}</span>
          )}
        </button>

        <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <div
            ref={scrollRef}
            className="bg-white border border-gray-200 rounded-xl overflow-y-auto"
            style={{ maxHeight: '180px', minHeight: '56px' }}
          >
            {utterances.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-14 gap-1">
                <span className="text-xs text-gray-300">Nhan &quot;Ghi am&quot; de lay transcript roi dua thang vao AI EMR</span>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {finals.map(utt => <UttRow key={utt.id} utt={utt} />)}
                {interim && (
                  <div className="flex items-start gap-2 px-3 py-2 opacity-50 bg-gray-50">
                    <TranscriptBadge />
                    <span className="text-xs text-gray-500 italic flex-1">{interim.text}...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <button
              onClick={handleToggle}
              disabled={!supported}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition font-medium shrink-0 ${
                isRecording
                  ? 'bg-red-500 text-white border-red-500 recording-pulse'
                  : 'bg-teal-400 text-white border-teal-400 hover:bg-teal-600'
              } disabled:opacity-40`}
            >
              {isRecording ? <MicOff size={13} /> : <Mic size={13} />}
              {isRecording ? 'Dung ghi' : 'Ghi am'}
            </button>

            {hasContent && !isRecording && (
              showSaveInput ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    autoFocus
                    value={saveLabel}
                    onChange={e => setSaveLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveSession(); if (e.key === 'Escape') setShowSaveInput(false) }}
                    placeholder={`${activePatient?.name || 'Benh nhan'} - ${new Date().toLocaleDateString('vi-VN')}`}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-teal-400 min-w-0"
                  />
                  <button onClick={saveSession} className="text-xs px-2.5 py-1.5 bg-teal-400 text-white rounded-lg hover:bg-teal-600 transition shrink-0">Luu</button>
                  <button onClick={() => setShowSaveInput(false)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={13} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition text-gray-600"
                >
                  <Save size={12} /> Luu phien
                </button>
              )
            )}

            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => processTranscript()}
                disabled={!hasContent || !!loading.voice}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-40"
              >
                {loading.voice ? <Loader2 size={12} className="spin" /> : <ArrowRight size={13} />}
                Sang EMR
              </button>
              <button
                onClick={clear}
                disabled={!hasContent || isRecording}
                className="text-gray-400 hover:text-red-400 disabled:opacity-30 p-1.5 transition"
                title="Xoa"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showSessions && (
        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Phien ghi am da luu ({sessions.length})</span>
            <button onClick={() => setShowSessions(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-xs text-gray-300 text-center py-4">Chua co phien nao duoc luu</div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {sessions.map(sess => (
                <SessionCard
                  key={sess.id}
                  session={sess}
                  onDelete={() => deleteSession(sess.id)}
                  onToEMR={() => processTranscript(sess.utterances)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function UttRow({ utt }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-slate-50/70">
      <TranscriptBadge />
      <span className="text-xs text-gray-800 flex-1 leading-relaxed">{utt.text}</span>
      {utt.time && <span className="text-xs text-gray-300 shrink-0 tabular-nums mt-0.5">{utt.time}</span>}
    </div>
  )
}

function TranscriptBadge() {
  return <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 mt-0.5">TXT</span>
}

function SessionCard({ session, onDelete, onToEMR }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
        <button onClick={() => setOpen(v => !v)} className="flex-1 text-left min-w-0">
          <div className="text-xs font-medium text-gray-800 truncate">{session.label}</div>
          <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-0.5"><Clock size={9} />{session.date}</span>
            <span>- {fmt(session.duration)}</span>
            <span>- {session.utterances.length} cau</span>
          </div>
        </button>
        <button
          onClick={onToEMR}
          className="shrink-0 text-xs px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-100 transition flex items-center gap-1"
        >
          <ArrowRight size={11} /> EMR
        </button>
        <button onClick={onDelete} className="shrink-0 text-gray-300 hover:text-red-400 transition p-1"><Trash2 size={12} /></button>
        <button onClick={() => setOpen(v => !v)} className="text-gray-300 shrink-0">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      {open && (
        <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
          {session.utterances.map((utt, i) => <UttRow key={i} utt={utt} />)}
        </div>
      )}
    </div>
  )
}
