import type { ChatMessage } from "@/App";

export function ChatPanel({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-3xl px-4 py-4 ${
            message.role === "assistant" ? "bg-white text-slate-900" : "bg-slate-900/70 text-slate-100 ring-1 ring-white/10"
          }`}
        >
          <div className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-400">{message.title}</div>
          <div className="space-y-2 text-sm leading-6">
            {message.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
