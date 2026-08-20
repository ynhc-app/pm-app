"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";

export type ComponentCategory = "MATERIAL" | "LABOR" | "EQUIPMENT" | "OVERHEAD";

export interface SerializedRabComponent {
  id?: string;
  rabItemId?: string;
  category: ComponentCategory;
  name: string;
  unit: string;
  volume: number;
  unitPrice: number;
  totalPrice: number;
}

// Type definitions to send clean JS numbers to Client Components (avoiding Prisma's Decimal serialization issues)
export interface SerializedRabItem {
  id: string;
  projectId: string;
  parentId: string | null;
  itemCode: string;
  description: string;
  unit: string;
  volume: number;
  unitPrice: number;
  totalPrice: number;
  weightPercentage: number;
  components: SerializedRabComponent[];
  materialSubtotal: number;
  laborSubtotal: number;
  equipmentSubtotal: number;
  overheadSubtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  clientName: string;
  totalBudget: number;
}

/**
 * Get or create a default construction project to ensure the app works immediately.
 */
export async function getOrCreateDefaultProject(): Promise<ProjectSummary> {
  let project = await db.project.findFirst();

  if (!project) {
    project = await db.project.create({
      data: {
        name: "Pembangunan Gedung TPA Nurul Hikmah",
        clientName: "Internal",
        startDate: new Date(),
        endDate: new Date("2027-02-28"),
        totalBudget: 0, // Will be calculated when RAB items are added
      },
    });

    // Seed some initial categories to make it look premium on first load
    const initialCategories = [
      { itemCode: "1", description: "Pekerjaan Persiapan", unit: "ls", volume: 0, unitPrice: 0 },
      { itemCode: "2", description: "Pekerjaan Pondasi & Beton Sloof", unit: "ls", volume: 0, unitPrice: 0 },
      { itemCode: "3", description: "Pekerjaan Dinding & Plesteran", unit: "ls", volume: 0, unitPrice: 0 },
    ];

    for (const cat of initialCategories) {
      await db.rabItem.create({
        data: {
          projectId: project.id,
          itemCode: cat.itemCode,
          description: cat.description,
          unit: cat.unit,
          volume: 0,
          unitPrice: 0,
          totalPrice: 0,
          weightPercentage: 0,
        },
      });
    }
  }

  return {
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    totalBudget: Number(project.totalBudget),
  };
}

/**
 * Get all RAB items for a specific project along with their resource breakdown components.
 */
