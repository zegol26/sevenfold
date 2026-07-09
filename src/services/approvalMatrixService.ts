import "server-only";

import type { ApprovalRuleSetting } from "@/lib/types";
import { getActiveFrameworkSettings } from "@/services/frameworkSettingsService";

export type ApprovalMatrixRequest = {
  workflow: string;
  decision: string;
  valueUsd?: number;
};

export async function resolveApprovalRules(input: ApprovalMatrixRequest): Promise<ApprovalRuleSetting[]> {
  const config = await getActiveFrameworkSettings();
  const matrix = config.approvalMatrices.find((item) => (
    item.workflow === input.workflow &&
    item.decision === input.decision &&
    item.status === "active"
  ));
  if (!matrix) {
    throw new Error(`No active approval matrix for ${input.workflow} / ${input.decision}`);
  }

  return config.approvalRules
    .filter((rule) => rule.matrixId === matrix.id && rule.status === "active")
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
}

export async function requireApprovalMatrix(input: ApprovalMatrixRequest) {
  const rules = await resolveApprovalRules(input);
  if (!rules.length) {
    throw new Error(`Approval matrix ${input.workflow} / ${input.decision} has no active rules.`);
  }
  return rules;
}
