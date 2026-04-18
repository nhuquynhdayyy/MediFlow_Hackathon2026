import { useState, useRef, useCallback } from 'react'

/**
 * useVoice â€” Web Speech API hook
 * Returns { isRecording, transcript, start, stop, reset, supported }
 */
export function useVoice({ onTranscriptUpdate } = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'vi-VN'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let full = ''
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript
      }
      setTranscript(full)
      onTranscriptUpdate?.(full)
    }
    rec.onerror = () => setIsRecording(false)
    rec.onend = () => setIsRecording(false)

    rec.start()
    recognitionRef.current = rec
    setIsRecording(true)
  }, [supported, onTranscriptUpdate])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    setTranscript('')
  }, [stop])

  return { isRecording, transcript, start, stop, reset, supported }
}

