"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  getSCurveData,
  getLoggedWeeks,
  getRabItemsForProgress,
  saveWeeklyProgress,
  SCurveDataPoint,
  RabItemForProgress,
} from "@/app/actions/monitoring";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function MonitoringPage() {
  const { isAdmin } = useAuth();
  const [sCurveData, setSCurveData] = useState<SCurveDataPoint[]>([]);
  const [loggedWeeks, setLoggedWeeks] = useState<number[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  // Form State
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [logDate, setLogDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [rabItems, setRabItems] = useState<RabItemForProgress[]>([]);
  const [progressInputs, setProgressInputs] = useState<Record<string, number>>({});
  const [loadingForm, setLoadingForm] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const fetchChartData = useCallback(async () => {
    setLoadingChart(true);
    try {
      const data = await getSCurveData();
      setSCurveData(data);
      const weeks = await getLoggedWeeks();
      setLoggedWeeks(weeks);
      
      // Auto-select the next week to log if we haven't selected one
      if (weeks.length > 0 && selectedWeek === 1) {
        setSelectedWeek(Math.max(...weeks) + 1);
      }
    } catch (err) {
      console.error("Failed to load S-Curve data:", err);
    } finally {
      setLoadingChart(false);
    }
  }, [selectedWeek]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const fetchFormData = useCallback(async (week: number) => {
    setLoadingForm(true);
    setFormError(null);
    setFormSuccess(false);
    try {
      const items = await getRabItemsForProgress(week);
      setRabItems(items);
      const initialInputs: Record<string, number> = {};
      items.forEach((item) => {
        initialInputs[item.id] = item.currentProgress;
      });
      setProgressInputs(initialInputs);
    } catch (err) {
      console.error("Failed to load RAB items for progress:", err);
      setFormError("Gagal memuat daftar item RAB.");
    } finally {
      setLoadingForm(false);
    }
  }, []);

  useEffect(() => {
    fetchFormData(selectedWeek);
  }, [selectedWeek, fetchFormData]);

  const handleProgressChange = (id: string, value: string) => {
    let num = parseFloat(value);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setProgressInputs((prev) => ({ ...prev, [id]: num }));
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingForm(true);
    setFormError(null);
    setFormSuccess(false);

    try {
      const entries = Object.entries(progressInputs).map(
        ([rabItemId, progressPercentage]) => ({
          rabItemId,
          progressPercentage,
        })
      );
      await saveWeeklyProgress(selectedWeek, logDate, entries);
      setFormSuccess(true);
      await fetchChartData(); // Refresh chart after saving
    } catch (err) {
      console.error(err);
      setFormError("Gagal menyimpan progres fisik.");
    } finally {
      setSavingForm(false);
      setTimeout(() => setFormSuccess(false), 3000);
    }
  };

  // Custom Tooltip for Recharts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-zinc-200 p-3 rounded-lg shadow-xl text-sm dark:bg-zinc-900/95 dark:border-zinc-800">
          <p className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-zinc-600 dark:text-zinc-400 capitalize">{entry.name}:</span>
              <span className="font-semibold font-mono text-zinc-900 dark:text-zinc-50">
                {entry.value !== null ? `${entry.value}%` : "N/A"}
              </span>
            </div>
          ))}
          {/* Deviation Calculation */}
          {payload.some((p: any) => p.dataKey === 'actual') && payload.some((p: any) => p.dataKey === 'planned') && (
            <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
               <div className="flex items-center gap-2">
                 <span className="text-zinc-600 dark:text-zinc-400">Deviasi (Fisik - Rencana):</span>
                 {(() => {
                    const actualP = payload.find((p:any) => p.dataKey === 'actual');
                    const plannedP = payload.find((p:any) => p.dataKey === 'planned');
                    if (actualP?.value != null && plannedP?.value != null) {
                      const dev = (actualP.value - plannedP.value).toFixed(2);
                      const isNeg = parseFloat(dev) < 0;
                      return (
                        <span className={`font-semibold font-mono ${isNeg ? "text-rose-600" : "text-emerald-600"}`}>
                          {parseFloat(dev) > 0 ? "+" : ""}{dev}%
                        </span>
                      )
                    }
                    return <span className="font-mono">-</span>;
                 })()}
               </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const currentDeviation = useMemo(() => {
     if (!sCurveData.length) return null;
     // Find last valid actual data point
     const validPoints = sCurveData.filter(d => d.actual !== null);
     if (!validPoints.length) return null;
     
     const lastPoint = validPoints[validPoints.length - 1];
     if (lastPoint.actual === null) return null;
     
     return (lastPoint.actual - lastPoint.planned).toFixed(2);
  }, [sCurveData]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Monitoring & Kurva-S
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Visualisasi grafik perbandingan kemajuan target rencana, realisasi fisik lapangan, dan serapan biaya.
        </p>
      </div>

      {/* S-Curve Chart Section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 mb-6 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Grafik Kurva-S Proyek</h3>
          </div>
          
          {currentDeviation !== null && (
            <div className="mt-2 sm:mt-0 flex items-center gap-2 text-sm bg-zinc-50 px-3 py-1.5 rounded-lg dark:bg-zinc-900/50">
              <span className="text-zinc-500 dark:text-zinc-400">Deviasi Saat Ini:</span>
              <span className={`font-semibold font-mono ${parseFloat(currentDeviation) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {parseFloat(currentDeviation) > 0 ? "+" : ""}{currentDeviation}%
              </span>
            </div>
          )}
        </div>

        <div className="h-[400px] w-full">
          {loadingChart ? (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Memuat grafik Kurva-S...</p>
            </div>
          ) : sCurveData.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center border border-dashed border-zinc-200 rounded-lg bg-zinc-50 dark:bg-zinc-900/30 dark:border-zinc-800">
              <p className="text-sm text-zinc-500">Belum ada data untuk ditampilkan. Pastikan RAB sudah dibuat.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sCurveData}
                margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" className="dark:stroke-zinc-800" />
                <XAxis 
                  dataKey="weekLabel" 
                  tick={{ fontSize: 12, fill: '#71717a' }} 
                  axisLine={{ stroke: '#e4e4e7' }}
                  tickLine={false}
                  dy={10}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 12, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                
                {/* Reference Line for 100% */}
                <ReferenceLine y={100} stroke="#e4e4e7" strokeDasharray="3 3" className="dark:stroke-zinc-800" />

                <Line
                  name="Rencana (Planned)"
                  type="monotone"
                  dataKey="planned"
                  stroke="#a1a1aa" // zinc-400
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#a1a1aa" }}
                />
                <Line
                  name="Realisasi Fisik (Actual)"
                  type="monotone"
                  dataKey="actual"
                  stroke="#2563eb" // blue-600
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#2563eb" }}
                  connectNulls={true}
                />
                <Line
                  name="Serapan Biaya (Cost)"
                  type="monotone"
                  dataKey="cost"
                  stroke="#16a34a" // emerald-600
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 1, fill: "#fff" }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#16a34a" }}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Input Progress Form */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Input Progres Fisik Mingguan
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Catat persentase penyelesaian fisik untuk setiap item RAB pada minggu berjalan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Minggu Ke-</label>
              <input
                type="number"
                min="1"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value) || 1)}
                className="w-20 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Tanggal</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          {!isAdmin && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
              <Lock className="h-4 w-4 shrink-0" />
              <p>Anda sedang dalam <strong>Mode Akun Umum (Lihat Saja)</strong>. Untuk menginput atau memperbarui progres fisik mingguan, silakan masuk sebagai <strong>Admin</strong>.</p>
            </div>
          )}

          {formError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{formError}</p>
            </div>
          )}
          
          {formSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>Progres minggu ke-{selectedWeek} berhasil disimpan!</p>
            </div>
          )}

          {loadingForm ? (
             <div className="flex items-center justify-center py-10 gap-2 text-zinc-500">
               <Loader2 className="h-5 w-5 animate-spin" />
               <span className="text-sm">Memuat item RAB...</span>
             </div>
          ) : rabItems.length === 0 ? (
            <div className="text-center py-10 text-sm text-zinc-500">
              Belum ada item RAB yang bisa diisi progresnya (pastikan RAB Induk memiliki sub-item dengan bobot).
            </div>
          ) : (
            <form onSubmit={handleSaveProgress}>
              <div className="overflow-x-auto border border-zinc-200 rounded-lg dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="p-3 font-semibold w-24">Kode</th>
                      <th className="p-3 font-semibold">Deskripsi Pekerjaan</th>
                      <th className="p-3 font-semibold w-28 text-right">Bobot (%)</th>
                      <th className="p-3 font-semibold w-40 text-right">Progres Selesai (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rabItems.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                        <td className="p-3 font-mono text-xs text-zinc-500">{item.itemCode}</td>
                        <td className="p-3 font-medium text-zinc-900 dark:text-zinc-50">{item.description}</td>
                        <td className="p-3 text-right text-blue-600 dark:text-blue-400 font-mono text-xs">
                          {item.weightPercentage.toFixed(2)}%
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin ? (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={progressInputs[item.id] !== undefined ? progressInputs[item.id] : ""}
                                  onChange={(e) => handleProgressChange(item.id, e.target.value)}
                                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm text-right focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                                  placeholder="0"
                                />
                                <span className="text-zinc-400 font-medium">%</span>
                              </>
                            ) : (
                              <span className="font-mono text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                {progressInputs[item.id] !== undefined ? progressInputs[item.id] : 0}%
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {isAdmin && (
                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    {savingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan Progres Minggu Ke-{selectedWeek}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
