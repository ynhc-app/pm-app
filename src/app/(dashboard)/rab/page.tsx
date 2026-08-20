"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  getOrCreateDefaultProject,
  getRabItems,
  saveRabItem,
  deleteRabItem,
  SerializedRabItem,
  SerializedRabComponent,
  ComponentCategory,
  ProjectSummary,
} from "@/app/actions/rab";
import {
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Building2,
  AlertCircle,
  FolderPlus,
  RefreshCw,
  Layers,
  Package,
  Hammer,
  Wrench,
  Receipt,
  X,
  Eye,
  Info,
} from "lucide-react";

interface ComponentRow {
  id?: string;
  category: ComponentCategory;
  name: string;
  unit: string;
  volume: number | "";
  unitPrice: number | "";
}

const CATEGORY_TABS: {
  key: ComponentCategory;
  label: string;
  icon: typeof Package;
  color: string;
  bgLight: string;
  borderLight: string;
  placeholderName: string;
  placeholderUnit: string;
}[] = [
  {
    key: "MATERIAL",
    label: "Material",
    icon: Package,
    color: "text-blue-600 dark:text-blue-400",
    bgLight: "bg-blue-50/50 dark:bg-blue-950/20",
    borderLight: "border-blue-200 dark:border-blue-900/30",
    placeholderName: "contoh: Pasir Pasang, Semen Padang, Bata Merah",
    placeholderUnit: "m3, sak, bh, batang",
  },
  {
    key: "LABOR",
    label: "Upah Tukang",
    icon: Hammer,
    color: "text-amber-600 dark:text-amber-400",
    bgLight: "bg-amber-50/50 dark:bg-amber-950/20",
    borderLight: "border-amber-200 dark:border-amber-900/30",
    placeholderName: "contoh: Tukang Batu, Pekerja/Kuli, Mandor",
    placeholderUnit: "OH, hari, m2",
  },
  {
    key: "EQUIPMENT",
    label: "Peralatan",
    icon: Wrench,
    color: "text-purple-600 dark:text-purple-400",
    bgLight: "bg-purple-50/50 dark:bg-purple-950/20",
    borderLight: "border-purple-200 dark:border-purple-900/30",
    placeholderName: "contoh: Sewa Molen Beton, Scaffolding, Genset",
    placeholderUnit: "hari, unit, set",
  },
  {
    key: "OVERHEAD",
    label: "Overhead",
    icon: Receipt,
    color: "text-zinc-600 dark:text-zinc-400",
    bgLight: "bg-zinc-50 dark:bg-zinc-900/40",
    borderLight: "border-zinc-200 dark:border-zinc-800",
    placeholderName: "contoh: Listrik & Air Kerja, Keamanan Proyek, Kebersihan",
    placeholderUnit: "ls, bln",
  },
];

function formatRp(val: number): string {
  return `Rp ${val.toLocaleString("id-ID")}`;
}

