"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  getExpenses,
  saveExpense,
  deleteExpense,
  getExpenseSummary,
  getBudgetVariances,
  importExpenses,
  SerializedExpense,
  ExpenseCategory,
  BudgetVariance,
  ImportExpenseRow,
} from "@/app/actions/expenses";
import { getRabItems, SerializedRabItem } from "@/app/actions/rab";
import { getOrCreateDefaultProject } from "@/app/actions/rab";
import {
  Plus,
  Edit3,
  Trash2,
  Loader2,
  AlertCircle,
  Filter,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  FileUp,
  Download,
  CheckCircle2,
  XCircle,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";

const CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: "MATERIAL", label: "Material", color: "bg-blue-50 text-blue-700 ring-blue-600/10 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/20" },
  { value: "LABOR", label: "Upah Tukang", color: "bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-500/20" },
  { value: "EQUIPMENT", label: "Peralatan", color: "bg-purple-50 text-purple-700 ring-purple-600/10 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-500/20" },
  { value: "OVERHEAD", label: "Overhead", color: "bg-zinc-50 text-zinc-700 ring-zinc-600/10 dark:bg-zinc-800/40 dark:text-zinc-400 dark:ring-zinc-700/20" },
];

const CATEGORY_MAP: Record<string, ExpenseCategory> = {
  material: "MATERIAL",
  labor: "LABOR",
  "upah tukang": "LABOR",
  upah: "LABOR",
  peralatan: "EQUIPMENT",
  equipment: "EQUIPMENT",
  overhead: "OVERHEAD",
};

function getCategoryMeta(category: string) {
  return CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[3];
}

function formatRp(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/** Parse DD/MM/YYYY → YYYY-MM-DD */
function parseDMY(raw: unknown): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  // DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(str)) {
    const d = XLSX.SSF.parse_date_code(Number(str));
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

function normalizeCategory(raw: unknown): ExpenseCategory | null {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return CATEGORY_MAP[key] ?? null;
}

function toNum(raw: unknown): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
}

interface PreviewRow {
  _rowIndex: number;
  tanggal: string;
  kategori: string;
  deskripsi: string;
  volume: string;
  satuan: string;
  harga_satuan: string;
  total_nominal: string;
  item_rab: string;
  catatan: string;
  // validation
  valid: boolean;
  errors: string[];
  // parsed
  parsed: ImportExpenseRow | null;
}

