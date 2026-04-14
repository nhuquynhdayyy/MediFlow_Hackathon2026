"use client";

import { useEffect, useState } from "react";
import { fetchLoadBySpecialty, fetchForecast24h, postAlertCheck, AlertResult, Department } from "@/services/api";
import { RiAlertFill, RiCheckDoubleFill, RiRadarLine, RiHospitalLine, RiErrorWarningFill } from "react-icons/ri";

export default function AdminPage() {
  const [alert, setAlert] = useState<AlertResult | null>(null);
  const [criticalDepts, setCriticalDepts] = useState<Department[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    
    async function runAutoMonitor() {
      if (!mounted) return;
      setIsRefreshing(true);
      
      try {
        const [loadRes, forecastRes] = await Promise.all([
          fetchLoadBySpecialty().catch(() => null),
          fetchForecast24h().catch(() => null)
        ]);
        
        if (loadRes && loadRes.data) {
          // Lọc các khoa có tải trọng trên 75% để hiển thị nóng
          const hotDepts = loadRes.data.filter(d => d.load_pct >= 75).sort((a,b) => b.load_pct - a.load_pct);
          setCriticalDepts(hotDepts);
          
          if (forecastRes && forecastRes.data) {
            const aiAlertRes = await postAlertCheck({
              load_by_specialty: loadRes.data,
              forecast: forecastRes.data.forecast
            });
            
            if (aiAlertRes?.data && mounted) {
              setAlert(aiAlertRes.data);
              setLastUpdated(new Date().toLocaleTimeString());
            }
          }
        }
      } catch (err) {
        console.error("Lỗi khi chạy AI Monitor", err);
      } finally {
        if (mounted) setIsRefreshing(false);
      }
    }

    runAutoMonitor();
    
    // Tự động quét lại trạng thái bệnh viện định kỳ (vd: mỗi 1 phút)
    const interval = setInterval(runAutoMonitor, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const hasCrit = alert && alert.critical_count > 0;
  const hasWarn = alert && alert.warning_count > 0;

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 rounded-tl-3xl shadow-sm border-l border-neutral-200 dark:border-neutral-800 relative">
      {/* Header */}
      <div className={`h-16 flex-shrink-0 border-b flex items-center px-6 justify-between transition-colors duration-500
        ${hasCrit 
          ? "bg-red-50/80 border-red-200 dark:bg-red-900/20 dark:border-red-900/50" 
          : "bg-white/50 border-neutral-100 dark:bg-neutral-900/50 dark:border-neutral-800"} backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white
              ${hasCrit ? "bg-red-600 shadow-lg shadow-red-500/40" : "bg-purple-600 shadow-md"}
            `}>
              <RiRadarLine size={18} className={isRefreshing ? "animate-spin" : ""} />
            </div>
            {isRefreshing && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
              </span>
            )}
          </div>
          <div>
            <h2 className={`font-bold leading-tight ${hasCrit ? "text-red-900 dark:text-red-100" : "text-neutral-800 dark:text-neutral-100"}`}>
              Lưới An ninh Điều phối AI
            </h2>
            <p className="text-[11px] font-medium text-neutral-500">Tự động scan hệ thống & phát hiện tắc nghẽn</p>
          </div>
        </div>
        <div className="text-xs text-neutral-500 font-medium hidden sm:block">
          Cập nhật gần nhất: {lastUpdated || "Đang quét..."}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        
        {!alert && isRefreshing ? (
           <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-4">
             <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
             <p className="font-medium animate-pulse">AI đang phân tích luồng bệnh nhân thời gian thực...</p>
           </div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            
            {/* AI ALERT BOX */}
            <div className={`rounded-2xl border p-6 shadow-sm relative overflow-hidden transition-all duration-300
              ${hasCrit 
                  ? "bg-gradient-to-br from-red-50 to-white border-red-200 dark:from-red-950 dark:to-neutral-900 dark:border-red-900" 
                  : hasWarn
                    ? "bg-gradient-to-br from-orange-50 to-white border-orange-200 dark:from-orange-950 dark:to-neutral-900 dark:border-orange-900"
                    : "bg-white border-emerald-100 dark:bg-neutral-900 dark:border-emerald-900/50"
              }
            `}>
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                {hasCrit ? <RiAlertFill size={100} className="text-red-600" /> : <RiHospitalLine size={100} className="text-emerald-500" />}
              </div>
              
              <div className="flex gap-4">
                <div className="mt-1">
                  {hasCrit ? (
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-800">
                      <RiErrorWarningFill size={24} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                      <RiCheckDoubleFill size={24} />
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">
                    Trạng thái Hệ thống
                  </div>
                  <h3 className={`text-xl font-bold mb-4 ${hasCrit ? 'text-red-800 dark:text-red-300' : 'text-neutral-900 dark:text-neutral-100'}`}>
                    {alert?.alert || "Hệ thống vận hành trơn tru, không phát hiện rủi ro quá tải."}
                  </h3>
                  
                  {alert?.recommendations && alert.recommendations.length > 0 && (
                    <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4 border border-white/50 dark:border-white/5 backdrop-blur-md">
                      <h4 className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-widest mb-3">AI Đề xuất Kế hoạch Hành động</h4>
                      <ul className="flex flex-col gap-2.5">
                        {alert.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 text-sm text-neutral-800 dark:text-neutral-200 font-medium">
                            <span className="text-purple-600 mt-0.5"><RiCheckDoubleFill size={18}/></span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {alert?.source && (
                    <div className="mt-3 text-[10px] text-neutral-400 font-medium uppercase tracking-wider text-right">
                      Phân tích bởi: {alert.source}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* HOT ZONES GRID */}
            {criticalDepts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">
                  Các Điểm Nóng Hiện Tại (Tải &gt; 75%)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {criticalDepts.map((dept, i) => {
                    const isCrit = dept.load_pct >= 90;
                    return (
                      <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2
                        ${isCrit 
                          ? "bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30" 
                          : "bg-orange-50/50 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30"}
                      `}>
                        <div className="flex justify-between items-start">
                          <span className={`font-bold ${isCrit ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>
                            {dept.specialty}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-md font-bold text-white
                             ${isCrit ? "bg-red-500" : "bg-orange-500"}
                          `}>
                            {dept.load_pct}%
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                          <div>Ca chờ: <span className="font-bold text-neutral-900 dark:text-neutral-100">{dept.current_patients}/{dept.capacity}</span></div>
                          <div>Chờ ~ <span className="font-bold text-neutral-900 dark:text-neutral-100">{dept.wait_time}&apos;</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
}
