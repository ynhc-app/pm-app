"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getFullReportData } from "@/app/actions/reports";
import {
  FileSpreadsheet,
  FileDown,
  Loader2,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Layers,
  CheckCircle2,
} from "lucide-react";

function formatRp(val: number): string {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

function getFormattedTimestamp(): { dateStr: string; fileTimestamp: string; displayDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const dateStr = `${year}-${month}-${day}`;
  const fileTimestamp = `${year}-${month}-${day}_${hours}${minutes}`;
  const displayDate = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }) + ` ${hours}:${minutes} WIB`;

  return { dateStr, fileTimestamp, displayDate };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
}

export default function ReportsPage() {
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // ── 1. Export Excel Handler ──────────────────────────────────────────────
  const handleExportExcel = async (reportType: "variance" | "expenses" | "scurve" | "rab") => {
    setLoadingType(`excel-${reportType}`);
    try {
      const { project, rabItems, expenses, variances, scurve } = await getFullReportData();
      const wb = XLSX.utils.book_new();
      const { fileTimestamp } = getFormattedTimestamp();
      const projName = sanitizeFilename(project.name);

      let filename = "";

      if (reportType === "variance") {
        filename = `Laporan_Varian_Biaya_${projName}_${fileTimestamp}.xlsx`;
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
      } else if (reportType === "expenses") {
        filename = `Rekap_Pengeluaran_${projName}_${fileTimestamp}.xlsx`;
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
      } else if (reportType === "rab") {
        filename = `Master_RAB_AHSP_${projName}_${fileTimestamp}.xlsx`;
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
      } else if (reportType === "scurve") {
        filename = `Laporan_Kurva_S_${projName}_${fileTimestamp}.xlsx`;
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
      }

      XLSX.writeFile(wb, filename);
      showToast(`Berhasil mengunduh Excel: ${filename}`);
    } catch (err) {
      console.error(err);
      alert("Gagal mengunduh file Excel. Silakan coba lagi.");
    } finally {
      setLoadingType(null);
    }
  };

  // ── 2. Automatic Direct PDF Generator & Downloader ────────────────────────
  const handleExportPDF = async (reportType: "variance" | "expenses" | "scurve" | "rab") => {
    setLoadingType(`pdf-${reportType}`);
    try {
      const { project, rabItems, expenses, variances, scurve } = await getFullReportData();
      const { fileTimestamp, displayDate } = getFormattedTimestamp();
      const projName = sanitizeFilename(project.name);

      // Initialize jsPDF in landscape or portrait
      const isLandscape = reportType === "variance" || reportType === "rab";
      const doc = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // Header helper function
      const renderHeader = (title: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(24, 24, 27); // zinc-900
        doc.text(title.toUpperCase(), pageWidth / 2, 14, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(113, 113, 122); // zinc-500
        doc.text(
          `Proyek: ${project.name}  |  Klien: ${project.clientName}`,
          pageWidth / 2,
          19,
          { align: "center" }
        );
        doc.text(`Waktu Cetak: ${displayDate}`, pageWidth / 2, 23.5, {
          align: "center",
        });

        // Horizontal Line
        doc.setDrawColor(228, 228, 231); // zinc-200
        doc.setLineWidth(0.4);
        doc.line(14, 26, pageWidth - 14, 26);
      };

      let filename = "";

      if (reportType === "variance") {
        filename = `Laporan_Varian_Biaya_${projName}_${fileTimestamp}.pdf`;
        renderHeader("Laporan Varian Biaya Proyek (Cost Variance)");

        const tableData = variances.map((v, i) => [
          i + 1,
          v.rabItemCode,
          v.rabItemDescription,
          v.rabItemUnit || "-",
          formatRp(v.budgetAmount),
          formatRp(v.spentAmount),
          formatRp(v.remainingAmount),
          `${v.costVariancePercent.toFixed(1)}%`,
          v.isOverBudget ? "OVERRUN" : "AMAN",
        ]);

        const totalBudget = variances.reduce((s, v) => s + v.budgetAmount, 0);
        const totalSpent = variances.reduce((s, v) => s + v.spentAmount, 0);
        const totalRemaining = totalBudget - totalSpent;

        autoTable(doc, {
          startY: 30,
          head: [
            [
              "No",
              "Kode",
              "Uraian Pekerjaan",
              "Satuan",
              "Anggaran RAB",
              "Realisasi",
              "Sisa Anggaran",
              "% Realisasi",
              "Status",
            ],
          ],
          body: tableData,
          foot: [
            [
              "",
              "",
              "TOTAL KESELURUHAN",
              "",
              formatRp(totalBudget),
              formatRp(totalSpent),
              formatRp(totalRemaining),
              totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}%` : "0%",
              totalSpent > totalBudget ? "OVERRUN" : "AMAN",
            ],
          ],
          theme: "striped",
          headStyles: {
            fillColor: [24, 24, 27],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: "bold",
            halign: "center",
          },
          footStyles: {
            fillColor: [244, 244, 245],
            textColor: [24, 24, 27],
            fontSize: 8,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 2,
            overflow: "linebreak",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { halign: "center", cellWidth: 18 },
            2: { halign: "left" },
            3: { halign: "center", cellWidth: 14 },
            4: { halign: "right", cellWidth: 32 },
            5: { halign: "right", cellWidth: 32 },
            6: { halign: "right", cellWidth: 32 },
            7: { halign: "center", cellWidth: 20 },
            8: { halign: "center", cellWidth: 20 },
          },
          margin: { left: 14, right: 14 },
        });
      } else if (reportType === "expenses") {
        filename = `Rekap_Pengeluaran_${projName}_${fileTimestamp}.pdf`;
        renderHeader("Rekapitulasi Pengeluaran & Transaksi Proyek");

        const tableData = expenses.map((e, i) => [
          i + 1,
          new Date(e.transactionDate).toLocaleDateString("id-ID"),
          e.category,
          e.vendorName,
          e.rabItemDescription || "Pengeluaran Umum",
          e.volume ? `${e.volume} ${e.unit || ""}` : "-",
          formatRp(e.amount),
        ]);

        const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

        autoTable(doc, {
          startY: 30,
          head: [
            [
              "No",
              "Tanggal",
              "Kategori",
              "Vendor / Supplier",
              "Item RAB Terkait",
              "Volume",
              "Total Nominal",
            ],
          ],
          body: tableData,
          foot: [
            ["", "", "", "", "TOTAL PENGELUARAN", "", formatRp(totalExpenses)],
          ],
          theme: "striped",
          headStyles: {
            fillColor: [24, 24, 27],
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: "bold",
            halign: "center",
          },
          footStyles: {
            fillColor: [244, 244, 245],
            textColor: [24, 24, 27],
            fontSize: 8.5,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 8,
            cellPadding: 2.2,
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { halign: "center", cellWidth: 24 },
            2: { halign: "center", cellWidth: 24 },
            3: { halign: "left" },
            4: { halign: "left" },
            5: { halign: "center", cellWidth: 22 },
            6: { halign: "right", cellWidth: 34 },
          },
          margin: { left: 14, right: 14 },
        });
      } else if (reportType === "rab") {
        filename = `Master_RAB_AHSP_${projName}_${fileTimestamp}.pdf`;
        renderHeader("Master Anggaran Biaya (RAB) & Rincian AHSP");

        const tableData = rabItems.map((item, i) => [
          i + 1,
          item.itemCode,
          item.description,
          item.unit || "-",
          item.volume > 0 ? item.volume.toLocaleString("id-ID") : "-",
          item.unitPrice > 0 ? formatRp(item.unitPrice) : "-",
          formatRp(item.totalPrice),
          `${item.weightPercentage.toFixed(2)}%`,
          item.materialSubtotal > 0 ? formatRp(item.materialSubtotal) : "-",
          item.laborSubtotal > 0 ? formatRp(item.laborSubtotal) : "-",
          item.equipmentSubtotal > 0 ? formatRp(item.equipmentSubtotal) : "-",
          item.overheadSubtotal > 0 ? formatRp(item.overheadSubtotal) : "-",
        ]);

        const totalRab = project.totalBudget || 0;

        autoTable(doc, {
          startY: 30,
          head: [
            [
              "No",
              "Kode",
              "Uraian Pekerjaan",
              "Sat",
              "Vol",
              "Harga Satuan",
              "Total Anggaran",
              "Bobot",
              "Material",
              "Upah",
              "Alat",
              "Overhead",
            ],
          ],
          body: tableData,
          foot: [
            [
              "",
              "",
              "TOTAL NILAI PROYEK",
              "",
              "",
              "",
              formatRp(totalRab),
              "100.00%",
              "",
              "",
              "",
              "",
            ],
          ],
          theme: "striped",
          headStyles: {
            fillColor: [24, 24, 27],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: "bold",
            halign: "center",
          },
          footStyles: {
            fillColor: [244, 244, 245],
            textColor: [24, 24, 27],
            fontSize: 8,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 7,
            cellPadding: 1.8,
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 8 },
            1: { halign: "center", cellWidth: 14 },
            2: { halign: "left" },
            3: { halign: "center", cellWidth: 10 },
            4: { halign: "center", cellWidth: 12 },
            5: { halign: "right", cellWidth: 24 },
            6: { halign: "right", cellWidth: 28 },
            7: { halign: "center", cellWidth: 16 },
            8: { halign: "right", cellWidth: 22 },
            9: { halign: "right", cellWidth: 22 },
            10: { halign: "right", cellWidth: 20 },
            11: { halign: "right", cellWidth: 20 },
          },
          margin: { left: 10, right: 10 },
        });
      } else if (reportType === "scurve") {
        filename = `Laporan_Kurva_S_${projName}_${fileTimestamp}.pdf`;
        renderHeader("Laporan Kemajuan Progres Fisik (Kurva-S)");

        const tableData = scurve.map((s) => [
          s.week,
          s.weekLabel,
          `${s.planned.toFixed(2)}%`,
          s.actual !== null ? `${s.actual.toFixed(2)}%` : "-",
          s.cost !== null ? `${s.cost.toFixed(2)}%` : "-",
          s.actual !== null ? `${(s.actual - s.planned).toFixed(2)}%` : "-",
        ]);

        autoTable(doc, {
          startY: 30,
          head: [
            [
              "Minggu Ke",
              "Periode / Label",
              "Rencana Kumulatif (%)",
              "Realisasi Fisik Kumulatif (%)",
              "Realisasi Biaya Kumulatif (%)",
              "Deviasi Fisik (%)",
            ],
          ],
          body: tableData,
          theme: "striped",
          headStyles: {
            fillColor: [24, 24, 27],
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: "bold",
            halign: "center",
          },
          styles: {
            fontSize: 8,
            cellPadding: 2.5,
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 24 },
            1: { halign: "center", cellWidth: 32 },
            2: { halign: "right", cellWidth: 36 },
            3: { halign: "right", cellWidth: 36 },
            4: { halign: "right", cellWidth: 36 },
            5: { halign: "right" },
          },
          margin: { left: 14, right: 14 },
        });
      }

      // Add Page Numbers in Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(161, 161, 170); // zinc-400
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.text(
          `Halaman ${i} dari ${totalPages}  •  BuildTracker Pro`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      // Download directly
      doc.save(filename);
      showToast(`Berhasil mengunduh PDF: ${filename}`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Gagal membuat file PDF. Silakan coba lagi.");
    } finally {
      setLoadingType(null);
    }
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
          Ekspor dokumen resmi dan analisis kemajuan serta keuangan proyek konstruksi ke format Excel dan PDF secara otomatis.
        </p>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-2xl transition-all animate-bounce">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-xs font-semibold">{successToast}</p>
        </div>
      )}

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
                    onClick={() => handleExportPDF(report.id)}
                    disabled={isPdfLoading || isExcelLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                    title="Buat & Unduh File PDF Otomatis"
                  >
                    {isPdfLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5 text-rose-500" />
                    )}
                    Unduh PDF
                  </button>
                  <button
                    onClick={() => handleExportExcel(report.id)}
                    disabled={isExcelLoading || isPdfLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-50"
                    title="Unduh Spreadsheet Excel"
                  >
                    {isExcelLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    Unduh Excel
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