function parseExcelRows(
  data: Record<string, unknown>[],
  rabItems: SerializedRabItem[]
): PreviewRow[] {
  return data.map((row, idx) => {
    const errors: string[] = [];

    const tanggalRaw = row["tanggal"] ?? row["Tanggal"] ?? row["TANGGAL"];
    const tanggalParsed = parseDMY(tanggalRaw);
    if (!tanggalParsed) errors.push("Tanggal tidak valid (gunakan DD/MM/YYYY)");

    const kategoriRaw = row["kategori"] ?? row["Kategori"] ?? row["KATEGORI"];
    const kategoriParsed = normalizeCategory(kategoriRaw);
    if (!kategoriParsed) errors.push("Kategori tidak dikenal");

    const deskripsi = String(row["deskripsi"] ?? row["Deskripsi"] ?? row["DESKRIPSI"] ?? "").trim();
    if (!deskripsi) errors.push("Deskripsi/Nama Item wajib diisi");

    const totalRaw = row["total_nominal"] ?? row["Total Nominal"] ?? row["TOTAL_NOMINAL"] ?? row["total"];
    const totalParsed = toNum(totalRaw);
    if (!totalParsed || totalParsed <= 0) errors.push("Total Nominal harus > 0");

    const volumeParsed = toNum(row["volume"] ?? row["Volume"] ?? row["VOLUME"]);
    const hargaSatuanParsed = toNum(row["harga_satuan"] ?? row["Harga Satuan"] ?? row["HARGA_SATUAN"]);
    const satuan = String(row["satuan"] ?? row["Satuan"] ?? row["SATUAN"] ?? "").trim() || null;
    
    // Check multiple potential column names for RAB item
    const itemRabRaw = String(
      row["item_rab_terkait"] ??
      row["Item RAB Terkait"] ??
      row["ITEM_RAB_TERKAIT"] ??
      row["item_rab"] ??
      row["Item RAB"] ??
      row["ITEM_RAB"] ??
      row["kode_rab"] ??
      row["Kode RAB"] ??
      row["pos_rab"] ??
      row["Pos RAB"] ??
      row["rab"] ??
      row["RAB"] ??
      ""
    ).trim();

    const catatan = String(row["catatan"] ?? row["Catatan"] ?? row["CATATAN"] ?? "").trim() || null;

    // Match RAB item by code, description, or id
    let rabItemId: string | null = null;
    if (itemRabRaw) {
      const found = rabItems.find(
        (r) =>
          r.itemCode.toLowerCase() === itemRabRaw.toLowerCase() ||
          r.description.toLowerCase().includes(itemRabRaw.toLowerCase()) ||
          `${r.itemCode} - ${r.description}`.toLowerCase().includes(itemRabRaw.toLowerCase()) ||
          r.id === itemRabRaw
      );
      rabItemId = found?.id ?? null;
    }

    const valid = errors.length === 0;
    const parsed: ImportExpenseRow | null = valid
      ? {
          rabItemId,
          category: kategoriParsed!,
          vendorName: deskripsi,
          volume: volumeParsed,
          unitPrice: hargaSatuanParsed,
          unit: satuan,
          amount: totalParsed!,
          transactionDate: tanggalParsed!,
          notes: catatan,
        }
      : null;

    return {
      _rowIndex: idx + 2, // Excel row number (header = row 1)
      tanggal: tanggalRaw ? String(tanggalRaw) : "",
      kategori: kategoriRaw ? String(kategoriRaw) : "",
      deskripsi,
      volume: row["volume"] !== undefined ? String(row["volume"] ?? row["Volume"] ?? "") : "",
      satuan: satuan ?? "",
      harga_satuan: hargaSatuanParsed !== null ? String(hargaSatuanParsed) : "",
      total_nominal: totalRaw !== undefined ? String(totalRaw) : "",
      item_rab: itemRabRaw,
      catatan: catatan ?? "",
      valid,
      errors,
      parsed,
    };
  });
}