export async function getRabItems(projectId: string): Promise<SerializedRabItem[]> {
  const items = await db.rabItem.findMany({
    where: { projectId },
    include: { components: true },
    orderBy: { itemCode: "asc" },
  });

  return items.map((item) => {
    const components: SerializedRabComponent[] = (item.components || []).map((c) => ({
      id: c.id,
      rabItemId: c.rabItemId,
      category: c.category as ComponentCategory,
      name: c.name,
      unit: c.unit || "",
      volume: Number(c.volume),
      unitPrice: Number(c.unitPrice),
      totalPrice: Number(c.totalPrice),
    }));

    const materialSubtotal = components.filter(c => c.category === "MATERIAL").reduce((s, c) => s + c.totalPrice, 0);
    const laborSubtotal = components.filter(c => c.category === "LABOR").reduce((s, c) => s + c.totalPrice, 0);
    const equipmentSubtotal = components.filter(c => c.category === "EQUIPMENT").reduce((s, c) => s + c.totalPrice, 0);
    const overheadSubtotal = components.filter(c => c.category === "OVERHEAD").reduce((s, c) => s + c.totalPrice, 0);

    return {
      id: item.id,
      projectId: item.projectId,
      parentId: item.parentId,
      itemCode: item.itemCode,
      description: item.description,
      unit: item.unit,
      volume: Number(item.volume),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      weightPercentage: Number(item.weightPercentage),
      components,
      materialSubtotal,
      laborSubtotal,
      equipmentSubtotal,
      overheadSubtotal,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  });
}

/**
 * Recursive function to recalculate the pricing tree and weights.
 * This runs on the server in a transaction to guarantee data consistency.
 */
async function recalculateProjectBudgetAndWeights(projectId: string) {
  // 1. Fetch all items
  const items = await db.rabItem.findMany({
    where: { projectId },
  });

  if (items.length === 0) {
    await db.project.update({
      where: { id: projectId },
      data: { totalBudget: 0 },
    });
    return;
  }

  // Map to hold item details for quick lookups and calculated totals
  const itemsMap = new Map<string, typeof items[0]>();
  const childrenMap = new Map<string, string[]>(); // parentId -> childIds[]
  
  items.forEach((item) => {
    itemsMap.set(item.id, item);
    if (item.parentId) {
      const children = childrenMap.get(item.parentId) || [];
      children.push(item.id);
      childrenMap.set(item.parentId, children);
    }
  });

  // Helper map to cache calculated total prices
  const calculatedTotals = new Map<string, number>();

  // Helper recursive function to compute total price for an item
  function calculateTotal(itemId: string): number {
    if (calculatedTotals.has(itemId)) {
      return calculatedTotals.get(itemId)!;
    }

    const item = itemsMap.get(itemId)!;
    const childIds = childrenMap.get(itemId);

    let total = 0;
    const manualTotal = Number(item.volume) * Number(item.unitPrice);

    if (childIds && childIds.length > 0) {
      // Selalu kalkulasi child-nya agar masuk ke dalam cache calculatedTotals
      const childrenSum = childIds.reduce((sum, cid) => sum + calculateTotal(cid), 0);
      
      // Jika parent ini di-set harga manualnya secara eksplisit (seperti proyek induk),
      // maka pertahankan harga induknya. Jika tidak, gunakan total dari child-child-nya.
      total = manualTotal > 0 ? manualTotal : childrenSum;
    } else {
      // Leaf node: Total adalah Volume * UnitPrice (atau Total Price tersimpan)
      total = Number(item.totalPrice) > 0 ? Number(item.totalPrice) : manualTotal;
    }

    calculatedTotals.set(itemId, total);
    return total;
  }

  // Calculate totals for all items
  items.forEach((item) => {
    calculateTotal(item.id);
  });

  // 2. Project budget is the sum of all top-level items' total prices
  const topLevelTotal = items
    .filter((item) => !item.parentId)
    .reduce((sum, item) => sum + (calculatedTotals.get(item.id) || 0), 0);

  // Update the project's total budget
  await db.project.update({
    where: { id: projectId },
    data: { totalBudget: topLevelTotal },
  });

  // 3. Update all RAB items with their computed totalPrice and weightPercentage
  const updates = items.map((item) => {
    const totalPrice = calculatedTotals.get(item.id) || 0;
    const weightPercentage = topLevelTotal > 0 ? (totalPrice / topLevelTotal) * 100 : 0;

    return db.rabItem.update({
      where: { id: item.id },
      data: {
        totalPrice,
        weightPercentage,
      },
    });
  });

  // Execute all updates in a transaction
  await db.$transaction(updates);
}

/**
 * Save (create or update) a RAB item along with its resource breakdown components.
 */
export async function saveRabItem(data: {
  id?: string;
  projectId: string;
  parentId: string | null;
  itemCode: string;
  description: string;
  unit: string;
  volume: number;
  unitPrice: number;
  components?: {
    id?: string;
    category: ComponentCategory;
    name: string;
    unit?: string;
    volume?: number;
    unitPrice?: number;
    totalPrice?: number;
  }[];
}) {
  await requireAdmin();
  const componentsList = (data.components || []).filter(c => c.name && c.name.trim() !== "");
  const hasComponents = componentsList.length > 0;
  
  // Calculate total from components if provided
  const componentsTotal = componentsList.reduce((sum, c) => {
    const cVol = Number(c.volume) || 1;
    const cPrice = Number(c.unitPrice) || 0;
    const cTotal = Number(c.totalPrice) > 0 ? Number(c.totalPrice) : (cVol * cPrice);
    return sum + cTotal;
  }, 0);

  let volume = Number(data.volume) || 0;
  let unitPrice = Number(data.unitPrice) || 0;
  let totalPrice = volume * unitPrice;

  if (hasComponents) {
    if (volume <= 0) volume = 1;
    totalPrice = componentsTotal;
    unitPrice = volume > 0 ? componentsTotal / volume : componentsTotal;
  }

  const payload = {
    projectId: data.projectId,
    parentId: data.parentId || null,
    itemCode: data.itemCode,
    description: data.description,
    unit: data.unit || (hasComponents ? "ls" : ""),
    volume,
    unitPrice,
    totalPrice,
    weightPercentage: 0, // Calculated during recalculation below
  };

  let targetId = data.id;

  if (data.id) {
    // Prevent setting parent to itself
    if (data.id === data.parentId) {
      throw new Error("Item tidak boleh menjadi sub-item dari dirinya sendiri.");
    }

    await db.rabItem.update({
      where: { id: data.id },
      data: payload,
    });

    // Replace components
    await db.rabComponent.deleteMany({
      where: { rabItemId: data.id },
    });
  } else {
    const created = await db.rabItem.create({
      data: payload,
    });
    targetId = created.id;
  }

  // Insert components
  if (componentsList.length > 0 && targetId) {
    await db.rabComponent.createMany({
      data: componentsList.map((c) => {
        const cVol = Number(c.volume) || 1;
        const cPrice = Number(c.unitPrice) || 0;
        const cTotal = Number(c.totalPrice) > 0 ? Number(c.totalPrice) : (cVol * cPrice);
        return {
          rabItemId: targetId!,
          category: c.category,
          name: c.name.trim(),
          unit: c.unit || "",
          volume: cVol,
          unitPrice: cPrice,
          totalPrice: cTotal,
        };
      }),
    });
  }

  // Recalculate parent values and weights for the entire project
  await recalculateProjectBudgetAndWeights(data.projectId);

  revalidatePath("/rab");
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/monitoring");
  revalidatePath("/reports");
}

/**
 * Delete a RAB item. Cascade delete is handled by database schema configuration (onDelete: Cascade).
 */
export async function deleteRabItem(id: string, projectId: string) {
  await requireAdmin();
  await db.rabItem.delete({
    where: { id },
  });

  // Recalculate totals and weights
  await recalculateProjectBudgetAndWeights(projectId);

  revalidatePath("/rab");
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
  revalidatePath("/monitoring");
  revalidatePath("/reports");
}
