"use client";

import { useEffect, useState } from "react";
import { fetchForecast24h, fetchLoadBySpecialty, ForecastSummary, LoadSummary, Department } from "@/services/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { RiDashboard3Fill, RiPulseLine, RiArrowUpLine, RiErrorWarningLine } from "react-icons/ri";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AnalyticsPage() {
  const [forecast, setForecast] = useState<ForecastSummary | null>(null);
  const [loadData, setLoadData] = useState<LoadSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAllData() {
      try {
        const [fRes, lRes] = await Promise.all([
          fetchForecast24h().catch(() => null),
          fetchLoadBySpecialty().catch(() => null),
        ]);
        if (fRes) setForecast(fRes.data);
        if (lRes) setLoadData(lRes);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAllData();
    const interval = setInterval(loadAllData, 60000); // 1 phút refresh
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !forecast) {
    return (
      <div className="flex h-full items-center justify-center bg-white dark:bg-neutral-900 rounded-tl-3xl shadow-sm border-l border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-neutral-500 font-medium">Đang tải biểu đồ...</p>
        </div>
      </div>
    );
  }

  // Chế biến data cho Line Chart (Dự báo 24h)
  const forecastLabels = forecast?.forecast.map(f => f.hour) || [];
  const forecastDataPoints = forecast?.forecast.map(f => f.load_pct) || [];

  const lineChartData = {
    labels: forecastLabels,
    datasets: [
      {
        label: "Dự báo tải (%)",
        data: forecastDataPoints,
        borderColor: "rgb(16, 185, 129)", // emerald-500
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 120,
        grid: { color: "rgba(0,0,0,0.05)" },
      },
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 12 }
      }
    },
  };

  // Chế biến data cho Bar Chart (Load hiện tại)
  const sortedLoad = loadData?.data ? [...loadData.data].sort((a,b) => b.load_pct - a.load_pct).slice(0, 8) : [];
  const loadLabels = sortedLoad.map(d => d.specialty || d.department || "Unknown");
  const loadPoints = sortedLoad.map(d => d.load_pct);

  const barChartData = {
    labels: loadLabels,
    datasets: [
      {
        label: "Tải hiện tại (%)",
        data: loadPoints,
        backgroundColor: loadPoints.map(p => 
          p >= 100 ? "rgba(239, 68, 68, 0.8)" : 
          p >= 85 ? "rgba(249, 115, 22, 0.8)" : "rgba(59, 130, 246, 0.8)"
        ),
        borderRadius: 4,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, max: 120 },
    },
  };

  // Group loadData by parent specialty (Chuyên khoa lớn)
  const groupMapping = [
    { name: "Khám bệnh & Cấp cứu", keywords: ["Khám bệnh", "Cấp cứu", "Hồi sức", "Nhiễm khuẩn"] },
    { name: "Nội khoa", keywords: ["Nội ", "Nội", "Lão", "Thận nhân tạo"] },
    { name: "Ngoại khoa", keywords: ["Ngoại", "Phẫu thuật", "Bỏng", "Chấn thương"] },
    { name: "Sản - Nhi", keywords: ["Phụ sản", "Sản", "Nhi"] },
    { name: "Lâm sàng - Chuyên khoa", keywords: ["Mắt", "Tai mũi họng", "Răng", "Nhiệt đới", "Đông y", "Ung bướu", "Phục hồi", "Hạt nhân"] },
    { name: "Cận lâm sàng", keywords: ["Sinh hóa", "Huyết học", "Giải phẫu", "Vi", "Thăm dò", "Chẩn đoán", "Dược", "Dinh dưỡng"] },
  ];

  const groupedData: Record<string, Department[]> = {};
  if (loadData?.data) {
    loadData.data.forEach(dept => {
      const name = dept.specialty || dept.department || "Unknown";
      let category = "Chuyên khoa Khác";
      for (let m of groupMapping) {
        // Simple case-insensitive matching
        if (m.keywords.some(k => name.toLowerCase().includes(k.toLowerCase()))) {
          category = m.name;
          break;
        }
      }
      if (!groupedData[category]) groupedData[category] = [];
      groupedData[category].push(dept);
    });
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-900 rounded-tl-3xl shadow-sm border-l border-neutral-200 dark:border-neutral-800 overflow-y-auto relative pb-10">
      {/* Header */}
      <div className="h-16 flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-6 justify-between bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <RiDashboard3Fill size={18} />
          </div>
          <div>
            <h2 className="font-bold text-neutral-800 dark:text-neutral-100 leading-tight">Live Analytics</h2>
            <p className="text-[11px] text-neutral-500 font-medium tracking-wide">FlowPredict Monitoring</p>
          </div>
        </div>
        <div className="text-xs text-neutral-500 font-medium bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full">
          Cập nhật lúc: {forecast?.last_updated || new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 text-emerald-500"><RiPulseLine size={64}/></div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Tải trung bình</div>
            <div className="text-3xl font-black text-neutral-900 dark:text-white flex items-end gap-2">
              {loadData?.summary.avg_load_pct.toFixed(1) || "0"}%
              <span className="text-sm text-emerald-500 font-medium mb-1 shrink-0 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                Bình thường
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col gap-2 relative overflow-hidden">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Giờ cao điểm</div>
            <div className="text-3xl font-black text-neutral-900 dark:text-white flex items-end gap-2">
              {forecast?.peak_hour || "--:--"}
              <span className="text-sm text-rose-500 font-medium mb-1 shrink-0 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                <RiArrowUpLine /> {forecast?.peak_load_pct || "0"}%
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col gap-2 relative overflow-hidden">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Điểm nóng (Critical)</div>
            <div className="text-3xl font-black text-neutral-900 dark:text-white flex items-end gap-2">
              {loadData?.summary.critical_count || "0"} khoa
              {loadData?.summary && loadData.summary.critical_count > 0 && (
                <span className="text-sm text-red-500 font-medium mb-1 shrink-0 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <RiErrorWarningLine /> Quá tải
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col min-h-[350px]">
            <h3 className="font-bold text-neutral-800 dark:text-neutral-100 mb-4">Dự báo tải 24h</h3>
            <div className="flex-1 w-full relative">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm flex flex-col min-h-[350px]">
            <h3 className="font-bold text-neutral-800 dark:text-neutral-100 mb-4">Top khoa có cường độ tải cao nhất</h3>
            <div className="flex-1 w-full relative">
              <Bar data={barChartData} options={barChartOptions} />
            </div>
          </div>
        </div>

        {/* Cấu trúc Chuyên khoa Grid */}
        <div className="mt-4">
          <h3 className="font-bold text-lg text-neutral-800 dark:text-neutral-100 mb-4">Mật độ tải theo Nhóm Chuyên môn</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.keys(groupedData).map(category => (
              <div key={category} className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-neutral-100 dark:bg-neutral-900/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                  <span className="font-bold text-sm text-neutral-700 dark:text-neutral-200">{category}</span>
                  <span className="text-xs px-2 py-1 bg-white dark:bg-neutral-800 rounded shadow-sm text-neutral-500">{groupedData[category].length} khoa</span>
                </div>
                <div className="p-2 flex flex-col gap-1 max-h-[250px] overflow-y-auto">
                  {groupedData[category].sort((a,b) => b.load_pct - a.load_pct).map((dept, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-300">
                          {dept.specialty || dept.department}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          Đang chờ: {dept.current_patients}/{dept.capacity} ca — Tầng {dept.floor || '-'}
                        </span>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded
                        ${dept.load_pct >= 90 ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 
                          dept.load_pct >= 75 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' : 
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'}
                      `}>
                        {dept.load_pct}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
