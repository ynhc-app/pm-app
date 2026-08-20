import React from "react";

export default function ReportsPage() {
  const reportsMockList = [
    {
      title: "Laporan Varian Biaya (Cost Variance)",
      description: "Analisis komparatif antara anggaran RAB induk dan realisasi pengeluaran riil untuk mendeteksi selisih (overrun/underrun).",
      format: "Excel / PDF",
      updated: "Real-time",
    },
    {
      title: "Laporan Cash Flow Proyek",
      description: "Mutasi arus kas masuk (termin pembayaran klien) versus pengeluaran operasional di lapangan.",
      format: "Excel / PDF",
      updated: "Real-time",
    },
    {
      title: "Laporan Kemajuan Progres Fisik (Kurva-S)",
      description: "Laporan mingguan kemajuan fisik konstruksi lengkap dengan grafik deviasi rencana vs aktual.",
      format: "PDF",
      updated: "Setiap Minggu",
    },
    {
      title: "Rekapitulasi Pengeluaran Material & Vendor",
      description: "Daftar rinci pembelanjaan bahan bangunan terkelompok berdasarkan supplier/vendor dan pos pekerjaan.",
      format: "Excel",
      updated: "Real-time",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Laporan & Unduhan</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ekspor dokumen dan analisis kemajuan serta keuangan proyek konstruksi.
        </p>
      </div>

      {/* Reports Listing Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {reportsMockList.map((report, index) => (
          <div 
            key={index}
            className="flex flex-col justify-between p-6 rounded-xl border border-zinc-200 bg-white hover:shadow-xs transition-shadow dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{report.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{report.description}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between dark:border-zinc-800">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Format: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{report.format}</span> • {report.updated}
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-900">
                  Unduh PDF
                </button>
                <button className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                  Unduh Excel
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
