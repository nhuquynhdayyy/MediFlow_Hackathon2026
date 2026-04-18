import { useState, useRef, useCallback } from 'react'

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false)
  const [utterances, setUtterances] = useState([])
  const [seconds, setSeconds] = useState(0)
  const [supported] = useState(
    typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )

  const recognitionRef = useRef(null)
  const timerRef = useRef(null)
  const utterancesRef = useRef([])

  const start = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'vi-VN'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const finals = [...utterancesRef.current]
      let interimText = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript.trim()
        if (!text) continue

        if (event.results[index].isFinal) {
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

      utterancesRef.current = finals
      setUtterances(
        interimText ? [...finals, { id: 'interim', text: interimText, interim: true }] : finals
      )
    }

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') console.error('SR:', event.error)
    }
    recognition.onend = () => {
      if (recognitionRef.current) recognition.start()
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000)
  }, [])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const toggle = useCallback(() => {
    if (isRecording) stop()
    else start()
  }, [isRecording, start, stop])

  const clear = useCallback(() => {
    utterancesRef.current = []
    setUtterances([])
    setSeconds(0)
  }, [])

  const getFinals = useCallback(() => utterancesRef.current.filter((item) => !item.interim), [])

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
