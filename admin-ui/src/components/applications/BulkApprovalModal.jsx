import { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';
import { formatPersonName } from '../../utils/nameFormat';
import { getBulkApprovalEligibility } from '../../utils/applicantEligibility';

// Declared outside the component (not inline in render) — a component
// defined during render resets its state every re-render.
const ReasonList = ({ items }) => (
  <div style={{
    maxHeight: 220, overflowY: 'auto', margin: '12px 0', padding: '4px 14px',
    background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)',
  }}>
    {items.map(({ applicant, reasons }) => (
      <div key={applicant.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
        <strong>{formatPersonName(applicant)}</strong> — {reasons.join('; ')}
      </div>
    ))}
  </div>
);

// Bulk Approval Confirmation + Result, per Panel feedback #8/#9. Eligibility
// is computed with the SAME rule bulk approval must obey everywhere else
// (getBulkApprovalEligibility — a stricter wrapper around the individual
// Approve guardrail), so this never invents its own rules. Approval itself
// is delegated to `onApprove` (Applications.jsx), which calls updateApplicant
// once per eligible applicant — that's what gives each one its own Audit
// Trail entry, same as an individual approve.
export default function BulkApprovalModal({
  applicants,
  requirementsList,
  evaluationRubric,
  getRequirementVerification,
  onCancel,
  onApprove,
}) {
  const [step, setStep] = useState('confirm'); // 'confirm' | 'processing' | 'result'
  const [approvedCount, setApprovedCount] = useState(0);

  const evaluated = useMemo(
    () => applicants.map((applicant) => ({
      applicant,
      ...getBulkApprovalEligibility(applicant, requirementsList, evaluationRubric, getRequirementVerification),
    })),
    [applicants, requirementsList, evaluationRubric, getRequirementVerification]
  );

  const eligible = evaluated.filter((e) => e.eligible);
  const ineligible = evaluated.filter((e) => !e.eligible);

  const handleApprove = async () => {
    setStep('processing');
    await onApprove(eligible.map((e) => e.applicant));
    setApprovedCount(eligible.length);
    setStep('result');
  };

  return (
    <div className="modal-overlay" onClick={step === 'processing' ? undefined : onCancel}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{step === 'result' ? 'Bulk Approval Complete' : 'Bulk Approval Confirmation'}</h2>
          <button className="modal-close" onClick={onCancel} disabled={step === 'processing'}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {step !== 'result' ? (
            <>
              <p>You selected <strong>{applicants.length}</strong> applicant{applicants.length !== 1 ? 's' : ''}.</p>
              <p style={{ color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={16} /> {eligible.length} applicant{eligible.length !== 1 ? 's are' : ' is'} ready for approval.
              </p>
              {ineligible.length > 0 && (
                <>
                  <p style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={16} /> {ineligible.length} applicant{ineligible.length !== 1 ? 's' : ''} cannot be approved yet.
                  </p>
                  <ReasonList items={ineligible} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Ineligible applicants will be skipped, not approved.
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <p style={{ color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={16} /> {approvedCount} applicant{approvedCount !== 1 ? 's' : ''} approved successfully
              </p>
              {ineligible.length > 0 && (
                <>
                  <p style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={16} /> {ineligible.length} applicant{ineligible.length !== 1 ? 's' : ''} skipped
                  </p>
                  <ReasonList items={ineligible} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    You can still process skipped applicants individually from the table.
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {step !== 'result' ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={step === 'processing'}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={eligible.length === 0 || step === 'processing'}
                onClick={handleApprove}
              >
                {step === 'processing' ? 'Approving…' : `Approve Eligible Applicants (${eligible.length})`}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onCancel}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
