"use server";

import { db } from "@/lib/db";
import { getOrCreateDefaultProject, getRabItems } from "./rab";
import { getExpenses, getBudgetVariances } from "./expenses";
import { getSCurveData } from "./monitoring";

export async function getFullReportData() {
  const project = await getOrCreateDefaultProject();
  const [rabItems, expenses, variances, scurve] = await Promise.all([
    getRabItems(project.id),
    getExpenses(),
    getBudgetVariances(),
    getSCurveData(),
  ]);

  return {
    project,
    rabItems,
    expenses,
    variances,
    scurve,
  };
}
