/**
 * VoiceConversationOverlay
 * ─────────────────────────────────────────────────────────────────
 * Full-screen overlay kích hoạt khi vào chế độ voice realtime.
 * Giữ nguyên chat bên dưới — overlay chỉ hiện khi active.
 *
 * Thiết kế: "Medical dark glass" — nền tối trong suốt, orb xung quanh
 * sóng âm thanh, transcription live, trạng thái rõ ràng.
 */

import { useEffect, useRef, useMemo } from 'react'
import { X, Mic, Brain, Volume2, WifiOff } from 'lucide-react'
import { VS } from '../hooks/useConversationalVoice'

// ── Waveform canvas ────────────────────────────────────────────────
function WaveOrb({ amplitude, voiceState }) {
  const canvasRef = useRef(null)
  const frameRef  = useRef(null)
  const timeRef   = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = canvas.offsetWidth * devicePixelRatio
    const H = canvas.height = canvas.offsetHeight * devicePixelRatio
    const cx = W / 2, cy = H / 2
    const BASE_R = Math.min(W, H) * 0.28

    const COLORS = {
      [VS.IDLE]:      ['#334155', '#475569'],
      [VS.LISTENING]: ['#0ea5e9', '#38bdf8'],
      [VS.THINKING]:  ['#a855f7', '#c084fc'],
      [VS.SPEAKING]:  ['#14b8a6', '#2dd4bf'],
    }

    const draw = () => {
      timeRef.current += 0.04
      ctx.clearRect(0, 0, W, H)

      const [c1, c2] = COLORS[voiceState] || COLORS[VS.IDLE]
      const amp = amplitude / 100  // 0-1
      const pulse = voiceState === VS.IDLE ? 0 : (Math.sin(timeRef.current * 2) * 0.5 + 0.5) * amp

      // Outer glow rings
      const ringCount = voiceState === VS.SPEAKING ? 4 : 2
      for (let r = 0; r < ringCount; r++) {
        const ratio  = (r + 1) / ringCount
        const radius = BASE_R * (1 + ratio * 0.6 + pulse * ratio * 0.4)
        const alpha  = (1 - ratio) * 0.15 * (voiceState === VS.IDLE ? 0.3 : 1)
        const grad   = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grad.addColorStop(0, c1 + '00')
        grad.addColorStop(0.7, c1 + Math.round(alpha * 255).toString(16).padStart(2, '0'))
        grad.addColorStop(1, c1 + '00')
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // Animated wave path around orb (only when active)
      if (voiceState !== VS.IDLE) {
        const waveR  = BASE_R * (1 + pulse * 0.25)
        const waves  = voiceState === VS.SPEAKING ? 5 : 3
        const wAmp   = BASE_R * 0.06 * (1 + amp * 1.5)
        ctx.beginPath()
        for (let i = 0; i <= 360; i++) {
          const angle = (i * Math.PI) / 180
          const noise = Math.sin(angle * waves + timeRef.current * 3) * wAmp
                      + Math.sin(angle * (waves + 1) + timeRef.current * 2) * wAmp * 0.4
          const r = waveR + noise
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        const strokeGrad = ctx.createLinearGradient(cx - BASE_R, cy, cx + BASE_R, cy)
        strokeGrad.addColorStop(0, c1)
        strokeGrad.addColorStop(1, c2)
        ctx.strokeStyle = strokeGrad
        ctx.lineWidth   = 2.5 * devicePixelRatio
        ctx.globalAlpha = 0.7 + amp * 0.3
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Core orb
      const orbGrad = ctx.createRadialGradient(cx - BASE_R * 0.2, cy - BASE_R * 0.2, 0, cx, cy, BASE_R)
      orbGrad.addColorStop(0, c2)
      orbGrad.addColorStop(1, c1)
      ctx.beginPath()
      ctx.arc(cx, cy, BASE_R, 0, Math.PI * 2)
      ctx.fillStyle = orbGrad
      ctx.fill()

      frameRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [amplitude, voiceState])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
}

// ── Live transcript bar ────────────────────────────────────────────
function TranscriptBar({ text, voiceState }) {
  const placeholder = {
    [VS.LISTENING]: 'Đang lắng nghe...',
    [VS.THINKING]:  'AI đang suy nghĩ...',
    [VS.SPEAKING]:  'AI đang nói...',
    [VS.IDLE]:      '',
  }[voiceState] ?? ''

  return (
    <div className="min-h-[3.5rem] flex items-center justify-center px-6">
      {text ? (
        <p className="text-white/90 text-base text-center leading-relaxed max-w-lg font-light tracking-wide">
          {text}
        </p>
      ) : (
        <p className="text-white/30 text-sm text-center italic">{placeholder}</p>
      )}
    </div>
  )
}

// ── AI response scroller ───────────────────────────────────────────
function AIResponseBar({ text }) {
  if (!text) return null
  const clean = text
    .replace(/\[TRIAGE:\d\]/g, '')
    .replace(/\[DEPT:[^\]]+\]/g, '')
    .trim()
  return (
    <div className="max-w-lg mx-auto bg-white/10 backdrop-blur rounded-2xl px-5 py-3 border border-white/10">
      <p className="text-white/80 text-sm leading-relaxed line-clamp-4">{clean}</p>
    </div>
  )
}

// ── State badge ────────────────────────────────────────────────────
function StateBadge({ voiceState }) {
  const config = {
    [VS.LISTENING]: { icon: <Mic size={13} />,     label: 'Đang nghe',   color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
    [VS.THINKING]:  { icon: <Brain size={13} />,   label: 'Đang nghĩ',   color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    [VS.SPEAKING]:  { icon: <Volume2 size={13} />, label: 'Đang nói',    color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
    [VS.IDLE]:      { icon: null, label: '', color: '' },
  }[voiceState]

  if (!config?.label) return null
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      {config.label}
      {voiceState === VS.LISTENING && (
        <span className="flex gap-0.5 ml-0.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1 h-1 bg-sky-400 rounded-full"
              style={{ animation: `bounce 1s ${i * 0.15}s infinite` }}
            />
          ))}
        </span>
      )}
    </div>
  )
}

// ── Volume bars (mic indicator) ────────────────────────────────────
function VolumeBars({ amplitude, active }) {
  const BARS = 12
  return (
    <div className="flex items-end gap-0.5 h-6">
      {Array.from({ length: BARS }).map((_, i) => {
        const threshold = (i / BARS) * 100
        const lit = active && amplitude > threshold
        return (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-75"
            style={{
              height: `${20 + Math.sin((i / BARS) * Math.PI) * 60}%`,
              backgroundColor: lit ? '#38bdf8' : 'rgba(255,255,255,0.15)',
            }}
          />
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Main Overlay Component
// ════════════════════════════════════════════════════════════════════
export default function VoiceConversationOverlay({
  voiceState,
  liveTranscript,
  aiStreamText,
  amplitude,
  onClose,
}) {
  const isActive = voiceState !== VS.IDLE

  // Keyboard shortcut: Escape để đóng
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isActive) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: 'radial-gradient(ellipse at center top, #0c1a2e 0%, #060d18 60%, #000d1a 100%)',
        animation: 'fadeInOverlay 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-3px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="flex-none flex items-center justify-between px-6 pt-6 pb-2">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">MF</span>
          </div>
          <span className="text-white/60 text-sm font-medium">MediFlow · Voice Mode</span>
        </div>

        {/* State badge */}
        <StateBadge voiceState={voiceState} />

        {/* Close */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Spacer top ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">

        {/* ── Orb ── */}
        <div className="relative w-52 h-52 flex-none">
          <WaveOrb amplitude={amplitude} voiceState={voiceState} />
        </div>

        {/* ── User transcript (live STT) ── */}
        <div className="w-full max-w-lg">
          {voiceState === VS.LISTENING && (
            <TranscriptBar text={liveTranscript} voiceState={voiceState} />
          )}
          {(voiceState === VS.THINKING || voiceState === VS.SPEAKING) && (
            <div className="flex flex-col items-center gap-3">
              {liveTranscript && (
                <div className="text-white/40 text-xs text-center italic truncate max-w-xs">
                  "{liveTranscript}"
                </div>
              )}
              <AIResponseBar text={aiStreamText} />
            </div>
          )}
        </div>

        {/* ── Mic volume bars ── */}
        <div className="flex flex-col items-center gap-2">
          <VolumeBars amplitude={amplitude} active={voiceState === VS.LISTENING} />
          {voiceState === VS.LISTENING && (
            <p className="text-white/30 text-xs">
              {amplitude > 10 ? 'Đang nghe giọng bạn...' : 'Hãy nói để bắt đầu'}
            </p>
          )}
        </div>
      </div>

      {/* ── Bottom hint ── */}
      <div className="flex-none flex flex-col items-center gap-3 pb-8 pt-4 px-6">
        <div className="flex gap-6 text-white/25 text-xs">
          <span>Nói tự nhiên để trả lời</span>
          <span>·</span>
          <span>Ngắt lời AI bằng cách nói</span>
          <span>·</span>
          <span>Esc để thoát</span>
        </div>

        {/* End call button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 text-red-300 hover:text-red-200 text-sm font-medium transition-all"
        >
          <span className="w-2 h-2 rounded-full bg-red-400" />
          Kết thúc cuộc trò chuyện
        </button>
      </div>
    </div>
  )
}
