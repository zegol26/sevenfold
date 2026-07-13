/**
 * Single source of truth for the Opportunity Analysis lifecycle.
 *
 * Used by BOTH the server action (`transitionOpportunityStatusAction`) that enforces
 * transitions and the dashboard UI that renders the available workflow actions, so
 * frontend affordances and backend rules cannot drift apart.
 *
 * Lifecycle (business plan §6.1): Draft → Submitted → Pricing Approved →
 * Ready for Cashflow → Approved. Approved is terminal; rework returns to Draft.
 */

export type OpportunityWorkflowTransition = {
  to: string;
  /** Stable identifier submitted as `workflow_action`. */
  action: string;
  /** Button label shown in the UI. */
  label: string;
  /** One-line explanation of what happens next. */
  description: string;
  /** Ask the user to confirm before executing (business consequences). */
  confirm?: string;
  /** Roles allowed to perform the transition (Super Admin always allowed). */
  roles: string[];
};

const ANALYSIS_ROLES = ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_SOLUTION_ARCHITECT", "ROLE_PROGRAM_DIRECTOR"];
const APPROVAL_ROLES = ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_PROGRAM_DIRECTOR"];
const COMMERCIAL_APPROVAL_ROLES = ["ROLE_NEXUS_ADMIN", "ROLE_FRAMEWORK_ADMIN", "ROLE_ACCOUNT_MANAGER", "ROLE_COMMERCIAL_MANAGER", "ROLE_PROGRAM_DIRECTOR"];

export const OPPORTUNITY_WORKFLOW_TRANSITIONS: Record<string, OpportunityWorkflowTransition[]> = {
  draft: [
    {
      to: "submitted",
      action: "submit",
      label: "Submit for Review",
      description: "Sends the opportunity analysis (scenarios, costs, risks) for pricing review.",
      roles: ANALYSIS_ROLES,
    },
  ],
  submitted: [
    {
      to: "pricing_approved",
      action: "approve_pricing",
      label: "Approve Pricing Structure",
      description: "Account Manager approval of the pricing structure decision.",
      confirm: "Approve the pricing structure for this opportunity? This makes it eligible for Cashflow Analysis.",
      roles: APPROVAL_ROLES,
    },
    {
      to: "draft",
      action: "return_to_draft",
      label: "Return to Draft",
      description: "Sends the opportunity back for rework.",
      confirm: "Return this opportunity to Draft for rework?",
      roles: ANALYSIS_ROLES,
    },
  ],
  pricing_approved: [
    {
      to: "ready_for_cashflow",
      action: "release_to_cashflow",
      label: "Release to Cashflow Analysis",
      description: "Opens the opportunity for Commercial Manager cashflow options.",
      roles: COMMERCIAL_APPROVAL_ROLES,
    },
    {
      to: "draft",
      action: "return_to_draft",
      label: "Return to Draft",
      description: "Sends the opportunity back for rework.",
      confirm: "Return this opportunity to Draft for rework?",
      roles: APPROVAL_ROLES,
    },
  ],
  ready_for_cashflow: [
    {
      to: "approved",
      action: "approve_opportunity",
      label: "Approve Opportunity",
      description: "Final commercial approval. Requires an approved cashflow option.",
      confirm: "Approve this opportunity? An approved cashflow option is required and the decision is recorded in the audit trail.",
      roles: COMMERCIAL_APPROVAL_ROLES,
    },
    {
      to: "draft",
      action: "return_to_draft",
      label: "Return to Draft",
      description: "Sends the opportunity back for rework.",
      confirm: "Return this opportunity to Draft for rework?",
      roles: APPROVAL_ROLES,
    },
  ],
  approved: [],
};

export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pricing_approved: "Pricing Approved",
  ready_for_cashflow: "Ready for Cashflow",
  approved: "Approved",
};

export const OPPORTUNITY_NEXT_STEP: Record<string, string> = {
  draft: "Build proposal scenarios, commodity costs, and the risk register, then submit for review.",
  submitted: "Record and approve the Pricing Structure Decision.",
  pricing_approved: "Release to Cashflow Analysis so the Commercial Manager can model options.",
  ready_for_cashflow: "Create and approve a cashflow option, then approve the opportunity.",
  approved: "Create the Sales Decision for Submission (SDS) for Sponsor approval.",
};

export function availableOpportunityTransitions(status: string, roleCode: string): OpportunityWorkflowTransition[] {
  const transitions = OPPORTUNITY_WORKFLOW_TRANSITIONS[status] || [];
  if (roleCode === "ROLE_SUPER_ADMIN") return transitions;
  return transitions.filter((transition) => transition.roles.includes(roleCode));
}
