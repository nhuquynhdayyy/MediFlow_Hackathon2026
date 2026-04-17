import { useState, useRef, useCallback } from 'react'

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false)
  const [utterances, setUtterances] = useState([])
  const [seconds, setSeconds] = useState(0)
  const [supported] = useState(
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )

  const recogRef = useRef(null)
  const timerRef = useRef(null)
  const uttsRef = useRef([])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const recog = new SR()
    recog.lang = 'vi-VN'
    recog.continuous = true
    recog.interimResults = true

    recog.onresult = (e) => {
      const finals = [...uttsRef.current]
      let interimText = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim()
        if (!text) continue

        if (e.results[i].isFinal) {
          finals.push({
            id: `u-${Date.now()}-${Math.random()}`,
            text,
            time: new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          })
        } else {
          interimText = text
        }
      }

      uttsRef.current = finals
      setUtterances(
        interimText
          ? [...finals, { id: 'interim', text: interimText, interim: true }]
          : finals
      )
    }

    recog.onerror = (e) => {
      if (e.error !== 'no-speech') console.error('SR:', e.error)
    }
    recog.onend = () => {
      if (recogRef.current) recog.start()
    }

    recog.start()
    recogRef.current = recog
    setIsRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
  }, [])

  const stop = useCallback(() => {
    if (recogRef.current) {
      recogRef.current.onend = null
      recogRef.current.stop()
      recogRef.current = null
    }
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const toggle = useCallback(() => {
    isRecording ? stop() : start()
  }, [isRecording, start, stop])

  const clear = useCallback(() => {
    uttsRef.current = []
    setUtterances([])
    setSeconds(0)
  }, [])

  const getFinals = useCallback(() => uttsRef.current.filter(u => !u.interim), [])

  return {
    isRecording,
    utterances,
    seconds,
    supported,
    toggle,
    start,
    stop,
    clear,
    getFinals,
  }
}
