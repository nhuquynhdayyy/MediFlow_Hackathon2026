// useConversationalVoice.js — FIXED VERSION

import { useState, useRef, useCallback, useEffect } from 'react'
import { triageChatStream } from '../services/api'

// ── Tuning constants ───────────────────────────────────────────────
const SILENCE_MS       = 1400
const MIN_CHARS        = 3
const VAD_INTERVAL_MS  = 80
const INTERRUPT_VOLUME = 45
const MAX_HISTORY      = 14
// FIX 1: Delay sau cancel() để tránh Chrome SpeechSynthesis bug
const TTS_POST_CANCEL_DELAY_MS = 80
// FIX 2: Timeout tối đa chờ TTS xong (tránh interval chạy vô tận)
const TTS_WAIT_TIMEOUT_MS = 15000
// FIX: Grace period sau khi bắt đầu SPEAKING trước khi cho phép interrupt
// Tránh TTS echo từ loa bị mic bắt lại làm tự-interrupt
const INTERRUPT_GRACE_MS = 1500
const LISTEN_RESUME_DELAY_MS = 180

export const VS = {
  IDLE:      'idle',
  LISTENING: 'listening',
  THINKING:  'thinking',
  SPEAKING:  'speaking',
}

// ── Cache voices ở module level ──────────────────────────────────────
let cachedVoices = []
const loadVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) cachedVoices = voices
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

const getViVoice = () => {
  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices()
  return voices.find(v => v.lang.startsWith('vi')) || null
}

