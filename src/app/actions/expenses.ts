"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getOrCreateDefaultProject } from "./rab";

export type ExpenseCategory = "MATERIAL" | "LABOR" | "EQUIPMENT" | "OVERHEAD";

export interface SerializedExpense {
  id: string;
  projectId: string;
  rabItemId: string | null;
  rabItemDescription: string | null;
  category: ExpenseCategory;
  vendorName: string;
  volume: number | null;
  unitPrice: number | null;
  unit: string | null;
  amount: number;
  transactionDate: string;
  proofImageUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BudgetVariance {
  rabItemId: string;
  rabItemCode: string;
  rabItemDescription: string;
  rabItemUnit: string;
  
  // Cost Tracking
  budgetAmount: number;    // dari totalPrice RAB
  spentAmount: number;     // dari sum expenses amount
  remainingAmount: number;
  costVariancePercent: number;
  isOverBudget: boolean;

  // Volume Tracking
  budgetVolume: number;    // dari volume RAB
  spentVolume: number;     // dari sum expenses volume
  remainingVolume: number;
  volumeVariancePercent: number;
  isVolumeOver: boolean;
}

/**
 * Get all expenses for the default project, optionally filtered.
 */
export async function getExpenses(filters?: {
  category?: ExpenseCategory | "ALL";
  dateFrom?: string;
  dateTo?: string;
}): Promise<SerializedExpense[]> {
  const project = await getOrCreateDefaultProject();

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { projectId: project.id };

  if (filters?.category && filters.category !== "ALL") {
    where.category = filters.category;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.transactionDate = {};
    if (filters.dateFrom) {
      where.transactionDate.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      // Include the full day for dateTo
      const endDate = new Date(filters.dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.transactionDate.lte = endDate;
    }
  }

  const expenses = await db.expense.findMany({
    where,
    include: {
      rabItem: {
        select: { description: true, itemCode: true },
      },
    },
    orderBy: { transactionDate: "desc" },
  });

  return expenses.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    rabItemId: e.rabItemId,
    rabItemDescription: e.rabItem
      ? `${e.rabItem.itemCode} - ${e.rabItem.description}`
      : null,
    category: e.category as ExpenseCategory,
    vendorName: e.vendorName,
    volume: e.volume ? Number(e.volume) : null,
    unitPrice: e.unitPrice ? Number(e.unitPrice) : null,
    unit: e.unit,
    amount: Number(e.amount),
    transactionDate: e.transactionDate.toISOString().split("T")[0],
    proofImageUrl: e.proofImageUrl,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  }));
}

/**
 * Get expense summary by category.
 */
export async function getExpenseSummary(): Promise<{
  total: number;
  byCategory: { category: string; amount: number }[];
}> {
  const project = await getOrCreateDefaultProject();

  const expenses = await db.expense.findMany({
    where: { projectId: project.id },
    select: { category: true, amount: true },
  });

  const byCategory: Record<string, number> = {};
  let total = 0;

  for (const e of expenses) {
    const cat = e.category;
    byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);
    total += Number(e.amount);
  }

  return {
    total,
    byCategory: Object.entries(byCategory).map(([category, amount]) => ({
      category,
      amount,
    })),
  };
}

/**
 * Get budget variance per RAB item (items that have linked expenses).
 */
export async function getBudgetVariances(): Promise<BudgetVariance[]> {
  const project = await getOrCreateDefaultProject();

  // Get all RAB items that have at least one expense
  const rabItemsWithExpenses = await db.rabItem.findMany({
    where: {
      projectId: project.id,
      expenses: { some: {} },
    },
    include: {
      expenses: {
        select: { amount: true, volume: true },
      },
    },
  });

  return rabItemsWithExpenses.map((item) => {
    // Cost calculations
    const budgetAmount = Number(item.totalPrice);
    const spentAmount = item.expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0
    );
    const remainingAmount = budgetAmount - spentAmount;
    const costVariancePercent =
      budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
    const isOverBudget = spentAmount > budgetAmount;

    // Volume calculations
    const budgetVolume = Number(item.volume);
    const spentVolume = item.expenses.reduce(
      (sum, e) => sum + (e.volume ? Number(e.volume) : 0),
      0
    );
    const remainingVolume = budgetVolume - spentVolume;
    const volumeVariancePercent =
      budgetVolume > 0 ? (spentVolume / budgetVolume) * 100 : 0;
    const isVolumeOver = spentVolume > budgetVolume;

    return {
      rabItemId: item.id,
      rabItemCode: item.itemCode,
      rabItemDescription: item.description,
      rabItemUnit: item.unit,
      
      budgetAmount,
      spentAmount,
      remainingAmount,
      costVariancePercent,
      isOverBudget,

      budgetVolume,
      spentVolume,
      remainingVolume,
      volumeVariancePercent,
      isVolumeOver,
    };
  });
}

/**
 * Save (create or update) an expense.
 */
export async function saveExpense(data: {
  id?: string;
  rabItemId: string | null;
  category: ExpenseCategory;
  vendorName: string;
  volume?: number | null;
  unitPrice?: number | null;
  unit?: string | null;
  amount: number;
  transactionDate: string;
  proofImageUrl: string | null;
  notes: string | null;
}) {
  const project = await getOrCreateDefaultProject();

  const payload = {
    projectId: project.id,
    rabItemId: data.rabItemId || null,
    category: data.category,
    vendorName: data.vendorName,
    volume: data.volume ?? null,
    unitPrice: data.unitPrice ?? null,
    unit: data.unit || null,
    amount: data.amount,
    transactionDate: new Date(data.transactionDate),
    proofImageUrl: data.proofImageUrl || null,
    notes: data.notes || null,
  };

  if (data.id) {
    await db.expense.update({ where: { id: data.id }, data: payload });
  } else {
    await db.expense.create({ data: payload });
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

/**
 * Delete an expense.
 */
export async function deleteExpense(id: string) {
  await db.expense.delete({ where: { id } });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export interface ImportExpenseRow {
  rabItemId: string | null;
  category: ExpenseCategory;
  vendorName: string;
  volume: number | null;
  unitPrice: number | null;
  unit: string | null;
  amount: number;
  transactionDate: string; // YYYY-MM-DD
  notes: string | null;
}

/**
 * Bulk-import expenses from Excel.
 * Returns { imported, errors } counts.
 */
export async function importExpenses(
  rows: ImportExpenseRow[]
): Promise<{ imported: number; errors: number }> {
  const project = await getOrCreateDefaultProject();
  let imported = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      await db.expense.create({
        data: {
          projectId: project.id,
          rabItemId: row.rabItemId || null,
          category: row.category,
          vendorName: row.vendorName,
          volume: row.volume ?? null,
          unitPrice: row.unitPrice ?? null,
          unit: row.unit || null,
          amount: row.amount,
          transactionDate: new Date(row.transactionDate),
          proofImageUrl: null,
          notes: row.notes || null,
        },
      });
      imported++;
    } catch {
      errors++;
    }
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { imported, errors };
}
