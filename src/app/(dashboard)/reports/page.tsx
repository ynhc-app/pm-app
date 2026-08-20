"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { getFullReportData } from "@/app/actions/reports";
import {
  FileSpreadsheet,
  Printer,
  Loader2,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Calendar,
  Building2,
  Layers,
  X,
  Download,
} from "lucide-react";

function formatRp(val: number): string {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

export default function ReportsPage() {
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    title: string;
    type: "variance" | "expenses" | "scurve" | "rab";
    data: any;
  } | null>(null);

  // ── 1. Export Excel Handler ──────────────────────────────────────────────
  const handleExportExcel = async (reportType: "variance" | "expenses" | "scurve" | "rab") => {
    setLoadingType(`excel-${reportType}`);
    try {
      const { project, rabItems, expenses, variances, scurve } = await getFullReportData();
      const wb = XLSX.utils.book_new();

      if (reportType === "variance") {
        const rows = variances.map((v, i) => ({
          No: i + 1,
          "Kode Item": v.rabItemCode,
          "Uraian Pekerjaan": v.rabItemDescription,
          Satuan: v.rabItemUnit || "-",
          "Anggaran Biaya (Rp)": v.budgetAmount,
          "Realisasi Pengeluaran (Rp)": v.spentAmount,
          "Sisa Anggaran (Rp)": v.remainingAmount,
          "% Realisasi": `${v.costVariancePercent.toFixed(2)}%`,
          Status: v.isOverBudget ? "OVERRUN (Over Budget)" : "NORMAL / AMAN",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Varian Biaya");
        XLSX.writeFile(wb, `Laporan_Varian_Biaya_${project.name.replace(/\s+/g, "_")}.xlsx`);
      } else if (reportType === "expenses") {
        const rows = expenses.map((e, i) => ({
          No: i + 1,
          Tanggal: new Date(e.transactionDate).toLocaleDateString("id-ID"),
          Kategori: e.category,
          "Supplier / Vendor / Uraian": e.vendorName,
          "Item RAB Terkait": e.rabItemDescription || "Pengeluaran Umum Proyek",
          Volume: e.volume ?? "",
          Satuan: e.unit ?? "",
          "Harga Satuan (Rp)": e.unitPrice ?? "",
          "Total Nominal (Rp)": e.amount,
          Catatan: e.notes || "-",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Pengeluaran");
        XLSX.writeFile(wb, `Rekap_Pengeluaran_${project.name.replace(/\s+/g, "_")}.xlsx`);
      } else if (reportType === "rab") {
        const rows = rabItems.map((item, i) => ({
          No: i + 1,
          "Kode Item": item.itemCode,
          "Uraian Pekerjaan": item.description,
          Satuan: item.unit,
          Volume: item.volume,
          "Harga Satuan (Rp)": item.unitPrice,
          "Total Anggaran (Rp)": item.totalPrice,
          "Bobot (%)": `${item.weightPercentage.toFixed(3)}%`,
          "Subtotal Material (Rp)": item.materialSubtotal,
          "Subtotal Upah (Rp)": item.laborSubtotal,
          "Subtotal Alat (Rp)": item.equipmentSubtotal,
          "Subtotal Overhead (Rp)": item.overheadSubtotal,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Master RAB");
        XLSX.writeFile(wb, `Master_RAB_AHSP_${project.name.replace(/\s+/g, "_")}.xlsx`);
      } else if (reportType === "scurve") {
        const rows = scurve.map((s) => ({
          Minggu: s.week,
          Periode: s.weekLabel,
          "Rencana Kumulatif (%)": `${s.planned.toFixed(2)}%`,
          "Realisasi Fisik Kumulatif (%)": s.actual !== null ? `${s.actual.toFixed(2)}%` : "-",
          "Realisasi Biaya Kumulatif (%)": s.cost !== null ? `${s.cost.toFixed(2)}%` : "-",
          "Deviasi Fisik (%)": s.actual !== null ? `${(s.actual - s.planned).toFixed(2)}%` : "-",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Kurva S Progres");
        XLSX.writeFile(wb, `Laporan_Kurva_S_${project.name.replace(/\s+/g, "_")}.xlsx`);
      }
    } catch (err) {
      console.error(err);
      alert("Gagal mengunduh file Excel. Pastikan koneksi server aktif.");
    } finally {
      setLoadingType(null);
    }
  };

  // ── 2. Open PDF / Print Preview Modal ─────────────────────────────────────
  const handleOpenPrintPreview = async (
    title: string,
    type: "variance" | "expenses" | "scurve" | "rab"
  ) => {
    setLoadingType(`pdf-${type}`);
    try {
      const data = await getFullReportData();
      setPreviewModal({
        title,
        type,
        data,
      });
    } catch (err) {
      console.error(err);
      alert("Gagal memuat data laporan.");
    } finally {
      setLoadingType(null);
    }
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  const reportCards = [
    {
      id: "variance" as const,
      title: "Laporan Varian Biaya (Cost Variance)",
      description:
        "Analisis komparatif antara anggaran RAB induk dan realisasi pengeluaran riil untuk mendeteksi selisih anggaran (overrun/underrun).",
      format: "Excel / PDF",
      updated: "Real-time",
      icon: TrendingDown,
      color: "text-amber-600 dark:text-amber-400",
      bgLight: "bg-amber-50 dark:bg-amber-950/20",
    },
    {
      id: "expenses" as const,
      title: "Rekapitulasi Pengeluaran & Transaksi",
      description:
        "Daftar lengkap seluruh transaksi pembelanjaan Material, Upah Tukang, Peralatan, dan Overhead beserta vendor dan bukti.",
      format: "Excel / PDF",
      updated: "Real-time",
      icon: DollarSign,
      color: "text-blue-600 dark:text-blue-400",
      bgLight: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      id: "rab" as const,
      title: "Laporan Master RAB & Komponen AHSP",
      description:
        "Struktur lengkap Bill of Quantities (BoQ) beserta breakdown rincian komponen Material, Upah, Alat, dan Overhead tiap item.",
      format: "Excel / PDF",
      updated: "Real-time",
      icon: Layers,
      color: "text-purple-600 dark:text-purple-400",
      bgLight: "bg-purple-50 dark:bg-purple-950/20",
    },
    {
      id: "scurve" as const,
      title: "Laporan Kemajuan Progres Fisik (Kurva-S)",
      description:
        "Rekapitulasi mingguan kemajuan fisik konstruksi lengkap dengan perbandingan rencana kumulatif vs realisasi aktual.",
      format: "Excel / PDF",
      updated: "Setiap Minggu",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Laporan &amp; Unduhan
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ekspor dokumen resmi dan analisis kemajuan serta keuangan proyek konstruksi ke format Excel dan PDF.
        </p>
      </div>

      {/* Reports Listing Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {reportCards.map((report) => {
          const CardIcon = report.icon;
          const isExcelLoading = loadingType === `excel-${report.id}`;
          const isPdfLoading = loadingType === `pdf-${report.id}`;

          return (
            <div
              key={report.id}
              className="flex flex-col justify-between p-6 rounded-2xl border border-zinc-200 bg-white hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${report.bgLight} ${report.color}`}>
                    <CardIcon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {report.title}
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {report.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between dark:border-zinc-800">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Format: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{report.format}</span> • {report.updated}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenPrintPreview(report.title, report.id)}
                    disabled={isPdfLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {isPdfLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5 text-zinc-600" />
                    )}
                    Cetak / PDF
                  </button>
                  <button
                    onClick={() => handleExportExcel(report.id)}
                    disabled={isExcelLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {isExcelLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    Unduh Excel
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Print & PDF Preview ─────────────────────────────────────── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850">
              <div className="flex items-center gap-2.5">
                <Printer className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {previewModal.title}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Proyek: {previewModal.data.project.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak / Simpan PDF
                </button>
                <button
                  onClick={() => setPreviewModal(null)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 print:p-0">
              {/* Document Letterhead (Kop Surat) */}
              <div className="border-b-2 border-zinc-900 pb-4 text-center space-y-1">
                <h2 className="text-xl font-black uppercase tracking-wider">
                  {previewModal.title}
                </h2>
                <p className="text-sm font-semibold text-zinc-700">
                  {previewModal.data.project.name} • {previewModal.data.project.clientName}
                </p>
                <p className="text-xs text-zinc-500">
                  Dicetak pada: {new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}
                </p>
              </div>

              {/* Table Data based on Type */}
              {previewModal.type === "variance" && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-100 text-zinc-700 font-bold">
                      <th className="p-2 text-left">Kode</th>
                      <th className="p-2 text-left">Uraian Pekerjaan</th>
                      <th className="p-2 text-right">Anggaran RAB</th>
                      <th className="p-2 text-right">Realisasi</th>
                      <th className="p-2 text-right">Sisa Anggaran</th>
                      <th className="p-2 text-center">% Realisasi</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {previewModal.data.variances.map((v: any) => (
                      <tr key={v.rabItemId}>
                        <td className="p-2 font-mono">{v.rabItemCode}</td>
                        <td className="p-2 font-medium">{v.rabItemDescription}</td>
                        <td className="p-2 text-right font-mono">{formatRp(v.budgetAmount)}</td>
                        <td className="p-2 text-right font-mono">{formatRp(v.spentAmount)}</td>
                        <td className="p-2 text-right font-mono font-semibold">{formatRp(v.remainingAmount)}</td>
                        <td className="p-2 text-center font-mono">{v.costVariancePercent.toFixed(1)}%</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${v.isOverBudget ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {v.isOverBudget ? "OVERRUN" : "AMAN"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {previewModal.type === "expenses" && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-100 text-zinc-700 font-bold">
                      <th className="p-2 text-left">Tanggal</th>
                      <th className="p-2 text-left">Kategori</th>
                      <th className="p-2 text-left">Vendor / Uraian</th>
                      <th className="p-2 text-left">Item RAB Terkait</th>
                      <th className="p-2 text-right">Volume</th>
                      <th className="p-2 text-right">Total Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {previewModal.data.expenses.map((e: any) => (
                      <tr key={e.id}>
                        <td className="p-2 font-mono">{new Date(e.transactionDate).toLocaleDateString("id-ID")}</td>
                        <td className="p-2 font-semibold">{e.category}</td>
                        <td className="p-2">{e.vendorName}</td>
                        <td className="p-2 text-zinc-600">{e.rabItemDescription || "-"}</td>
                        <td className="p-2 text-right font-mono">{e.volume ? `${e.volume} ${e.unit || ""}` : "-"}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatRp(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {previewModal.type === "rab" && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-100 text-zinc-700 font-bold">
                      <th className="p-2 text-left">Kode</th>
                      <th className="p-2 text-left">Uraian Pekerjaan</th>
                      <th className="p-2 text-center">Satuan</th>
                      <th className="p-2 text-right">Volume</th>
                      <th className="p-2 text-right">Harga Satuan</th>
                      <th className="p-2 text-right">Total Anggaran</th>
                      <th className="p-2 text-right">Bobot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {previewModal.data.rabItems.map((item: any) => (
                      <tr key={item.id}>
                        <td className="p-2 font-mono">{item.itemCode}</td>
                        <td className="p-2 font-medium">{item.description}</td>
                        <td className="p-2 text-center">{item.unit || "-"}</td>
                        <td className="p-2 text-right font-mono">{item.volume > 0 ? item.volume : ""}</td>
                        <td className="p-2 text-right font-mono">{item.unitPrice > 0 ? formatRp(item.unitPrice) : ""}</td>
                        <td className="p-2 text-right font-mono font-bold">{formatRp(item.totalPrice)}</td>
                        <td className="p-2 text-right font-mono">{item.weightPercentage.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {previewModal.type === "scurve" && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-100 text-zinc-700 font-bold">
                      <th className="p-2 text-center">Minggu</th>
                      <th className="p-2 text-left">Periode</th>
                      <th className="p-2 text-right">Rencana Kumulatif (%)</th>
                      <th className="p-2 text-right">Realisasi Fisik Kumulatif (%)</th>
                      <th className="p-2 text-right">Deviasi Progres (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {previewModal.data.scurve.map((s: any) => (
                      <tr key={s.week}>
                        <td className="p-2 text-center font-mono font-bold">{s.week}</td>
                        <td className="p-2">{s.weekLabel}</td>
                        <td className="p-2 text-right font-mono">{s.planned.toFixed(2)}%</td>
                        <td className="p-2 text-right font-mono font-semibold">
                          {s.actual !== null ? `${s.actual.toFixed(2)}%` : "-"}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {s.actual !== null ? (
                            <span className={s.actual >= s.planned ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                              {(s.actual - s.planned).toFixed(2)}%
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