export default function RabPage() {
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [rabItems, setRabItems] = useState<SerializedRabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI States
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SerializedRabItem | null>(null);
  const [viewingDetailItem, setViewingDetailItem] = useState<SerializedRabItem | null>(null);

  // Form Basic States
  const [parentId, setParentId] = useState<string>("");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [volume, setVolume] = useState<number | "">(1);
  const [unitPrice, setUnitPrice] = useState<number | "">(0);

  // Form Component Breakdown States
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState<ComponentCategory>("MATERIAL");

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const proj = await getOrCreateDefaultProject();
      setProject(proj);
      const items = await getRabItems(proj.id);
      setRabItems(items);
    } catch (error: unknown) {
      console.error("Error loading RAB data:", error);
      setErrorMsg("Gagal memuat data RAB. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Determine parent nodes
  const parentIdsSet = useMemo(() => {
    return new Set(rabItems.map((item) => item.parentId).filter((id): id is string => id !== null));
  }, [rabItems]);

  // Map items by ID
  const itemsMap = useMemo(() => {
    return new Map(rabItems.map((item) => [item.id, item]));
  }, [rabItems]);

  // Recalculate level of each item
  const getItemLevel = (item: SerializedRabItem): number => {
    let level = 0;
    let current = item;
    while (current.parentId) {
      const parent = itemsMap.get(current.parentId);
      if (parent) {
        level++;
        current = parent;
      } else {
        break;
      }
    }
    return level;
  };

  // Filter visible items according to collapsed parents
  const visibleItems = useMemo(() => {
    const isItemVisible = (item: SerializedRabItem): boolean => {
      let current = item;
      while (current.parentId) {
        if (collapsedIds.has(current.parentId)) {
          return false;
        }
        const parent = itemsMap.get(current.parentId);
        if (parent) {
          current = parent;
        } else {
          break;
        }
      }
      return true;
    };
    return rabItems.filter(isItemVisible);
  }, [rabItems, collapsedIds, itemsMap]);

  // Summary totals
  const totalRAB = project?.totalBudget || 0;
  const totalWeight = useMemo(() => {
    return rabItems
      .filter((item) => !item.parentId)
      .reduce((sum, item) => sum + item.weightPercentage, 0);
  }, [rabItems]);

  // Toggle expand/collapse
  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Form Breakdown Calculations ──────────────────────────────────────────
  const categorySubtotals = useMemo(() => {
    const res: Record<ComponentCategory, number> = {
      MATERIAL: 0,
      LABOR: 0,
      EQUIPMENT: 0,
      OVERHEAD: 0,
    };
    components.forEach((c) => {
      const vol = typeof c.volume === "number" ? c.volume : 0;
      const price = typeof c.unitPrice === "number" ? c.unitPrice : 0;
      res[c.category] += vol * price;
    });
    return res;
  }, [components]);

  const componentsGrandTotal = useMemo(() => {
    return (
      categorySubtotals.MATERIAL +
      categorySubtotals.LABOR +
      categorySubtotals.EQUIPMENT +
      categorySubtotals.OVERHEAD
    );
  }, [categorySubtotals]);

  const hasBreakdownComponents = components.some(
    (c) => c.name.trim() !== "" || (typeof c.unitPrice === "number" && c.unitPrice > 0)
  );

  // Auto-sync item total price when components change
  useEffect(() => {
    if (hasBreakdownComponents) {
      const numVol = typeof volume === "number" && volume > 0 ? volume : 1;
      setUnitPrice(componentsGrandTotal / numVol);
    }
  }, [componentsGrandTotal, hasBreakdownComponents, volume]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddClick = (parentItem?: SerializedRabItem) => {
    setErrorMsg(null);
    setEditingItem(null);
    setParentId(parentItem ? parentItem.id : "");

    if (parentItem) {
      const siblings = rabItems.filter((i) => i.parentId === parentItem.id);
      const nextIndex = siblings.length + 1;
      setItemCode(`${parentItem.itemCode}.${nextIndex}`);
      setUnit(parentItem.unit || "ls");
    } else {
      const topLevel = rabItems.filter((i) => !i.parentId);
      setItemCode(`${topLevel.length + 1}`);
      setUnit("ls");
    }

    setDescription("");
    setVolume(1);
    setUnitPrice(0);
    setComponents([]);
    setActiveCategoryTab("MATERIAL");
    setIsModalOpen(true);
  };

  const handleEditClick = (item: SerializedRabItem) => {
    setErrorMsg(null);
    setEditingItem(item);
    setParentId(item.parentId || "");
    setItemCode(item.itemCode);
    setDescription(item.description);
    setUnit(item.unit || "ls");
    setVolume(item.volume);
    setUnitPrice(item.unitPrice);

    if (item.components && item.components.length > 0) {
      setComponents(
        item.components.map((c) => ({
          id: c.id,
          category: c.category,
          name: c.name,
          unit: c.unit,
          volume: c.volume,
          unitPrice: c.unitPrice,
        }))
      );
    } else {
      setComponents([]);
    }

    setActiveCategoryTab("MATERIAL");
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!project) return;
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menghapus item ini? Menghapus item induk juga akan menghapus seluruh sub-item di dalamnya."
      )
    ) {
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      await deleteRabItem(id, project.id);
      await fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg("Gagal menghapus item RAB.");
    } finally {
      setActionLoading(false);
    }
  };

  // Component Row Management
  const addComponentRow = (cat: ComponentCategory) => {
    setComponents((prev) => [
      ...prev,
      {
        category: cat,
        name: "",
        unit: cat === "LABOR" ? "OH" : cat === "EQUIPMENT" ? "hari" : cat === "OVERHEAD" ? "ls" : "m3",
        volume: 1,
        unitPrice: 0,
      },
    ]);
  };

  const updateComponentRow = (
    index: number,
    field: keyof ComponentRow,
    value: string | number
  ) => {
    setComponents((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const removeComponentRow = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!itemCode || !description) {
      setErrorMsg("Kode Item dan Deskripsi Pekerjaan harus diisi.");
      return;
    }

    const validComponents = components
      .filter((c) => c.name.trim() !== "")
      .map((c) => {
        const cVol = typeof c.volume === "number" ? c.volume : 1;
        const cPrice = typeof c.unitPrice === "number" ? c.unitPrice : 0;
        return {
          id: c.id,
          category: c.category,
          name: c.name.trim(),
          unit: c.unit,
          volume: cVol,
          unitPrice: cPrice,
          totalPrice: cVol * cPrice,
        };
      });

    setActionLoading(true);
    setErrorMsg(null);
    try {
      await saveRabItem({
        id: editingItem?.id,
        projectId: project.id,
        parentId: parentId || null,
        itemCode,
        description,
        unit: unit || "ls",
        volume: typeof volume === "number" ? volume : 1,
        unitPrice: hasBreakdownComponents
          ? componentsGrandTotal / (typeof volume === "number" && volume > 0 ? volume : 1)
          : typeof unitPrice === "number"
          ? unitPrice
          : 0,
        components: validComponents,
      });
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan item RAB.");
    } finally {
      setActionLoading(false);
    }
  };

  // Eligible parents for dropdown
  const eligibleParents = useMemo(() => {
    if (!editingItem) return rabItems;
    const getDescendants = (id: string): string[] => {
      const direct = rabItems.filter((item) => item.parentId === id);
      const directIds = direct.map((item) => item.id);
      const sub = directIds.flatMap((cid) => getDescendants(cid));
      return [...directIds, ...sub];
    };
    const descendants = getDescendants(editingItem.id);
    const excludedIds = new Set([editingItem.id, ...descendants]);
    return rabItems.filter((item) => !excludedIds.has(item.id));
  }, [rabItems, editingItem]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {project ? project.name : "Memuat Proyek..."}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Master RAB &amp; Rincian Pos Biaya
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Kelola Bill of Quantities (BoQ) dengan rincian pos Material, Upah Tukang, Peralatan, dan Overhead (AHSP).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => handleAddClick()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Tambah Item RAB
          </button>
        </div>
      </div>

      {errorMsg && !isModalOpen && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Summary Header Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Total Nilai RAB Proyek
          </span>
          <div className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
            {loading ? "..." : formatRp(totalRAB)}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Akumulasi seluruh item BoQ</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Total Bobot Akumulasi
          </span>
          <div className="mt-1 text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            {loading ? "..." : `${totalWeight.toFixed(2)}%`}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Target bobot kumulatif (100%)</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Total Pos Material &amp; Upah
          </span>
          <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {loading
              ? "..."
              : formatRp(
                  rabItems
                    .filter((i) => !i.parentId)
                    .reduce((sum, i) => sum + i.materialSubtotal + i.laborSubtotal, 0)
                )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Alokasi fisik &amp; tukang</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Alat &amp; Overhead
          </span>
          <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {loading
              ? "..."
              : formatRp(
                  rabItems
                    .filter((i) => !i.parentId)
                    .reduce((sum, i) => sum + i.equipmentSubtotal + i.overheadSubtotal, 0)
                )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Alokasi alat &amp; operasional</p>
        </div>
      </div>

      {/* Tree Grid Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-950">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-900 dark:text-zinc-50" />
            <p className="text-sm">Memuat data RAB...</p>
          </div>
        ) : rabItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
            <Building2 className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium">Belum ada item RAB.</p>
            <button
              onClick={() => handleAddClick()}
              className="mt-2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Klik di sini untuk membuat item baru
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <th className="p-4 font-semibold w-24">Kode</th>
                  <th className="p-4 font-semibold min-w-[260px]">Deskripsi Pekerjaan &amp; Rincian AHSP</th>
                  <th className="p-4 font-semibold w-20 text-center">Satuan</th>
                  <th className="p-4 font-semibold w-24 text-right">Volume</th>
                  <th className="p-4 font-semibold w-36 text-right">Harga Satuan</th>
                  <th className="p-4 font-semibold w-40 text-right">Total Anggaran</th>
                  <th className="p-4 font-semibold w-24 text-right">Bobot (%)</th>
                  <th className="p-4 font-semibold w-32 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibleItems.map((item) => {
                  const hasChildren = parentIdsSet.has(item.id);
                  const isCollapsed = collapsedIds.has(item.id);
                  const level = getItemLevel(item);
                  const paddingLeft = level * 1.5;
                  const isCategory = item.volume === 0;
                  const hasComponents = item.components && item.components.length > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`group hover:bg-zinc-50/70 dark:hover:bg-zinc-900/20 transition-colors ${
                        isCategory
                          ? "bg-zinc-50/30 font-semibold dark:bg-zinc-900/5 text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      <td className="p-4 font-mono text-xs text-zinc-500 dark:text-zinc-400 align-top">
                        {item.itemCode}
                      </td>
                      <td className="p-4 align-top" style={{ paddingLeft: `${Math.max(1, paddingLeft)}rem` }}>
                        <div className="flex items-start gap-1.5">
                          {hasChildren ? (
                            <button
                              onClick={() => toggleCollapse(item.id)}
                              className="p-1 rounded-sm hover:bg-zinc-200/50 text-zinc-500 dark:hover:bg-zinc-850 mt-0.5"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-5 h-5 flex items-center justify-center text-zinc-400 font-mono text-xs mt-0.5">
                              {level > 0 && "└"}
                            </span>
                          )}
                          <div className="flex-1">
                            <div className={`flex items-center gap-2 ${isCategory ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-medium"}`}>
                              <span>{item.description}</span>
                              {hasComponents && (
                                <button
                                  onClick={() => setViewingDetailItem(item)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 bg-blue-50 rounded hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                                  title="Lihat rincian komponen material, upah, dll"
                                >
                                  <Layers className="h-3 w-3" />
                                  {item.components.length} Komponen
                                </button>
                              )}
                            </div>

                            {/* Cost Breakdown Pills */}
                            {hasComponents && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                {item.materialSubtotal > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 font-mono">
                                    <Package className="h-3 w-3 text-blue-500" />
                                    Mat: {formatRp(item.materialSubtotal)}
                                  </span>
                                )}
                                {item.laborSubtotal > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 font-mono">
                                    <Hammer className="h-3 w-3 text-amber-500" />
                                    Upah: {formatRp(item.laborSubtotal)}
                                  </span>
                                )}
                                {item.equipmentSubtotal > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 font-mono">
                                    <Wrench className="h-3 w-3 text-purple-500" />
                                    Alat: {formatRp(item.equipmentSubtotal)}
                                  </span>
                                )}
                                {item.overheadSubtotal > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-mono">
                                    <Receipt className="h-3 w-3 text-zinc-500" />
                                    Overhead: {formatRp(item.overheadSubtotal)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center align-top font-medium">
                        {item.unit || "-"}
                      </td>
                      <td className="p-4 text-right align-top font-mono text-xs">
                        {item.volume > 0 ? item.volume.toLocaleString("id-ID") : ""}
                      </td>
                      <td className="p-4 text-right align-top font-mono text-xs">
                        {item.unitPrice > 0 ? formatRp(item.unitPrice) : ""}
                      </td>
                      <td
                        className={`p-4 text-right align-top font-mono text-sm ${
                          isCategory
                            ? "font-bold text-zinc-900 dark:text-zinc-50"
                            : "font-semibold text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {formatRp(item.totalPrice)}
                      </td>
                      <td className="p-4 text-right align-top font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">
                        {item.weightPercentage.toFixed(3)}%
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex items-center justify-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          {isCategory && (
                            <button
                              onClick={() => handleAddClick(item)}
                              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-50"
                              title="Tambah Sub-Item"
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditClick(item)}
                            className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-50"
                            title="Edit Item & Rincian"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item.id)}
                            className="p-1.5 rounded-md hover:bg-zinc-150 text-rose-600 hover:text-rose-900 dark:hover:bg-zinc-800 dark:text-rose-450 dark:hover:text-rose-300"
                            title="Hapus Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Input / Edit RAB + Breakdown ───────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => !actionLoading && setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 z-10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-zinc-900 p-2 text-white dark:bg-zinc-50 dark:text-zinc-900">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {editingItem ? "Edit Item RAB & Rincian Pos Biaya" : "Tambah Item RAB Baru"}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Lengkapi info pekerjaan dan komponen analisa harga (AHSP)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                disabled={actionLoading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {/* 1. Basic Information */}
              <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  1. Informasi Pekerjaan RAB
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-8">
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Kategori Induk (Parent)
                    </label>
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      disabled={actionLoading}
                    >
                      <option value="">-- Tanpa Induk (Item Utama / Level 1) --</option>
                      {eligibleParents.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.itemCode} - {item.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Kode Item *
                    </label>
                    <input
                      type="text"
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value)}
                      placeholder="e.g. 1.1"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 font-mono"
                      required
                      disabled={actionLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Deskripsi Pekerjaan *
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contoh: TOILET, RUANG KANTOR DAN FLOOR LANTAI 1"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    required
                    disabled={actionLoading}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Satuan
                    </label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="ls, m2, m3, bh"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      disabled={actionLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Volume
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={volume}
                      onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="1"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 font-mono"
                      disabled={actionLoading}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                      Harga Satuan (Rp) {hasBreakdownComponents && <span className="text-[10px] text-blue-600 font-normal">(Otomatis)</span>}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="0"
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none ${
                        hasBreakdownComponents
                          ? "bg-blue-50/60 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200"
                          : "bg-white border-zinc-200 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 focus:border-zinc-900"
                      }`}
                      disabled={actionLoading || hasBreakdownComponents}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Breakdown Components (AHSP) */}
              <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-blue-600" />
                      2. Rincian Komponen Pos Biaya (AHSP)
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Isi rincian kebutuhan material, upah, alat, dan overhead. Total rincian akan otomatis menjadi total anggaran item ini.
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-zinc-400">Total Rincian:</span>
                    <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                      {formatRp(componentsGrandTotal)}
                    </div>
                  </div>
                </div>

                {/* Category Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {CATEGORY_TABS.map((tab) => {
                    const TabIcon = tab.icon;
                    const subtotal = categorySubtotals[tab.key];
                    const count = components.filter((c) => c.category === tab.key).length;
                    const isActive = activeCategoryTab === tab.key;

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveCategoryTab(tab.key)}
                        className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                          isActive
                            ? `${tab.bgLight} ${tab.borderLight} ring-2 ring-zinc-900 dark:ring-zinc-100`
                            : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold flex items-center gap-1.5 ${tab.color}`}>
                            <TabIcon className="h-3.5 w-3.5" />
                            {tab.label}
                          </span>
                          {count > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                              {count}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          {formatRp(subtotal)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Active Category Item Table */}
                {(() => {
                  const currentTabMeta = CATEGORY_TABS.find((t) => t.key === activeCategoryTab)!;
                  const filteredComponents = components
                    .map((c, originalIndex) => ({ ...c, originalIndex }))
                    .filter((c) => c.category === activeCategoryTab);

                  return (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          Daftar {currentTabMeta.label} ({filteredComponents.length} item)
                        </span>
                        <button
                          type="button"
                          onClick={() => addComponentRow(activeCategoryTab)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg dark:bg-blue-950/40 dark:text-blue-400 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Tambah Baris {currentTabMeta.label}
                        </button>
                      </div>

                      {filteredComponents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center gap-2">
                          <p className="text-xs text-zinc-400">
                            Belum ada rincian {currentTabMeta.label.toLowerCase()} untuk item ini.
                          </p>
                          <button
                            type="button"
                            onClick={() => addComponentRow(activeCategoryTab)}
                            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            + Tambah rincian {currentTabMeta.label.toLowerCase()}
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-850 dark:border-zinc-800 text-zinc-500">
                                <th className="p-2.5 text-left font-semibold">Nama Komponen / Uraian</th>
                                <th className="p-2.5 text-right font-semibold w-24">Vol / Jml</th>
                                <th className="p-2.5 text-left font-semibold w-20">Satuan</th>
                                <th className="p-2.5 text-right font-semibold w-32">Harga Satuan (Rp)</th>
                                <th className="p-2.5 text-right font-semibold w-32">Subtotal (Rp)</th>
                                <th className="p-2.5 text-center w-12">Hapus</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                              {filteredComponents.map((row) => {
                                const rowVol = typeof row.volume === "number" ? row.volume : 0;
                                const rowPrice = typeof row.unitPrice === "number" ? row.unitPrice : 0;
                                const rowSubtotal = rowVol * rowPrice;

                                return (
                                  <tr key={row.originalIndex} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={row.name}
                                        onChange={(e) =>
                                          updateComponentRow(row.originalIndex, "name", e.target.value)
                                        }
                                        placeholder={currentTabMeta.placeholderName}
                                        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={row.volume}
                                        onChange={(e) =>
                                          updateComponentRow(
                                            row.originalIndex,
                                            "volume",
                                            e.target.value === "" ? "" : Number(e.target.value)
                                          )
                                        }
                                        placeholder="1"
                                        className="w-full text-right rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 font-mono"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={row.unit}
                                        onChange={(e) =>
                                          updateComponentRow(row.originalIndex, "unit", e.target.value)
                                        }
                                        placeholder={currentTabMeta.placeholderUnit}
                                        className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                                      />
                                    </td>
                                    <td className="p-2">
                                      <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={row.unitPrice}
                                        onChange={(e) =>
                                          updateComponentRow(
                                            row.originalIndex,
                                            "unitPrice",
                                            e.target.value === "" ? "" : Number(e.target.value)
                                          )
                                        }
                                        placeholder="0"
                                        className="w-full text-right rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 font-mono"
                                      />
                                    </td>
                                    <td className="p-2 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                                      {formatRp(rowSubtotal)}
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => removeComponentRow(row.originalIndex)}
                                        className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                        title="Hapus baris"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Total Calculation Card */}
              <div className="rounded-xl bg-zinc-900 text-white p-4 dark:bg-zinc-800 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-300">
                  <span>Grand Total Akumulasi Komponen:</span>
                  <span className="font-mono">
                    Mat ({formatRp(categorySubtotals.MATERIAL)}) + Upah ({formatRp(categorySubtotals.LABOR)}) + Alat ({formatRp(categorySubtotals.EQUIPMENT)}) + Overhead ({formatRp(categorySubtotals.OVERHEAD)})
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-zinc-700 pt-2 font-bold text-sm">
                  <span>Nilai Anggaran Item RAB Terhitung:</span>
                  <span className="font-mono text-lg text-emerald-400">
                    {formatRp(
                      hasBreakdownComponents
                        ? componentsGrandTotal
                        : (typeof volume === "number" ? volume : 1) * (typeof unitPrice === "number" ? unitPrice : 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  disabled={actionLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Item & Rincian"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Detail View Rincian Komponen ───────────────────────────── */}
      {viewingDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
            onClick={() => setViewingDetailItem(null)}
          />
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 z-10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <span className="font-mono text-xs text-zinc-400">Item RAB {viewingDetailItem.itemCode}</span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  {viewingDetailItem.description}
                </h3>
              </div>
              <button
                onClick={() => setViewingDetailItem(null)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/20">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Material
                  </span>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                    {formatRp(viewingDetailItem.materialSubtotal)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Hammer className="h-3.5 w-3.5" /> Upah Tukang
                  </span>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                    {formatRp(viewingDetailItem.laborSubtotal)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-950/20">
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                    <Wrench className="h-3.5 w-3.5" /> Peralatan
                  </span>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                    {formatRp(viewingDetailItem.equipmentSubtotal)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/40">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                    <Receipt className="h-3.5 w-3.5" /> Overhead
                  </span>
                  <div className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-1 font-mono">
                    {formatRp(viewingDetailItem.overheadSubtotal)}
                  </div>
                </div>
              </div>

              {/* Grouped Component Tables */}
              {CATEGORY_TABS.map((tab) => {
                const TabIcon = tab.icon;
                const itemsInCat = viewingDetailItem.components.filter((c) => c.category === tab.key);
                if (itemsInCat.length === 0) return null;

                const subtotal = itemsInCat.reduce((s, c) => s + c.totalPrice, 0);

                return (
                  <div key={tab.key} className="space-y-2 rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-800">
                      <span className={`text-xs font-bold flex items-center gap-1.5 ${tab.color}`}>
                        <TabIcon className="h-3.5 w-3.5" />
                        {tab.label}
                      </span>
                      <span className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                        Subtotal: {formatRp(subtotal)}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400">
                            <th className="px-4 py-2 text-left font-medium">Uraian / Nama</th>
                            <th className="px-4 py-2 text-right font-medium w-24">Volume</th>
                            <th className="px-4 py-2 text-left font-medium w-20">Satuan</th>
                            <th className="px-4 py-2 text-right font-medium w-32">Harga Satuan</th>
                            <th className="px-4 py-2 text-right font-medium w-36">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                          {itemsInCat.map((c, idx) => (
                            <tr key={c.id || idx}>
                              <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">{c.name}</td>
                              <td className="px-4 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">{c.volume.toLocaleString("id-ID")}</td>
                              <td className="px-4 py-2 text-zinc-500">{c.unit || "-"}</td>
                              <td className="px-4 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">{formatRp(c.unitPrice)}</td>
                              <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-950 dark:text-zinc-50">{formatRp(c.totalPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Total Summary */}
              <div className="rounded-xl bg-zinc-900 p-4 text-white flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">Total Anggaran Item RAB</p>
                  <p className="text-xs text-zinc-500">{viewingDetailItem.itemCode} - {viewingDetailItem.description}</p>
                </div>
                <div className="text-xl font-extrabold text-emerald-400 font-mono">
                  {formatRp(viewingDetailItem.totalPrice)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-zinc-900/50">
              <button
                onClick={() => {
                  const target = viewingDetailItem;
                  setViewingDetailItem(null);
                  handleEditClick(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-900 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Rincian Ini
              </button>
              <button
                onClick={() => setViewingDetailItem(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
