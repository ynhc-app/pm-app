import React from "react";
import { getOrCreateDefaultProject } from "@/app/actions/rab";
import { getExpenseSummary } from "@/app/actions/expenses";
import { getSCurveData } from "@/app/actions/monitoring";

export default async function DashboardPage() {
  // Fetch real data from database
  const project = await getOrCreateDefaultProject();
  const expenseSummary = await getExpenseSummary();
  const sCurveData = await getSCurveData();

  // Calculate actual physical progress
  const lastLoggedWeek = sCurveData.filter(d => d.actual !== null).pop();
  const actualProgress = lastLoggedWeek?.actual || 0;
  
  // Calculate expenses percentage
  const totalRAB = Number(project.totalBudget);
  const totalExpense = expenseSummary.total;
  const expensePercentage = totalRAB > 0 ? (totalExpense / totalRAB) * 100 : 0;

  // Format currency
  const formatRp = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ringkasan proyek, anggaran, pengeluaran, dan progres fisik lapangan.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Proyek</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">1 Proyek</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">1 sedang berjalan</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Anggaran (RAB)</span>
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{formatRp(totalRAB)}</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Anggaran proyek aktif</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Pengeluaran</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatRp(totalExpense)}</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{expensePercentage.toFixed(1)}% dari total anggaran</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Progres Fisik</span>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{actualProgress.toFixed(1)}%</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Realisasi fisik di lapangan</p>
        </div>
      </div>

      {/* Detail Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Progres Konstruksi Aktif</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{project.name}</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{actualProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(actualProgress, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Alokasi Kategori Biaya</h3>
          <div className="mt-4 space-y-3">
            {expenseSummary.byCategory.length > 0 ? (
              expenseSummary.byCategory.map((cat) => (
                <div key={cat.category} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">{cat.category}</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {totalExpense > 0 ? ((cat.amount / totalExpense) * 100).toFixed(1) : "0"}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 italic">Belum ada pengeluaran</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