function downloadTemplate(rabItems: SerializedRabItem[]) {
  const headers = [
    "tanggal",
    "kategori",
    "item_rab_terkait",
    "deskripsi",
    "volume",
    "satuan",
    "harga_satuan",
    "total_nominal",
    "catatan",
  ];

  // Pick first active RAB item code as example if available
  const sampleRabCode = rabItems.length > 0 ? rabItems[0].itemCode : "1";

  const example = [
    "20/08/2026",
    "Material",
    sampleRabCode,
    "Pasir 3 m3",
    "3",
    "m3",
    "150000",
    "450000",
    "Pembelian pasir untuk pekerjaan",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaksi");

  // Sheet 2: Daftar Item RAB Proyek sebagai referensi kode
  if (rabItems.length > 0) {
    const rabHeaders = ["kode_rab", "deskripsi_pekerjaan", "volume", "satuan", "harga_satuan", "total_anggaran"];
    const rabRows = rabItems.map((r) => [
      r.itemCode,
      r.description,
      r.volume,
      r.unit || "",
      r.unitPrice,
      r.totalPrice,
    ]);
    const wsRab = XLSX.utils.aoa_to_sheet([rabHeaders, ...rabRows]);
    wsRab["!cols"] = [
      { wch: 12 },
      { wch: 45 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRab, "Daftar_Item_RAB");
  }

  XLSX.writeFile(wb, "template_transaksi_rab.xlsx");
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<SerializedExpense[]>([]);
  const [summary, setSummary] = useState<{ total: number; byCategory: { category: string; amount: number }[] } | null>(null);
  const [variances, setVariances] = useState<BudgetVariance[]>([]);
  const [rabItems, setRabItems] = useState<SerializedRabItem[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "ALL">("ALL");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Modal (add/edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<SerializedExpense | null>(null);

  // Form state
  const [fRabItemId, setFRabItemId] = useState("");
  const [fCategory, setFCategory] = useState<ExpenseCategory>("MATERIAL");
  const [fVendor, setFVendor] = useState("");
  const [fVolume, setFVolume] = useState<number | "">("");
  const [fUnitPrice, setFUnitPrice] = useState<number | "">("");
  const [fUnit, setFUnit] = useState<string>("");
  const [fAmount, setFAmount] = useState<number>(0);
  const [fDate, setFDate] = useState(new Date().toISOString().split("T")[0]);
  const [fProof, setFProof] = useState("");
  const [fNotes, setFNotes] = useState("");

  // ── Import Excel state ──────────────────────────────────────────────────
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [importLoading, setImportLoading] = useState(false);
  const [importRows, setImportRows] = useState<PreviewRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-calculate amount
  useEffect(() => {
    if (typeof fVolume === "number" && typeof fUnitPrice === "number") {
      setFAmount(Math.round(fVolume * fUnitPrice * 100) / 100);
    }
  }, [fVolume, fUnitPrice]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [proj, expData, sumData, varData] = await Promise.all([
        getOrCreateDefaultProject(),
        getExpenses({ category: filterCategory, dateFrom: filterDateFrom, dateTo: filterDateTo }),
        getExpenseSummary(),
        getBudgetVariances(),
      ]);
      setProjectId(proj.id);
      setExpenses(expData);
      setSummary(sumData);
      setVariances(varData);
      const items = await getRabItems(proj.id);
      setRabItems(items);
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal memuat data pengeluaran.");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleOpenAdd = () => {
    const firstLeaf = rabItems.find((i) => i.volume > 0 || i.unitPrice > 0);
    setEditingExpense(null);
    setFRabItemId(firstLeaf ? firstLeaf.id : "");
    setFCategory("MATERIAL");
    setFVendor("");
    setFVolume("");
    setFUnitPrice("");
    setFUnit(firstLeaf ? firstLeaf.unit || "" : "");
    setFAmount(0);
    setFDate(new Date().toISOString().split("T")[0]);
    setFProof("");
    setFNotes("");
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (expense: SerializedExpense) => {
    setEditingExpense(expense);
    setFRabItemId(expense.rabItemId || "");
    setFCategory(expense.category);
    setFVendor(expense.vendorName);
    setFVolume(expense.volume !== null ? expense.volume : "");
    setFUnitPrice(expense.unitPrice !== null ? expense.unitPrice : "");
    setFUnit(expense.unit || "");
    setFAmount(expense.amount);
    setFDate(expense.transactionDate);
    setFProof(expense.proofImageUrl || "");
    setFNotes(expense.notes || "");
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus transaksi ini?")) return;
    setActionLoading(true);
    try {
      await deleteExpense(id);
      await fetchAll();
    } catch {
      setErrorMsg("Gagal menghapus transaksi.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fVendor || fAmount <= 0) {
      setErrorMsg("Nama vendor dan nominal harus diisi.");
      return;
    }
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await saveExpense({
        id: editingExpense?.id,
        rabItemId: fRabItemId || null,
        category: fCategory,
        vendorName: fVendor,
        volume: fVolume === "" ? null : Number(fVolume),
        unitPrice: fUnitPrice === "" ? null : Number(fUnitPrice),
        unit: fUnit || null,
        amount: fAmount,
        transactionDate: fDate,
        proofImageUrl: fProof || null,
        notes: fNotes || null,
      });
      setIsModalOpen(false);
      await fetchAll();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setActionLoading(false);
    }
  };

  // Leaf items
  const leafRabItems = rabItems.filter((i) => i.volume > 0 || i.unitPrice > 0);
  const selectableRabItems = leafRabItems.length > 0 ? leafRabItems : rabItems;

  const handleRabItemChange = (itemId: string) => {
    setFRabItemId(itemId);
    const selected = leafRabItems.find((i) => i.id === itemId);
    if (selected) {
      setFUnit(selected.unit || "");
    } else {
      setFUnit("");
    }
  };

  // ── Import handlers ─────────────────────────────────────────────────────
  const openImportModal = () => {
    setIsImportOpen(true);
    setImportStep("upload");
    setImportRows([]);
    setSelectedRows(new Set());
    setImportResult(null);
  };

  const handleRowRabChange = (rowIndex: number, newRabItemId: string) => {
    const targetRab = rabItems.find((r) => r.id === newRabItemId);
    setImportRows((prev) =>
      prev.map((row) => {
        if (row._rowIndex !== rowIndex) return row;
        const updatedParsed = row.parsed
          ? {
              ...row.parsed,
              rabItemId: newRabItemId || null,
            }
          : null;
        return {
          ...row,
          item_rab: targetRab ? targetRab.itemCode : "",
          parsed: updatedParsed,
        };
      })
    );
  };

  const applyRabToAllRows = (newRabItemId: string) => {
    const targetRab = rabItems.find((r) => r.id === newRabItemId);
    setImportRows((prev) =>
      prev.map((row) => {
        const updatedParsed = row.parsed
          ? {
              ...row.parsed,
              rabItemId: newRabItemId === "NONE" ? null : newRabItemId || row.parsed.rabItemId,
            }
          : null;
        return {
          ...row,
          item_rab:
            newRabItemId === "NONE"
              ? ""
              : targetRab
              ? targetRab.itemCode
              : row.item_rab,
          parsed: updatedParsed,
        };
      })
    );
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
          raw: true,
        });
        if (json.length === 0) {
          alert("File Excel kosong atau tidak ada data.");
          return;
        }
        const rows = parseExcelRows(json, rabItems);
        setImportRows(rows);
        // Select all valid rows by default
        const validIndexes = new Set(
          rows.filter((r) => r.valid).map((r) => r._rowIndex)
        );
        setSelectedRows(validIndexes);
        setImportStep("preview");
      } catch {
        alert("Gagal membaca file Excel. Pastikan format file benar.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const toggleRow = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const toggleAll = () => {
    const validIndexes = importRows.filter((r) => r.valid).map((r) => r._rowIndex);
    if (validIndexes.every((i) => selectedRows.has(i))) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(validIndexes));
    }
  };

  const handleImportConfirm = async () => {
    const toImport = importRows
      .filter((r) => r.valid && selectedRows.has(r._rowIndex) && r.parsed)
      .map((r) => r.parsed!);

    if (toImport.length === 0) return;
    setImportLoading(true);
    try {
      const result = await importExpenses(toImport);
      setImportResult(result);
      setImportStep("done");
      await fetchAll();
    } catch {
      alert("Terjadi kesalahan saat import. Coba lagi.");
    } finally {
      setImportLoading(false);
    }
  };

  const validCount = importRows.filter((r) => r.valid).length;
  const invalidCount = importRows.filter((r) => !r.valid).length;
  const selectedCount = importRows.filter(
    (r) => r.valid && selectedRows.has(r._rowIndex)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pengeluaran &amp; Transaksi
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Catat dan pantau seluruh transaksi keuangan proyek berdasarkan pos anggaran RAB.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openImportModal}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <FileUp className="h-4 w-4" />
            Import Excel
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Catat Transaksi
          </button>
        </div>
      </div>

      {errorMsg && !isModalOpen && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="col-span-2 lg:col-span-1 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Total Pengeluaran</span>
            </div>
            <div className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
              {formatRp(summary.total)}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              100% dari total pengeluaran
            </div>
          </div>
          {CATEGORIES.map((cat) => {
            const found = summary.byCategory.find((b) => b.category === cat.value);
            const amount = found ? found.amount : 0;
            const percentage = summary.total > 0 ? (amount / summary.total) * 100 : 0;
            return (
              <div key={cat.value} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  {cat.label}
                </div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {formatRp(amount)}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {percentage.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </span>{" "}
                  dari total
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget Variance Section */}
      {variances.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Varian Anggaran per Item RAB
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Perbandingan realisasi pengeluaran vs anggaran RAB per item</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-500 text-xs dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <th className="p-4 font-semibold" rowSpan={2}>Item RAB</th>
                  <th className="p-2 font-semibold text-center border-b border-zinc-200 dark:border-zinc-700" colSpan={3}>Volume / Fisik</th>
                  <th className="p-2 font-semibold text-center border-b border-zinc-200 dark:border-zinc-700" colSpan={3}>Uang (Rp)</th>
                  <th className="p-4 font-semibold text-center" rowSpan={2}>Status</th>
                </tr>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-500 text-xs dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <th className="p-2 font-semibold text-right">Rencana</th>
                  <th className="p-2 font-semibold text-right">Realisasi</th>
                  <th className="p-2 font-semibold text-right border-r border-zinc-200 dark:border-zinc-700">Sisa</th>
                  <th className="p-2 font-semibold text-right">Rencana</th>
                  <th className="p-2 font-semibold text-right">Realisasi</th>
                  <th className="p-2 font-semibold text-right">Sisa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {variances.map((v) => {
                  const isLumpsum = v.rabItemUnit?.toLowerCase() === "ls" || v.rabItemUnit?.toLowerCase() === "lumpsum";
                  return (
                    <tr key={v.rabItemId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20">
                      <td className="p-4">
                        <span className="font-mono text-xs text-zinc-500 mr-2">{v.rabItemCode}</span>
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{v.rabItemDescription}</span>
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-zinc-500">
                        {isLumpsum ? "—" : <>{v.budgetVolume} <span className="text-[10px] text-zinc-400">{v.rabItemUnit}</span></>}
                      </td>
                      <td className="p-2 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                        {isLumpsum ? "—" : <>{v.spentVolume} <span className="text-[10px] text-zinc-400 font-normal">{v.rabItemUnit}</span></>}
                      </td>
                      <td className={`p-2 text-right font-semibold border-r border-zinc-100 dark:border-zinc-800 ${!isLumpsum && v.isVolumeOver ? "text-rose-600" : "text-emerald-600"}`}>
                        {isLumpsum ? "—" : <>{v.isVolumeOver ? "-" : ""}{Math.abs(v.remainingVolume)}</>}
                      </td>
                      <td className="p-2 text-right font-mono text-xs text-zinc-500">{formatRp(v.budgetAmount)}</td>
                      <td className="p-2 text-right font-semibold text-zinc-900 dark:text-zinc-50">{formatRp(v.spentAmount)}</td>
                      <td className={`p-2 text-right font-semibold ${v.isOverBudget ? "text-rose-600" : "text-emerald-600"}`}>
                        {v.isOverBudget ? "-" : ""}{formatRp(Math.abs(v.remainingAmount))}
                      </td>
                      <td className="p-4 text-center flex flex-col items-center gap-1">
                        {v.isOverBudget ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-600/10 dark:bg-rose-900/20 dark:text-rose-400">
                            <TrendingUp className="h-3 w-3" /> Rp Over
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-900/20 dark:text-emerald-400">
                            <TrendingDown className="h-3 w-3" /> Rp Aman
                          </span>
                        )}
                        {!isLumpsum && v.budgetVolume > 0 && (
                          v.isVolumeOver ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-600/10 dark:bg-rose-900/20 dark:text-rose-400">
                              <TrendingUp className="h-3 w-3" /> Vol Over
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-900/20 dark:text-emerald-400">
                              <TrendingDown className="h-3 w-3" /> Vol Aman
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-zinc-400 shrink-0" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | "ALL")}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="ALL">Semua Kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50" />
            <span className="text-zinc-400 text-sm">s/d</span>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50" />
          </div>
          {(filterCategory !== "ALL" || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setFilterCategory("ALL"); setFilterDateFrom(""); setFilterDateTo(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 underline">
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Memuat data...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
            <Receipt className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium">Belum ada transaksi tercatat.</p>
            <button onClick={handleOpenAdd} className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Catat transaksi pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <th className="p-4 font-semibold w-28">Tanggal</th>
                  <th className="p-4 font-semibold">Pos RAB</th>
                  <th className="p-4 font-semibold">Deskripsi / Item</th>
                  <th className="p-4 font-semibold text-right">Volume</th>
                  <th className="p-4 font-semibold text-right">Harga Sat.</th>
                  <th className="p-4 font-semibold w-36 text-right">Total Nominal</th>
                  <th className="p-4 font-semibold">Bukti</th>
                  <th className="p-4 font-semibold w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-600 dark:text-zinc-300">
                {expenses.map((item) => {
                  const catMeta = getCategoryMeta(item.category);
                  return (
                    <tr key={item.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">{item.transactionDate}</td>
                      <td className="p-4 text-zinc-700 dark:text-zinc-300 text-xs">
                        <div className="font-medium">{item.rabItemDescription ?? <span className="text-zinc-400 italic">—</span>}</div>
                        <span className={`mt-1 inline-flex items-center rounded text-[10px] font-medium ring-1 ring-inset px-1.5 py-0.5 ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-zinc-900 dark:text-zinc-50">{item.vendorName}</td>
                      <td className="p-4 text-right font-mono text-xs text-zinc-500">
                        {item.volume !== null ? `${item.volume} ${item.unit || ""}` : "—"}
                      </td>
                      <td className="p-4 text-right font-mono text-xs text-zinc-500">
                        {item.unitPrice !== null ? formatRp(item.unitPrice) : "—"}
                      </td>
                      <td className="p-4 text-right font-semibold font-mono text-zinc-950 dark:text-zinc-50">
                        {formatRp(item.amount)}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-xs">
                          {item.notes && <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]" title={item.notes}>{item.notes}</span>}
                          {item.proofImageUrl && (
                            <a href={item.proofImageUrl} target="_blank" rel="noreferrer"
                              className="text-blue-600 hover:underline dark:text-blue-400 truncate max-w-[120px]">
                              {item.proofImageUrl.split("/").pop() || "Lihat Bukti"}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                          <button onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 dark:hover:bg-zinc-800" title="Edit">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-md hover:bg-rose-50 text-rose-500 dark:hover:bg-zinc-800" title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30">
                <tr>
                  <td colSpan={5} className="p-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    {expenses.length} transaksi
                  </td>
                  <td className="p-4 text-right font-extrabold text-zinc-900 dark:text-zinc-50 font-mono">
                    {formatRp(expenses.reduce((s, e) => s + e.amount, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm" onClick={() => !actionLoading && setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 z-10">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {editingExpense ? "Edit Transaksi" : "Catat Transaksi Baru"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} disabled={actionLoading}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Tanggal *</label>
                  <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} required
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    disabled={actionLoading} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Kategori *</label>
                  <select value={fCategory} onChange={(e) => setFCategory(e.target.value as ExpenseCategory)} required
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    disabled={actionLoading}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  Item RAB Terkait <span className="font-normal text-zinc-400">(opsional)</span>
                </label>
                <select value={fRabItemId} onChange={(e) => handleRabItemChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  disabled={actionLoading}>
                  <option value="">— Tidak Terhubung ke RAB —</option>
                  {selectableRabItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.itemCode} — {item.description} {item.volume ? `(${item.volume} ${item.unit || ''})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Deskripsi / Nama Item *</label>
                <input type="text" value={fVendor} onChange={(e) => setFVendor(e.target.value)} required
                  placeholder="e.g. Pasir 3 m3, Gaji Pak Agus, dll"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  disabled={actionLoading} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-12 gap-4">
                <div className="col-span-1 sm:col-span-4">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Volume</label>
                  <input type="number" step="any" min="0" value={fVolume} onChange={(e) => setFVolume(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Contoh: 10"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    disabled={actionLoading} />
                </div>
                <div className="col-span-1 sm:col-span-3">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Satuan</label>
                  <input type="text" value={fUnit} onChange={(e) => setFUnit(e.target.value)}
                    placeholder="m3, ls"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    disabled={actionLoading} />
                </div>
                <div className="col-span-2 sm:col-span-5">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Harga Satuan (Rp)</label>
                  <input type="number" step="any" min="0" value={fUnitPrice} onChange={(e) => setFUnitPrice(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Contoh: 150000"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    disabled={actionLoading} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Nominal (Rp) *</label>
                <input type="number" step="any" min="0" value={fAmount || ""} onChange={(e) => setFAmount(Number(e.target.value))} required
                  placeholder="Total Pengeluaran"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-lg font-bold text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  disabled={actionLoading} />
                {fAmount > 0 && (
                  <p className="text-xs text-zinc-400 mt-1">Sama dengan {formatRp(fAmount)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                  URL/Nama Foto Bukti <span className="font-normal text-zinc-400">(opsional)</span>
                </label>
                <input type="text" value={fProof} onChange={(e) => setFProof(e.target.value)}
                  placeholder="e.g. invoice-001.jpg atau https://..."
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  disabled={actionLoading} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Catatan</label>
                <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                  placeholder="Detail pembelian, keterangan, dsb."
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none resize-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  disabled={actionLoading} />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={actionLoading}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                  Batal
                </button>
                <button type="submit" disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-50">
                  {actionLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Menyimpan...</> : "Simpan Transaksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Import Excel Modal ─────────────────────────────────────────── */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => !importLoading && setIsImportOpen(false)} />
          <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 z-10 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-900/20">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Import Transaksi dari Excel</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Upload file .xlsx atau .xls dengan penautan Item RAB</p>
                </div>
              </div>
              {/* Step indicator */}
              <div className="hidden sm:flex items-center gap-1 text-xs font-medium">
                {(["upload", "preview", "done"] as const).map((step, i) => (
                  <React.Fragment key={step}>
                    <span className={`px-2.5 py-1 rounded-full transition-colors ${importStep === step ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900" : "text-zinc-400"}`}>
                      {i + 1}. {step === "upload" ? "Upload" : step === "preview" ? "Preview & Link RAB" : "Selesai"}
                    </span>
                    {i < 2 && <ChevronRight className="h-3 w-3 text-zinc-300" />}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={() => setIsImportOpen(false)} disabled={importLoading}
                className="ml-4 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* STEP: UPLOAD */}
              {importStep === "upload" && (
                <div className="p-6 space-y-6">
                  {/* Download template */}
                  <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 dark:bg-blue-900/10 dark:border-blue-900/30">
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Belum punya template?</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                        Download template Excel lengkap dengan daftar kode Item RAB proyek ini
                      </p>
                    </div>
                    <button onClick={() => downloadTemplate(rabItems)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
                      <Download className="h-3.5 w-3.5" />
                      Download Template Excel
                    </button>
                  </div>

                  {/* Format guide */}
                  <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-700">
                    <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700">
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">Format Kolom Excel</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800">
                            <th className="px-4 py-2 text-left font-semibold text-zinc-500">Kolom</th>
                            <th className="px-4 py-2 text-left font-semibold text-zinc-500">Wajib</th>
                            <th className="px-4 py-2 text-left font-semibold text-zinc-500">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                          {[
                            ["tanggal", "✅", "Format DD/MM/YYYY, contoh: 20/08/2026"],
                            ["kategori", "✅", "Material, Upah Tukang, Peralatan, atau Overhead"],
                            ["item_rab_terkait", "❌", "Kode item RAB (contoh: 1 atau 1.1) — bisa dipilih juga di preview"],
                            ["deskripsi", "✅", "Nama item / keterangan transaksi"],
                            ["total_nominal", "✅", "Angka nominal total (Rp)"],
                            ["volume", "❌", "Kuantitas (angka)"],
                            ["satuan", "❌", "m2, m3, bh, kg, ls, dll"],
                            ["harga_satuan", "❌", "Harga per satuan (Rp)"],
                            ["catatan", "❌", "Keterangan tambahan"],
                          ].map(([col, req, desc]) => (
                            <tr key={col}>
                              <td className="px-4 py-2 font-mono font-medium text-zinc-900 dark:text-zinc-100">{col}</td>
                              <td className="px-4 py-2 text-center">{req}</td>
                              <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">{desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors ${dragOver ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/10" : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/30"}`}
                  >
                    <FileUp className={`h-10 w-10 transition-colors ${dragOver ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"}`} />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {dragOver ? "Lepaskan file di sini" : "Drag & drop file Excel di sini"}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">atau klik untuk pilih file (.xlsx, .xls)</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
                  </div>
                </div>
              )}

              {/* STEP: PREVIEW */}
              {importStep === "preview" && (
                <div className="flex flex-col h-full">
                  {/* Summary & Bulk Assign bar */}
                  <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-zinc-500">Total baris: <strong className="text-zinc-900 dark:text-zinc-50">{importRows.length}</strong></span>
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <strong>{validCount}</strong> valid
                      </span>
                      {invalidCount > 0 && (
                        <span className="flex items-center gap-1 text-rose-500">
                          <XCircle className="h-4 w-4" />
                          <strong>{invalidCount}</strong> error
                        </span>
                      )}
                      <span className="text-blue-600 font-medium">{selectedCount} baris dipilih</span>
                    </div>

                    {/* Bulk Assign RAB to all rows */}
                    {selectableRabItems.length > 0 && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                          Pilih RAB untuk Semua:
                        </label>
                        <select
                          onChange={(e) => applyRabToAllRows(e.target.value)}
                          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 max-w-[260px] truncate"
                          defaultValue=""
                        >
                          <option value="" disabled>— Terapkan ke semua baris —</option>
                          <option value="NONE">— Kosongkan (Tanpa Link RAB) —</option>
                          {selectableRabItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.itemCode} — {item.description}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Table */}
                  <div className="overflow-auto flex-1 min-h-0">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                          <th className="px-3 py-2 text-center w-10">
                            <input type="checkbox"
                              checked={validCount > 0 && validCount === selectedCount}
                              onChange={toggleAll}
                              className="rounded"
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500 w-8">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500">Tanggal</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500">Kategori</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500 min-w-[160px]">Deskripsi</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500 min-w-[220px]">Item RAB Terkait</th>
                          <th className="px-3 py-2 text-right font-semibold text-zinc-500">Volume</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500">Sat.</th>
                          <th className="px-3 py-2 text-right font-semibold text-zinc-500">Harga Sat.</th>
                          <th className="px-3 py-2 text-right font-semibold text-zinc-500 min-w-[100px]">Total (Rp)</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500">Catatan</th>
                          <th className="px-3 py-2 text-left font-semibold text-zinc-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {importRows.map((row) => (
                          <tr key={row._rowIndex}
                            className={`transition-colors ${row.valid ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/30" : "bg-rose-50/60 dark:bg-rose-950/10"}`}>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox"
                                checked={row.valid && selectedRows.has(row._rowIndex)}
                                disabled={!row.valid}
                                onChange={() => toggleRow(row._rowIndex)}
                                className="rounded disabled:opacity-30"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-zinc-400">{row._rowIndex}</td>
                            <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">{row.tanggal || <span className="text-rose-400">—</span>}</td>
                            <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{row.kategori || <span className="text-rose-400">—</span>}</td>
                            <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate" title={row.deskripsi}>{row.deskripsi || <span className="text-rose-400">—</span>}</td>
                            
                            {/* Interactive RAB Selection per row */}
                            <td className="px-3 py-2">
                              <select
                                value={row.parsed?.rabItemId || ""}
                                onChange={(e) => handleRowRabChange(row._rowIndex, e.target.value)}
                                disabled={!row.valid}
                                className="w-full min-w-[180px] max-w-[240px] rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 truncate disabled:opacity-50"
                              >
                                <option value="">— Tidak Terhubung ke RAB —</option>
                                {selectableRabItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.itemCode} — {item.description}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-3 py-2 text-right font-mono text-zinc-500">{row.volume || "—"}</td>
                            <td className="px-3 py-2 text-zinc-500">{row.satuan || "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-zinc-500">{row.harga_satuan ? Number(row.harga_satuan).toLocaleString("id-ID") : "—"}</td>
                            <td className="px-3 py-2 text-right font-semibold font-mono text-zinc-900 dark:text-zinc-50">
                              {row.total_nominal ? Number(row.total_nominal).toLocaleString("id-ID") : <span className="text-rose-400">—</span>}
                            </td>
                            <td className="px-3 py-2 text-zinc-500 max-w-[120px] truncate" title={row.catatan}>{row.catatan || "—"}</td>
                            <td className="px-3 py-2">
                              {row.valid ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:bg-rose-900/20 dark:text-rose-400" title={row.errors.join(", ")}>
                                  <XCircle className="h-3 w-3" /> Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Error detail */}
                  {invalidCount > 0 && (
                    <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                      <p className="text-xs font-semibold text-rose-500 mb-2">Detail Error:</p>
                      <ul className="space-y-1">
                        {importRows.filter((r) => !r.valid).map((r) => (
                          <li key={r._rowIndex} className="text-xs text-rose-600 dark:text-rose-400">
                            <span className="font-mono">Baris {r._rowIndex}:</span> {r.errors.join(" · ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* STEP: DONE */}
              {importStep === "done" && importResult && (
                <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
                  <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/30">
                    <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Import Selesai!</p>
                    <p className="text-zinc-500 text-sm mt-1">
                      <strong className="text-emerald-600">{importResult.imported} transaksi</strong> berhasil disimpan
                      {importResult.errors > 0 && (
                        <> · <strong className="text-rose-500">{importResult.errors} gagal</strong></>
                      )}
                    </p>
                  </div>
                  <button onClick={() => setIsImportOpen(false)}
                    className="mt-2 px-6 py-2.5 rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200">
                    Tutup
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            {importStep !== "done" && (
              <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <button onClick={() => importStep === "preview" ? setImportStep("upload") : setIsImportOpen(false)}
                  disabled={importLoading}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 disabled:opacity-50">
                  {importStep === "preview" ? "← Kembali" : "Batal"}
                </button>

                {importStep === "preview" && (
                  <button
                    onClick={handleImportConfirm}
                    disabled={importLoading || selectedCount === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {importLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Mengimport...</>
                    ) : (
                      <><FileUp className="h-4 w-4" />Import {selectedCount} Transaksi</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

