"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getOrCreateDefaultProject } from "./rab";

export interface ProgressLogEntry {
  id: string;
  rabItemId: string;
  rabItemCode: string;
  rabItemDescription: string;
  weekNumber: number;
  logDate: string;
  progressPercentage: number;
}

export interface SCurveDataPoint {
  week: number;
  weekLabel: string;
  planned: number;     // Kumulatif rencana (%)
  actual: number | null;   // Kumulatif realisasi fisik (%)
  cost: number | null;     // Kumulatif realisasi biaya (%)
}

export interface RabItemForProgress {
  id: string;
  itemCode: string;
  description: string;
  weightPercentage: number;
  hasChildren: boolean;
  currentProgress: number; // progress for the selected week
}

/**
 * Get all leaf (non-parent) RAB items for progress input.
 */
export async function getRabItemsForProgress(weekNumber: number): Promise<RabItemForProgress[]> {
  const project = await getOrCreateDefaultProject();

  const allItems = await db.rabItem.findMany({
    where: { projectId: project.id },
    include: {
      progressLogs: {
        where: { weekNumber },
        select: { progressPercentage: true },
      },
    },
    orderBy: { itemCode: "asc" },
  });

  // Identify which items have children
  const parentIds = new Set(
    allItems.filter((i) => i.parentId !== null).map((i) => i.parentId as string)
  );

  // Return only leaf items (items that have no children) with weight > 0
  // Also include items that have an existing progress log for this week
  return allItems
    .filter((item) => !parentIds.has(item.id) && Number(item.weightPercentage) > 0)
    .map((item) => ({
      id: item.id,
      itemCode: item.itemCode,
      description: item.description,
      weightPercentage: Number(item.weightPercentage),
      hasChildren: parentIds.has(item.id),
      currentProgress:
        item.progressLogs.length > 0
          ? Number(item.progressLogs[0].progressPercentage)
          : 0,
    }));
}

/**
 * Save progress logs for a specific week (upsert per item).
 */
export async function saveWeeklyProgress(
  weekNumber: number,
  logDate: string,
  entries: { rabItemId: string; progressPercentage: number }[]
) {
  const logDateObj = new Date(logDate);

  // Upsert each entry
  for (const entry of entries) {
    const existing = await db.progressLog.findFirst({
      where: { rabItemId: entry.rabItemId, weekNumber },
    });

    if (existing) {
      await db.progressLog.update({
        where: { id: existing.id },
        data: {
          progressPercentage: entry.progressPercentage,
          logDate: logDateObj,
        },
      });
    } else {
      await db.progressLog.create({
        data: {
          rabItemId: entry.rabItemId,
          weekNumber,
          logDate: logDateObj,
          progressPercentage: entry.progressPercentage,
        },
      });
    }
  }

  revalidatePath("/monitoring");
  revalidatePath("/dashboard");
}

/**
 * Calculate S-Curve data for the project.
 *
 * Algorithm:
 * - Planned (%): Distributed linearly based on project duration.
 *   Each item contributes its weightPercentage spread over the project duration.
 *   Simplified: each week adds (100% / totalWeeks) until 100%.
 * - Actual (%): SUM(itemWeight * itemProgress / 100) for each week's logged progress.
 * - Cost (%): (totalExpenses up to week X / totalRAB) * 100.
 */
