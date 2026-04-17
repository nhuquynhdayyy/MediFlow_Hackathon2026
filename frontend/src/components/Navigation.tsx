"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiRobot2Line, RiDashboard3Line, RiHospitalLine } from "react-icons/ri";

export default function Navigation() {
  const pathname = usePathname();

  const tabs = [
    {
      name: "Patient Navigator",
      path: "/triage",
      icon: <RiRobot2Line size={22} />,
      desc: "Luồng AI hướng dẫn bệnh nhân",
      color: "from-blue-500 to-cyan-400",
      activeBg: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
    {
      name: "Hospital Admin",
      path: "/admin",
      icon: <RiHospitalLine size={22} />,
      desc: "Luồng AI điều phối bệnh viện",
      color: "from-purple-500 to-pink-500",
      activeBg: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    },
    {
      name: "Analytics",
      path: "/analytics",
      icon: <RiDashboard3Line size={22} />,
      desc: "Giám sát tải realtime",
      color: "from-emerald-400 to-teal-500",
      activeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
  ];

  return (
    <nav className="w-full lg:w-72 flex-shrink-0 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-r border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-8 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
          <RiHospitalLine size={24} />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight text-neutral-900 dark:text-white">MediFlow UI</h1>
          <p className="text-xs text-neutral-500 font-medium">FlowPredict Navigator</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-2 mb-1">
          AI Agents
        </div>
        
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`
                relative group flex flex-col gap-1 p-3 rounded-2xl transition-all duration-300
                ${isActive 
                  ? `${tab.activeBg} shadow-sm ring-1 ring-black/5 dark:ring-white/10` 
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400"}
              `}
            >
              {isActive && (
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1/2 rounded-r-lg bg-gradient-to-b ${tab.color}`} />
              )}
              
              <div className="flex items-center gap-3">
                <div className={`
                  transition-transform duration-300 group-hover:scale-110 
                  ${isActive ? "" : "opacity-70 group-hover:opacity-100"}
                `}>
                  {tab.icon}
                </div>
                <span className="font-semibold">{tab.name}</span>
              </div>
              
              <p className={`text-xs pl-8 transition-opacity duration-300 ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                {tab.desc}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto px-2">
        <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
          <h4 className="text-sm font-semibold mb-1 dark:text-neutral-200">System Status</h4>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-neutral-500 font-medium">All APIs Online</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
