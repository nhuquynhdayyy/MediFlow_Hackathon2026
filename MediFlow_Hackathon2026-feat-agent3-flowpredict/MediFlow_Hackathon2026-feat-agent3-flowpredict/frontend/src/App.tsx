import { useCallback, useEffect, useState } from "react";
import { FiActivity, FiClock, FiMap, FiTrendingUp } from "react-icons/fi";

import { ChatPanel } from "@/components/ChatPanel";
import { Header } from "@/components/Header";
import { TabButton } from "@/components/TabButton";
import { FlowPredictPage } from "@/pages/FlowPredictPage";
import { NavigatorPage } from "@/pages/NavigatorPage";
import { OperationsPage } from "@/pages/OperationsPage";

type TabId = "navigator" | "flow" | "operations";

const tabs: Array<{ id: TabId; label: string; icon: JSX.Element }> = [
  { id: "navigator", label: "Navigator", icon: <FiMap /> },
  { id: "flow", label: "FlowPredict", icon: <FiTrendingUp /> },
  { id: "operations", label: "Now vs Later", icon: <FiClock /> },
];

export interface ChatMessage {
  id: string;
  role: "assistant" | "system";
  title: string;
  lines: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("navigator");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([
      {
        id: "boot",
        role: "system",
        title: "Navigator AI online",
        lines: [
          "Decision engine is running with deterministic routing and overload awareness.",
          "Use the tabs to compare routes, predicted load, and hospital actions.",
        ],
      },
    ]);
  }, []);

  const pushMessage = useCallback((message: Omit<ChatMessage, "id">) => {
    setMessages((current) => [
      { ...message, id: `${Date.now()}-${current.length}` },
      ...current.slice(0, 5),
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(35,83,166,0.22),_transparent_30%),linear-gradient(180deg,_#eef6ff_0%,_#d7e7f8_45%,_#f6fbff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1560px] flex-col gap-6 px-4 py-4 md:px-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Header />
          <div className="rounded-[32px] border border-white/50 bg-white/60 p-3 shadow-[0_25px_80px_rgba(20,52,100,0.15)] backdrop-blur-xl">
            <div className="mb-4 flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  active={activeTab === tab.id}
                  icon={tab.icon}
                  label={tab.label}
                  onClick={() => setActiveTab(tab.id)}
                />
              ))}
            </div>

            {activeTab === "navigator" && <NavigatorPage pushMessage={pushMessage} />}
            {activeTab === "flow" && <FlowPredictPage pushMessage={pushMessage} />}
            {activeTab === "operations" && <OperationsPage pushMessage={pushMessage} />}
          </div>
        </div>

        <aside className="w-full lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[380px]">
          <div className="flex h-full flex-col rounded-[32px] border border-slate-200/60 bg-slate-950 px-5 py-5 text-white shadow-[0_25px_60px_rgba(15,23,42,0.45)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">AI Explainer</p>
                <h2 className="mt-1 text-2xl font-semibold">Operations Chat</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
                <FiActivity size={18} />
              </div>
            </div>
            <ChatPanel messages={messages} />
          </div>
        </aside>
      </div>
    </div>
  );
}
