// Single source of truth for "is this applicant ready to be approved?" —
// used by the per-applicant Approve button (Requirements Review modal) AND
// Bulk Approval, so the two paths can never disagree (Panel feedback:
// integrate Applications + Application Evaluation into one workflow).
//
// Two layers:
//  - getApprovalEligibility: the individual-approve rule. An admin can still
//    approve a fully-scored-but-below-threshold applicant one at a time,
//    past a required typed justification (see Applications.jsx) — that's
//    not a blocker here, just reported via `meetsThreshold`.
//  - getBulkApprovalEligibility: wraps the above and ALSO requires the
//    qualifying threshold, since bulk approval never bypasses the
//    below-threshold justification step — those applicants are skipped
//    instead, and remain approvable individually.
import { computeTotalScore } from './evaluationRubric';

export const QUALIFYING_SCORE_THRESHOLD = 75;

const pluralize = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// `requirementsList` is the admin-managed catalog (REQUIREMENTS_LIST in
// Applications.jsx): [{ key, label, active }]. Only currently-active
// requirements can block approval — an archived requirement never counts as
// missing, matching visibleRequirementsFor's convention elsewhere.
export function getApprovalEligibility(applicant, requirementsList, evaluationRubric, getRequirementVerification) {
  const reasons = [];
  const activeRequirements = (requirementsList || []).filter((r) => r.active !== false);

  const notSubmitted = activeRequirements.filter((r) => !applicant?.requirements?.[r.key]);
  if (notSubmitted.length > 0) {
    reasons.push(`${pluralize(notSubmitted.length, 'requirement')} not yet submitted`);
  }

  const submitted = activeRequirements.filter((r) => applicant?.requirements?.[r.key]);
  const unverified = submitted.filter(
    (r) => getRequirementVerification(applicant, r.key) !== 'verified'
  );
  if (unverified.length > 0) {
    reasons.push(`${pluralize(unverified.length, 'requirement')} submitted but not yet verified`);
  }

  const hasExamScore = (applicant?.examScore || 0) > 0;
  const hasEconomicScore = (applicant?.economicScore || 0) > 0;
  const hasRequirementsScore = (applicant?.requirementsScore ?? null) !== null;
  if (!hasExamScore) reasons.push('Exam score missing');
  if (!hasEconomicScore) reasons.push('Economic Background score missing');
  if (!hasRequirementsScore) reasons.push('Requirements score missing');

  const isFullyScored = hasExamScore && hasEconomicScore && hasRequirementsScore;
  const totalScore = isFullyScored ? computeTotalScore(applicant, evaluationRubric) : null;
  const meetsThreshold = isFullyScored && totalScore >= QUALIFYING_SCORE_THRESHOLD;

  return {
    eligible: reasons.length === 0,
    isFullyScored,
    meetsThreshold,
    totalScore,
    reasons,
  };
}

// Stricter variant for Bulk Approval — see file header. Never mutates the
// base result; below-threshold is appended as its own reason only here, so
// individual approval's `reasons` stays exactly "what's actually blocking".
export function getBulkApprovalEligibility(applicant, requirementsList, evaluationRubric, getRequirementVerification) {
  const base = getApprovalEligibility(applicant, requirementsList, evaluationRubric, getRequirementVerification);
  if (base.eligible && !base.meetsThreshold) {
    return {
      ...base,
      eligible: false,
      reasons: [
        ...base.reasons,
        `Below qualifying threshold (${base.totalScore}/100) — needs individual review with justification`,
      ],
    };
  }
  return base;
}
