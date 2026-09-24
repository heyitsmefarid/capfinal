import { useState } from 'react';
import Swal from 'sweetalert2';
import {
  X, Eye, Download, CheckCircle, XCircle, FileText, ClipboardCheck,
  FileCheck, Star, TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatPersonName } from '../../utils/nameFormat';
import { rubricMaxPoints, rubricColor, scorePercentage } from '../../utils/evaluationRubric';
import { promptScore, promptRubricLevel } from '../../utils/scoreDialogs';
import { getApprovalEligibility } from '../../utils/applicantEligibility';
import { fetchBfcspApplication } from '../../services/scholarshipApplications';
import { generateApplicationFormPdf } from '../../services/backendApi';
import { downloadBfcspFormPdf } from '../../utils/bfcspApplicationForm';

// The "Duly Accomplished Scholarship Application Form" requirement is filled
// out as an in-app form (BfcspApplicationFormScreen), not an uploaded
// document — it never has a fileUrl, by design. "Viewing" it means opening
// the same official PDF the scholar app and the Applications.jsx download
// button already generate from the applicant's real `scholarship_applications`
// record, not a fabricated file.
const APPLICATION_FORM_REQUIREMENT_KEY = 'applicationForm';

const SCORE_COLOR = (score, max) => {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.85) return '#22c55e';
  if (pct >= 0.65) return '#3b82f6';
  if (pct >= 0.45) return '#f59e0b';
  return '#ef4444';
};

const PercentBadge = ({ pct }) =>
  pct === null ? null : (
    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> ({pct}%)</span>
  );