export async function getSCurveData(totalProjectWeeks: number = 26): Promise<SCurveDataPoint[]> {
  const project = await getOrCreateDefaultProject();

  // Get all RAB leaf items with their weights
  const allItems = await db.rabItem.findMany({
    where: { projectId: project.id },
    include: {
      progressLogs: {
        orderBy: { weekNumber: "asc" },
      },
    },
    orderBy: { itemCode: "asc" },
  });

  const allItemIds = new Set(allItems.map((i) => i.id));
  const parentIds = new Set(
    allItems.filter((i) => i.parentId && allItemIds.has(i.parentId)).map((i) => i.parentId as string)
  );
  const leafItems = allItems.filter((i) => !parentIds.has(i.id) && Number(i.weightPercentage) > 0);

  // Total weight of leaf items (should sum to ~100%)
  const totalWeight = leafItems.reduce((sum, i) => sum + Number(i.weightPercentage), 0);

  // Determine the last week with any progress log
  const allLogs = await db.progressLog.findMany({
    where: { rabItem: { projectId: project.id } },
    orderBy: { weekNumber: "desc" },
    take: 1,
  });
  const lastLoggedWeek = allLogs.length > 0 ? allLogs[0].weekNumber : 0;
  const maxWeek = Math.max(totalProjectWeeks, lastLoggedWeek);

  // Get all expenses grouped by week (based on transactionDate)
  const allExpenses = await db.expense.findMany({
    where: { projectId: project.id },
    select: { amount: true, transactionDate: true },
    orderBy: { transactionDate: "asc" },
  });

  const totalRAB = Number(project.totalBudget);

  // Get project start date from the project record
  const projectRecord = await db.project.findFirst({
    where: { id: project.id },
    select: { startDate: true },
  });
  const startDate = projectRecord?.startDate ?? new Date();

  // Map expenses to week numbers
  const expensesByWeek: Map<number, number> = new Map();
  for (const expense of allExpenses) {
    const weekNum = getWeekNumber(expense.transactionDate, startDate);
    expensesByWeek.set(weekNum, (expensesByWeek.get(weekNum) || 0) + Number(expense.amount));
  }

  // Build S-curve data points
  const dataPoints: SCurveDataPoint[] = [];
  let cumulativePlanned = 0;
  let cumulativeCostAmount = 0;

  // Build progress map: weekNumber -> { rabItemId -> progressPercentage }
  const progressByWeek: Map<number, Map<string, number>> = new Map();
  for (const item of leafItems) {
    for (const log of item.progressLogs) {
      if (!progressByWeek.has(log.weekNumber)) {
        progressByWeek.set(log.weekNumber, new Map());
      }
      progressByWeek.get(log.weekNumber)!.set(item.id, Number(log.progressPercentage));
    }
  }

  // Track cumulative progress per item (carry forward from previous weeks)
  const latestProgressPerItem: Map<string, number> = new Map();

  for (let week = 1; week <= maxWeek; week++) {
    // Planned: linear distribution
    const plannedIncrement = (totalWeight / maxWeek);
    cumulativePlanned = Math.min(100, cumulativePlanned + plannedIncrement);

    // Update latest progress for this week
    if (progressByWeek.has(week)) {
      for (const [itemId, progress] of progressByWeek.get(week)!) {
        latestProgressPerItem.set(itemId, progress);
      }
    }

    // Actual: sum of (itemWeight * itemProgress / 100) using latest known progress
    const hasAnyProgress = latestProgressPerItem.size > 0;
    let cumulativeActual: number | null = null;
    if (hasAnyProgress && week <= lastLoggedWeek) {
      cumulativeActual = 0;
      for (const item of leafItems) {
        const progress = latestProgressPerItem.get(item.id) || 0;
        cumulativeActual += (Number(item.weightPercentage) * progress) / 100;
      }
    }

    // Cost: cumulative expenses / total RAB
    const weekExpenses = expensesByWeek.get(week) || 0;
    cumulativeCostAmount += weekExpenses;
    const cumulativeCostPercent =
      totalRAB > 0 && week <= lastLoggedWeek
        ? (cumulativeCostAmount / totalRAB) * 100
        : null;

    const weekDate = new Date(startDate);
    weekDate.setDate(weekDate.getDate() + (week - 1) * 7);

    dataPoints.push({
      week,
      weekLabel: `Mg ${week}`,
      planned: parseFloat(cumulativePlanned.toFixed(2)),
      actual: cumulativeActual !== null ? parseFloat(cumulativeActual.toFixed(2)) : null,
      cost: cumulativeCostPercent !== null ? parseFloat(cumulativeCostPercent.toFixed(2)) : null,
    });
  }

  return dataPoints;
}

/**
 * Get the available weeks that have been logged.
 */
export async function getLoggedWeeks(): Promise<number[]> {
  const project = await getOrCreateDefaultProject();
  const logs = await db.progressLog.findMany({
    where: { rabItem: { projectId: project.id } },
    select: { weekNumber: true },
    distinct: ["weekNumber"],
    orderBy: { weekNumber: "asc" },
  });
  return logs.map((l) => l.weekNumber);
}

/**
 * Calculate which week number a date falls in relative to project start.
 */
function getWeekNumber(date: Date, startDate: Date): number {
  const diffMs = date.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil((diffDays + 1) / 7));
}
