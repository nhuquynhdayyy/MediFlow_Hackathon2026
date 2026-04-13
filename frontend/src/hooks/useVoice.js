import { useState, useRef, useCallback } from 'react'

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript]   = useState('')
  const [seconds, setSeconds]         = useState(0)
  const [supported, setSupported]     = useState(
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )

  const recogRef  = useRef(null)
  const timerRef  = useRef(null)
  const fullRef   = useRef('')  // accumulates final results

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSupported(false); return }

    const recog = new SR()
    recog.lang            = 'vi-VN'
    recog.continuous      = true
    recog.interimResults  = true

    recog.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          fullRef.current += t + ' '
        } else {
          interim = t
        }
      }
      setTranscript(fullRef.current + interim)
    }

    recog.onerror = (e) => {
      console.error('Speech recognition error:', e.error)
    }

    recog.start()
    recogRef.current = recog
    setIsRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
  }, [])

  const stop = useCallback(() => {
    recogRef.current?.stop()
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const clear = useCallback(() => {
    fullRef.current = ''
    setTranscript('')
    setSeconds(0)
  }, [])

  const toggle = useCallback(() => {
    isRecording ? stop() : start()
  }, [isRecording, start, stop])

  return { isRecording, transcript, seconds, supported, toggle, start, stop, clear }
}