export function useConversationalVoice({ apiKey, model, historyRef, onNewMessage, onBeforeSend }) {
  const [voiceState, setVoiceState] = useState(VS.IDLE)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [aiStreamText,   setAiStreamText]   = useState('')
  const [amplitude,      setAmplitude]      = useState(0)

  const stateRef        = useRef(VS.IDLE)
  const recognitionRef  = useRef(null)
  const synthRef        = useRef(window.speechSynthesis)
  const audioCtxRef     = useRef(null)
  const analyserRef     = useRef(null)
  const vadTimerRef     = useRef(null)
  const silenceTimerRef = useRef(null)
  const streamAbortRef  = useRef(null)
  const pendingTextRef  = useRef('')
  const finalizedRef    = useRef('')
  const sttPausedRef    = useRef(false)
  const listenResumeTimerRef = useRef(null)
  // FIX: Track thời điểm bắt đầu SPEAKING để tính grace period
  const speakingStartRef = useRef(0)

  // TTS queue dùng ref để tránh stale closure
  const ttsQueueRef      = useRef([])
  const isSpeakingRef    = useRef(false)
  // FIX 1: track xem cancel() vừa được gọi chưa để delay speak() tiếp theo
  const cancelledRef     = useRef(false)

  const startSTTInternalRef   = useRef()
  const restartSTTInternalRef = useRef()

  const setState = useCallback((s) => {
    stateRef.current = s
    setVoiceState(s)
  }, [])

  const supported = typeof window !== 'undefined'
    && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    && 'speechSynthesis' in window

  // ════════════════════════════════════════════════════════════════════
  // TTS — ref-based queue với Chrome cancel() bug fix
  // ════════════════════════════════════════════════════════════════════

  const speakNextRef = useRef(null)

  speakNextRef.current = () => {
    if (ttsQueueRef.current.length === 0) {
      isSpeakingRef.current = false
      return
    }
    const text = ttsQueueRef.current.shift()
    if (!text || !text.trim()) {
      speakNextRef.current()
      return
    }

    const doSpeak = () => {
      const utt = new SpeechSynthesisUtterance(text)
      utt.lang  = 'vi-VN'
      utt.rate  = 0.85
      utt.pitch = 1.0
      const viVoice = getViVoice()
      if (viVoice) utt.voice = viVoice

      utt.onstart = () => { isSpeakingRef.current = true }
      utt.onend   = () => { speakNextRef.current() }
      utt.onerror = (e) => {
        // FIX 1: 'interrupted' xảy ra khi cancel() được gọi — không cần log, tiếp tục queue
        if (e.error !== 'interrupted') {
          console.warn('TTS error:', e.error)
        }
        isSpeakingRef.current = false
        speakNextRef.current()
      }
      synthRef.current.speak(utt)
    }

    // FIX 1: Nếu vừa cancel(), delay một chút để Chrome flush internal state
    if (cancelledRef.current) {
      cancelledRef.current = false
      setTimeout(doSpeak, TTS_POST_CANCEL_DELAY_MS)
    } else {
      doSpeak()
    }
  }

  const speakChunk = useCallback((text) => {
    if (!text || !text.trim()) return
    ttsQueueRef.current.push(text)
    if (!isSpeakingRef.current) {
      speakNextRef.current()
    }
  }, [])

  const feedTTS = useCallback((chunk) => {
    pendingTextRef.current += chunk
    const endsWithPunct = /[.!?,;\n]$/.test(pendingTextRef.current.trim())
    const longEnough    = pendingTextRef.current.length > 120
    if (endsWithPunct || longEnough) {
      speakChunk(pendingTextRef.current)
      pendingTextRef.current = ''
    }
  }, [speakChunk])

  const stopSpeaking = useCallback(() => {
    // FIX 1: Đánh dấu đã cancel để speakNextRef delay khi speak lại
    cancelledRef.current  = true
    synthRef.current.cancel()
    ttsQueueRef.current    = []
    isSpeakingRef.current  = false
    pendingTextRef.current = ''
  }, [])

  // ════════════════════════════════════════════════════════════════════
  // VAD
  // ════════════════════════════════════════════════════════════════════
  const startVAD = useCallback(async () => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx      = new AudioContext()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      vadTimerRef.current = setInterval(() => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        const pct = Math.min(100, (avg / 255) * 100 * 3)
        setAmplitude(pct)

        // NOTE: Auto-interrupt bằng VAD đã bị tắt.
        // Lý do: mic bắt tiếng loa TTS (echo) → avg vượt ngưỡng → tự interrupt
        // → TTS bị cắt giữa chừng. Không thể phân biệt giọng user vs echo loa.
        // User dừng thủ công bằng nút "Kết thúc cuộc trò chuyện".
        // Sau khi TTS đọc xong, hệ thống tự động quay lại LISTENING.
      }, VAD_INTERVAL_MS)
    } catch (_) {
      console.warn('VAD: không có quyền mic')
    }
  }, [stopSpeaking, setState])

  const stopVAD = useCallback(() => {
    clearInterval(vadTimerRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    setAmplitude(0)
  }, [])

  const clearListenResumeTimer = useCallback(() => {
    if (listenResumeTimerRef.current) {
      clearTimeout(listenResumeTimerRef.current)
      listenResumeTimerRef.current = null
    }
  }, [])

  const pauseSTT = useCallback(() => {
    clearListenResumeTimer()
    sttPausedRef.current = true
    recognitionRef.current?.stop()
    recognitionRef.current = null
    clearTimeout(silenceTimerRef.current)
    setLiveTranscript('')
    finalizedRef.current = ''
  }, [clearListenResumeTimer])

  const suspendSTT = useCallback(() => {
    clearListenResumeTimer()
    sttPausedRef.current = true
    clearTimeout(silenceTimerRef.current)
    setLiveTranscript('')
    finalizedRef.current = ''
  }, [clearListenResumeTimer])

  const resumeSTTWithDelay = useCallback((delayMs = LISTEN_RESUME_DELAY_MS) => {
    clearListenResumeTimer()
    if (stateRef.current === VS.IDLE) return
    listenResumeTimerRef.current = setTimeout(() => {
      if (stateRef.current === VS.IDLE) return
      sttPausedRef.current = false
      setState(VS.LISTENING)
      if (!recognitionRef.current) {
        startSTTInternalRef.current?.()
      }
    }, delayMs)
  }, [clearListenResumeTimer, setState])

  // ════════════════════════════════════════════════════════════════════
  // SEND
  // ════════════════════════════════════════════════════════════════════
  const triggerSend = useCallback((text) => {
    const cleanText = text.trim()
    if (!cleanText || cleanText.length < MIN_CHARS || stateRef.current === VS.THINKING) return

    // Allow parent to intercept special voice commands (e.g. confirm booking)
    if (typeof onBeforeSend === 'function') {
      const consumed = onBeforeSend(cleanText)
      if (consumed) {
        setLiveTranscript('')
        finalizedRef.current = ''
        return
      }
    }

    console.log('>>> Voice Mode: Gửi:', cleanText)
    suspendSTT()
    setState(VS.THINKING)
    setLiveTranscript('')
    finalizedRef.current   = ''
    setAiStreamText('')
    pendingTextRef.current = ''

    onNewMessage?.({ role: 'user', content: cleanText })

    // FIX: Bỏ message cuối (user msg vừa push qua onNewMessage) để tránh gửi 2 lần
    // vì triageChatStream đã nhận cleanText riêng qua tham số message
    const history = (historyRef?.current ?? [])
      .slice(0, -1)
      .slice(-MAX_HISTORY)
      .map(m => ({ role: m.role, content: m.content }))

    let accumulated = ''
    let firstChunk  = true
    const abortCtrl = new AbortController()
    streamAbortRef.current = abortCtrl

    triageChatStream(
      cleanText,
      history,
      apiKey,
      model,
      // onChunk
      (chunk) => {
        if (abortCtrl.signal.aborted) return
        accumulated += chunk
        setAiStreamText(
          accumulated
            .replace(/\[TRIAGE:\d\]/g, '')
            .replace(/\[DEPT:[^\]]+\]/g, '')
        )
        // FIX: set SPEAKING ngay tại chunk đầu tiên + ghi timestamp cho grace period
        if (firstChunk) {
          firstChunk = false
          speakingStartRef.current = Date.now()
          setState(VS.SPEAKING)
        }
        feedTTS(chunk)
      },
      // onDone
      () => {
        if (abortCtrl.signal.aborted) return
        console.log('>>> Voice Mode: API xong, tổng:', accumulated.length, 'ký tự')

        // Flush phần còn lại trong buffer
        if (pendingTextRef.current.trim()) {
          speakChunk(pendingTextRef.current)
          pendingTextRef.current = ''
        }

        // Parse metadata
        let level = null, dept = null, action = null
        if (accumulated.includes('[TRIAGE:3]'))      { level = 3; action = 'emergency' }
        else if (accumulated.includes('[TRIAGE:2]')) { level = 2; action = 'book' }
        else if (accumulated.includes('[TRIAGE:1]')) { level = 1; action = 'home' }
        const dm = accumulated.match(/\[DEPT:([^\]]+)\]/)
        if (dm) dept = dm[1]

        const cleanMsg = accumulated
          .replace(/\[TRIAGE:\d\]/g, '')
          .replace(/\[DEPT:[^\]]+\]/g, '')
          .replace(/\[BOOK:[^\]]+\]/g, '')
          .trim()

        // Parse booking data tu token [BOOK:dept|date|time|phone]
        const bookMatch = accumulated.match(/\[BOOK:([^\]]+)\]/)
        let bookingData = null
        if (bookMatch) {
          const parts = bookMatch[1].split('|')
          if (parts.length >= 4) {
            bookingData = {
              department: parts[0].trim(),
              scheduled_date: parts[1].trim(),
              scheduled_time: parts[2].trim(),
              patient_phone: parts[3].trim(),
              triage_level: level,
            }
          }
        }

        onNewMessage?.({ role: 'assistant', content: cleanMsg,
                         triageLevel: level, department: dept, action, bookingData })

        // FIX 2: Đợi TTS xong với timeout tối đa, tránh interval vô tận
        let waited = 0
        const checkSpeaking = setInterval(() => {
          waited += 300
          const timedOut   = waited >= TTS_WAIT_TIMEOUT_MS
          const doneSpeaking = !synthRef.current.speaking && !isSpeakingRef.current
          if (timedOut || doneSpeaking) {
            clearInterval(checkSpeaking)
            if (stateRef.current !== VS.IDLE) resumeSTTWithDelay()
          }
        }, 300)
      },
      // onError
      (err) => {
        if (abortCtrl.signal.aborted) return
        console.error('>>> Voice Mode API ERROR:', err)
        onNewMessage?.({
          role: 'assistant',
          content: `⚠️ Lỗi kết nối: ${err.message || err || 'Không có phản hồi từ AI'}`,
          isError: true,
        })
        resumeSTTWithDelay(400)
      }
    )
  }, [
    apiKey, model, historyRef, onNewMessage, onBeforeSend,
    feedTTS, speakChunk, suspendSTT, setState, resumeSTTWithDelay
  ])

  // ════════════════════════════════════════════════════════════════════
  // STT
  // ════════════════════════════════════════════════════════════════════
  const stopSTT = useCallback(() => {
    sttPausedRef.current = true
    recognitionRef.current?.stop()
    recognitionRef.current = null
    clearTimeout(silenceTimerRef.current)
    setLiveTranscript('')
    finalizedRef.current = ''
  }, [])

  const restartSTT = useCallback(() => {
    if (stateRef.current !== VS.LISTENING || sttPausedRef.current) return
    recognitionRef.current?.stop()
    setTimeout(() => { startSTTInternalRef.current?.() }, 100)
  }, [])

  const startSTT = useCallback(() => {
    if (!supported) return
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang           = 'vi-VN'
    rec.continuous     = true
    rec.interimResults = true
    finalizedRef.current = ''

    rec.onresult = (e) => {
      if (stateRef.current !== VS.LISTENING) return
      let interim = '', finalized = finalizedRef.current
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) { finalized += t + ' '; finalizedRef.current = finalized }
        else { interim = t }
      }
      const fullText = (finalized + interim).trim()
      setLiveTranscript(fullText)
      clearTimeout(silenceTimerRef.current)
      if (fullText.length >= MIN_CHARS) {
        silenceTimerRef.current = setTimeout(() => {
          if (stateRef.current === VS.LISTENING) {
            triggerSend(fullText)
          }
        }, SILENCE_MS)
      }
    }

    rec.onerror = (e) => {
      console.warn('STT Error:', e.error)
      if ((e.error === 'no-speech' || e.error === 'network') && stateRef.current === VS.LISTENING && !sttPausedRef.current) {
        restartSTTInternalRef.current?.()
      }
    }

    rec.onend = () => {
      if (stateRef.current === VS.LISTENING && !sttPausedRef.current) {
        setTimeout(() => { restartSTTInternalRef.current?.() }, 200)
      }
    }

    rec.start()
    recognitionRef.current = rec
  }, [supported, triggerSend])

  useEffect(() => { startSTTInternalRef.current  = startSTT  }, [startSTT])
  useEffect(() => { restartSTTInternalRef.current = restartSTT }, [restartSTT])

  // ════════════════════════════════════════════════════════════════════
  // ACTIVATE / DEACTIVATE
  // ════════════════════════════════════════════════════════════════════
  const activate = useCallback(async () => {
    if (!supported || stateRef.current !== VS.IDLE) return
    loadVoices()
    sttPausedRef.current = false
    setState(VS.LISTENING)
    await startVAD()
    startSTTInternalRef.current?.()
  }, [supported, startVAD, setState])

  const deactivate = useCallback(() => {
    clearListenResumeTimer()
    stopSTT()
    stopVAD()
    stopSpeaking()
    streamAbortRef.current?.abort()
    setState(VS.IDLE)
    setLiveTranscript('')
    setAiStreamText('')
    setAmplitude(0)
  }, [stopSTT, stopVAD, stopSpeaking, setState, clearListenResumeTimer])

  useEffect(() => () => deactivate(), [deactivate])

  return {
    voiceState, liveTranscript, aiStreamText, amplitude,
    supported, activate, deactivate, triggerSend,
  }
}