// One applicant's full review — Requirements verification and Evaluation
// scoring side by side as tabs, instead of two disconnected pages (Panel
// feedback). Reuses the existing verify/reject/score business logic
// unchanged; Approve/Reject themselves are owned by Applications.jsx (it
// already has computeReflectedAmount + the confirmation copy) and passed in.
export default function RequirementsReviewModal({
  applicant,
  requirementsList,
  evaluationRubric,
  rank,
  poolSize,
  onClose,
  onApprove,
  onReject,
}) {
  const {
    getRequirementVerification, verifyRequirement, rejectRequirement, unverifyRequirement,
    updateApplicant,
  } = useApp();

  const [tab, setTab] = useState('requirements'); // 'requirements' | 'evaluation'
  // Which requirement's preview is open, by key — rendered directly under
  // that row (not appended after the whole list), so opening it is visible
  // without scrolling past every other requirement first.
  const [previewKey, setPreviewKey] = useState(null);
  // A document must be opened in the in-app preview at least once before its
  // Download link appears — "view before download", not just visual ordering
  // (same rule the old View-modal requirements section used).
  const [viewedKeys, setViewedKeys] = useState(() => new Set());
  const [loadingApplicationForm, setLoadingApplicationForm] = useState(false);

  // Opens the applicant's actual submitted application form — the same
  // official PDF Applications.jsx's "Download Form" button generates from
  // their real `scholarship_applications` record (fetchBfcspApplication),
  // just opened for viewing instead of forced to download. No fake file is
  // created; if the applicant has no record on file, this says so.
  const handleViewApplicationForm = async () => {
    setLoadingApplicationForm(true);
    try {
      const fullRecord = await fetchBfcspApplication(applicant);
      if (!fullRecord) {
        Swal.fire({
          icon: 'info',
          title: 'Application Form Not Found',
          text: "This applicant's submitted application form record could not be found.",
        });
        return;
      }
      const merged = { ...applicant, ...fullRecord };
      const blob = await generateApplicationFormPdf(merged);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        // Backend generator unreachable — fall back to the same client-side
        // generator Applications.jsx's download button falls back to.
        await downloadBfcspFormPdf(merged);
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Could Not Open Form',
        text: error.message || 'Unable to load the application form.',
      });
    } finally {
      setLoadingApplicationForm(false);
    }
  };

  const REQUIREMENTS_RUBRIC = evaluationRubric.requirementsRubric;
  const ECONOMIC_RUBRIC = evaluationRubric.economicRubric;
  const CUSTOM_CRITERIA = evaluationRubric.customCriteria || [];
  const requirementsMaxPoints = rubricMaxPoints(REQUIREMENTS_RUBRIC);
  const economicMaxPoints = rubricMaxPoints(ECONOMIC_RUBRIC);

  const visibleRequirements = requirementsList.filter(
    (r) => r.active || applicant?.requirements?.[r.key]
  );
  const submittedCount = visibleRequirements.filter((r) => applicant?.requirements?.[r.key]).length;

  const examScore = applicant.examScore || 0;
  const economicScore = applicant.economicScore || 0;
  const requirementsScore = applicant.requirementsScore ?? null;
  const ecoEntry = ECONOMIC_RUBRIC.find((r) => r.points === economicScore);
  const reqEntry = REQUIREMENTS_RUBRIC.find((r) => r.points === requirementsScore);

  const eligibility = getApprovalEligibility(
    applicant, requirementsList, evaluationRubric, getRequirementVerification
  );
  const totalScore = eligibility.totalScore ?? 0;
  const totalColor = eligibility.isFullyScored
    ? (totalScore >= 85 ? '#22c55e' : totalScore >= 75 ? '#3b82f6' : totalScore >= 60 ? '#f59e0b' : '#ef4444')
    : '#94a3b8';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{formatPersonName(applicant)}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {applicant.school} · {applicant.program}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setTab('requirements')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 0.9rem',
              border: 'none', borderBottom: tab === 'requirements' ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              color: tab === 'requirements' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <FileCheck size={15} /> Requirements ({submittedCount}/{visibleRequirements.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('evaluation')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 0.9rem',
              border: 'none', borderBottom: tab === 'evaluation' ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              color: tab === 'evaluation' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <ClipboardCheck size={15} /> Evaluation
          </button>
        </div>

        <div className="modal-body">
          {tab === 'requirements' && (
            <>
              {visibleRequirements.length > 0 ? (
                <div>
                  {visibleRequirements.map((requirement) => {
                    const rec = applicant.requirements?.[requirement.key];
                    const fileUrl = (rec && typeof rec === 'object' && rec.fileUrl) ? rec.fileUrl : null;
                    const fileName = (rec && typeof rec === 'object' && rec.fileName) ? rec.fileName : '';
                    const isImage = fileUrl
                      ? fileUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|webp)(\?|$|%3F)/i.test(fileUrl)
                      : false;
                    const verification = getRequirementVerification(applicant, requirement.key);
                    const hasViewed = viewedKeys.has(requirement.key);

                    const isPreviewOpen = previewKey === requirement.key;

                    const openPreview = () => {
                      if (!fileUrl) return;
                      // Toggle: clicking View again on an already-open preview closes it.
                      setPreviewKey((prev) => (prev === requirement.key ? null : requirement.key));
                      setViewedKeys((prev) => new Set(prev).add(requirement.key));
                    };

                    const handleVerify = () => verifyRequirement(applicant.id, requirement.key);

                    const handleReject = async () => {
                      const { value: reason } = await Swal.fire({
                        title: `Reject ${requirement.label}?`,
                        input: 'textarea',
                        inputLabel: 'Reason for rejection',
                        inputPlaceholder: 'Enter the reason this document is being rejected...',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: 'var(--danger)',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: 'Reject',
                        inputValidator: (v) => { if (!v || !v.trim()) return 'A reason is required.'; },
                      });
                      if (!reason) return;
                      rejectRequirement(applicant.id, requirement.key, reason.trim());
                    };

                    const handleReverify = async () => {
                      const result = await Swal.fire({
                        title: 'Reset Verification?',
                        text: `This will clear the current ${verification} status for "${requirement.label}" back to Pending Verification. Continue?`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: 'var(--primary)',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: 'Yes, reset it',
                      });
                      if (!result.isConfirmed) return;
                      unverifyRequirement(applicant.id, requirement.key);
                    };

                    const badge = {
                      verified: { label: 'Verified', bg: 'rgba(34,197,94,0.15)', color: '#86efac' },
                      rejected: { label: 'Rejected', bg: 'rgba(239,68,68,0.15)', color: '#fca5a5' },
                      pending_verification: { label: 'Pending Verification', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d' },
                      not_submitted: { label: 'Not Submitted', bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
                    }[verification] || { label: 'Pending Verification', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d' };

                    return (
                      <div key={requirement.key}>
                      <div className="submitted-requirement-item" style={{ flexWrap: 'wrap', rowGap: '8px' }}>
                        {rec ? <CheckCircle size={16} /> : <XCircle size={16} style={{ color: 'var(--text-muted)' }} />}
                        <span style={{ flex: 1 }}>
                          {requirement.label}
                          {fileName && (
                            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {fileName}
                            </span>
                          )}
                        </span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                          background: badge.bg, color: badge.color, flexShrink: 0,
                        }}>
                          {badge.label}
                        </span>
                        {fileUrl ? (
                          <>
                            {isImage ? (
                              <img
                                src={fileUrl}
                                alt={requirement.label}
                                style={{
                                  width: 44, height: 44, objectFit: 'cover',
                                  borderRadius: '0.375rem', cursor: 'pointer',
                                  border: '1px solid var(--border-color)',
                                }}
                                onClick={openPreview}
                              />
                            ) : (
                              <div
                                onClick={openPreview}
                                style={{
                                  width: 44, height: 44, display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', borderRadius: '0.375rem', cursor: 'pointer',
                                  border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                                }}>
                                <FileText size={20} />
                              </div>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              onClick={openPreview}
                            >
                              <Eye size={14} /> {isPreviewOpen ? 'Hide' : 'View'}
                            </button>
                            {hasViewed ? (
                              <a
                                href={fileUrl}
                                download={fileName || requirement.label}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Download size={14} /> Download
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                View to unlock download
                              </span>
                            )}
                            {verification === 'verified' ? (
                              <button type="button" className="btn btn-sm btn-secondary" onClick={handleReverify}>
                                Verified — Re-verify?
                              </button>
                            ) : (
                              <>
                                <button type="button" className="btn btn-sm btn-success" onClick={handleVerify}>
                                  Verify
                                </button>
                                <button type="button" className="btn btn-sm btn-danger" onClick={handleReject}>
                                  Reject
                                </button>
                              </>
                            )}
                          </>
                        ) : requirement.key === APPLICATION_FORM_REQUIREMENT_KEY && rec ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              onClick={handleViewApplicationForm}
                              disabled={loadingApplicationForm}
                            >
                              <Eye size={14} /> {loadingApplicationForm ? 'Opening…' : 'View Application Form'}
                            </button>
                            {verification === 'verified' ? (
                              <button type="button" className="btn btn-sm btn-secondary" onClick={handleReverify}>
                                Verified — Re-verify?
                              </button>
                            ) : (
                              <>
                                <button type="button" className="btn btn-sm btn-success" onClick={handleVerify}>
                                  Verify
                                </button>
                                <button type="button" className="btn btn-sm btn-danger" onClick={handleReject}>
                                  Reject
                                </button>
                              </>
                            )}
                          </>
                        ) : rec ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Submitted (no file)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Not yet submitted
                          </span>
                        )}
                      </div>

                      {/* Rendered directly under THIS row (not appended after
                          the whole list) so opening it is visible right away,
                          without scrolling past every other requirement. */}
                      {isPreviewOpen && (
                        <div style={{
                          margin: '4px 0 12px', padding: '1rem',
                          background: 'var(--bg-secondary)', borderRadius: '0.5rem',
                          border: '1px solid var(--border-color)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{requirement.label}</span>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => setPreviewKey(null)}
                            >✕ Close</button>
                          </div>
                          {isImage ? (
                            <img
                              src={fileUrl}
                              alt={requirement.label}
                              style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: '0.5rem', background: '#fff' }}
                            />
                          ) : (
                            // Browsers render PDFs (and most other viewable file
                            // types) natively inside an iframe — no extra library
                            // needed to satisfy "view in-browser before download".
                            <iframe
                              src={fileUrl}
                              title={requirement.label}
                              style={{ width: '100%', height: 420, border: '1px solid var(--border-color)', borderRadius: '0.5rem', background: '#fff' }}
                            />
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="no-submitted-requirements">No requirements configured.</p>
              )}
            </>
          )}

          {tab === 'evaluation' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {rank != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Star size={15} /> Rank #{rank}{poolSize ? ` of ${poolSize}` : ''}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                  <TrendingUp size={18} style={{ color: totalColor }} />
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: totalColor }}>{totalScore}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>/100</span>
                  {eligibility.isFullyScored ? (
                    <span style={{
                      padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                      background: `${totalColor}20`, color: totalColor,
                    }}>
                      {eligibility.meetsThreshold ? 'QUALIFIES' : 'BELOW THRESHOLD'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Scoring incomplete
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* Exam Score */}
                {evaluationRubric.examWeight > 0 && (
                  <div className="criterion-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>Exam Score</div>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: SCORE_COLOR(examScore, 100) }}>{examScore}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/100</span>
                      <PercentBadge pct={examScore > 0 ? scorePercentage(examScore, 100) : null} />
                    </div>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={async () => {
                        const score = await promptScore({
                          title: 'Examination Score',
                          subtitle: formatPersonName(applicant),
                          current: examScore > 0 ? examScore : undefined,
                        });
                        if (score !== undefined) updateApplicant(applicant.id, { examScore: score });
                      }}
                    >
                      {examScore > 0 ? 'Update' : 'Record'}
                    </button>
                  </div>
                )}

                {/* Requirements Score */}
                {evaluationRubric.requirementsWeight > 0 && (
                  <div className="criterion-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                        Requirements Score ({evaluationRubric.requirementsWeight}%)
                      </div>
                      {requirementsScore !== null ? (
                        <>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: rubricColor(REQUIREMENTS_RUBRIC, requirementsScore) }}>{requirementsScore}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {requirementsMaxPoints} pts</span>
                          <PercentBadge pct={scorePercentage(requirementsScore, requirementsMaxPoints)} />
                          {reqEntry && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{reqEntry.label}</div>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not scored</span>
                      )}
                    </div>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={async () => {
                        const s = await promptRubricLevel({
                          title: 'Completion of Requirements',
                          subtitle: formatPersonName(applicant),
                          rubric: REQUIREMENTS_RUBRIC,
                          current: requirementsScore ?? undefined,
                        });
                        if (s !== undefined) updateApplicant(applicant.id, { requirementsScore: s });
                      }}
                    >
                      {requirementsScore !== null ? 'Update' : 'Score'}
                    </button>
                  </div>
                )}

                {/* Economic Background */}
                {evaluationRubric.economicWeight > 0 && (
                  <div className="criterion-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                        Economic Background ({evaluationRubric.economicWeight}%)
                      </div>
                      {economicScore > 0 ? (
                        <>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: rubricColor(ECONOMIC_RUBRIC, economicScore) }}>{economicScore}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {economicMaxPoints} pts</span>
                          <PercentBadge pct={scorePercentage(economicScore, economicMaxPoints)} />
                          {ecoEntry && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {ecoEntry.label} — Cedula: {ecoEntry.cedula} · Bills: {ecoEntry.electric}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not rated</span>
                      )}
                    </div>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={async () => {
                        const s = await promptRubricLevel({
                          title: 'Economic Background',
                          subtitle: formatPersonName(applicant),
                          rubric: ECONOMIC_RUBRIC,
                          current: economicScore > 0 ? economicScore : undefined,
                          showRanges: true,
                        });
                        if (s !== undefined) updateApplicant(applicant.id, { economicScore: s });
                      }}
                    >
                      {economicScore > 0 ? 'Update' : 'Rate'}
                    </button>
                  </div>
                )}

                {/* Admin-added custom criteria */}
                {CUSTOM_CRITERIA.map((c) => {
                  const rawScore = applicant.customCriteriaScores?.[c.id];
                  const hasScore = rawScore !== undefined && rawScore !== null;
                  const entryLabel = c.type === 'rubric' ? c.rubric.find((r) => r.points === rawScore)?.label : null;
                  const criterionMaxPoints = c.type === 'rubric' ? rubricMaxPoints(c.rubric) : 100;
                  return (
                    <div className="criterion-row" key={c.id}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>{c.name} ({c.weight}%)</div>
                        {hasScore ? (
                          <>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{rawScore}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {criterionMaxPoints} pts</span>
                            <PercentBadge pct={scorePercentage(rawScore, criterionMaxPoints)} />
                            {entryLabel && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{entryLabel}</div>}
                          </>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not scored</span>
                        )}
                      </div>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={async () => {
                          let value;
                          if (c.type === 'rubric') {
                            value = await promptRubricLevel({
                              title: c.name, subtitle: formatPersonName(applicant),
                              rubric: c.rubric, current: hasScore ? rawScore : undefined,
                            });
                          } else {
                            value = await promptScore({
                              title: c.name, subtitle: formatPersonName(applicant),
                              current: hasScore ? rawScore : undefined,
                            });
                          }
                          if (value !== undefined) {
                            updateApplicant(applicant.id, {
                              customCriteriaScores: { ...(applicant.customCriteriaScores || {}), [c.id]: value },
                            });
                          }
                        }}
                      >
                        {hasScore ? 'Update' : 'Score'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {!eligibility.eligible && (
                <div style={{
                  marginTop: '1.25rem', padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  fontSize: '0.82rem', color: '#fcd34d',
                }}>
                  <strong>Not ready for approval:</strong> {eligibility.reasons.join('; ')}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button className="btn btn-sm btn-danger" onClick={() => onReject(applicant)}>
                  <XCircle size={14} /> Reject
                </button>
                <button className="btn btn-sm btn-success" onClick={() => onApprove(applicant)}>
                  <CheckCircle size={14} /> Approve
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      <style>{`
        .criterion-row {
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px;
          background: var(--bg-secondary);
        }
      `}</style>
    </div>
  );
}
