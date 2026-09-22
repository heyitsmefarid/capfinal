import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import { Edit, CheckCircle, XCircle, DollarSign, Eye, X } from 'lucide-react';
import { matchesExact, matchesSearch } from '../utils/filtering';
import { formatPersonName } from '../utils/nameFormat';
import { canEdit } from '../utils/auth';
import {
  getEffectiveTuition,
  getPerSemGranted,
  computeReflectedAmount,
  getGrantBreakdown,
} from '../utils/granting';
import Pagination from '../components/common/Pagination';
import SearchInput from '../components/common/SearchInput';
import EmptyState from '../components/common/EmptyState';

// Full scholarship financial/grant management — relocated out of Scholars.jsx's
// Scholar View modal (Pass 11). Scholar View keeps only a READ-ONLY "Granted
// per Semester" history (Pass 12); all editing and granting actions live
// here exclusively, consistent with the rest of the Scholars submenu
// (Attendance, Academic Records, Scholarship Timeline each get their own
// page too).
// Only scholars with Verified enrollment are eligible for granting — a
// scholar still "For Verification" (or with no enrollment verdict at all)
// must never be grantable. The UI below only reflects this; the actual
// restriction is enforced in AppContext's grantEligibleScholar(s), so it
// can't be bypassed by any caller.
const isGrantEligible = (scholar) => scholar?.enrollmentStatus === 'Verified';

const GRANT_FAILURE_REASON = {
  not_verified: 'Enrollment is not Verified.',
  no_active_term: 'No active school year/semester is set.',
  semester_cap: 'Already at the maximum number of scholarship semesters.',
  not_found: 'Scholar record not found.',
};

export default function Granting() {
  const { applicants, catalogSchools, catalogPrograms, schoolYears, systemSettings, updateApplicant, grantEligibleScholar, grantEligibleScholars } = useApp();
  // The admin-configured base cap (System Settings > General Config >
  // "Base Scholarship Grant / Tuition Cap") — threaded into every
  // getPerSemGranted/computeReflectedAmount call below so this page can
  // never disagree with Reports.jsx or the actual amount AppContext grants.
  const scholarshipCap = systemSettings?.scholarshipCap;
  const { onMenuClick } = useOutletContext() || {};
  const editAllowed = canEdit();

  // Same "who counts as a scholar" filter Scholars.jsx uses.
  const scholars = (applicants || []).filter((a) =>
    ['approved', 'active', 'on-hold', 'graduated', 'terminated'].includes(a.status)
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  // Same 'enrolled'/'not_enrolled' vocabulary as Scholars.jsx's own
  // Enrollment filter — 'enrolled' means Verified (the same condition
  // isGrantEligible checks), 'not_enrolled' covers For Verification / Not
  // Enrolled / no verdict yet.
  const [filterEnrollment, setFilterEnrollment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [isEditingFinancial, setIsEditingFinancial] = useState(false);
  const [financialData, setFinancialData] = useState({ tuitionFee: 0 });
  // Bulk-granting selection — only ever holds ids of Verified scholars (see
  // toggleSelectOne/toggleSelectAllOnPage below).
  const [selectedIds, setSelectedIds] = useState(new Set());

  const schoolFilterOptions = Array.from(new Set([
    ...(catalogSchools || []).map((s) => s?.name).filter(Boolean),
    ...scholars.map((s) => s?.school).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const programFilterOptions = Array.from(new Set([
    ...(catalogPrograms || []).map((p) => p?.name).filter(Boolean),
    ...scholars.map((s) => s?.program).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const filteredScholars = scholars.filter((scholar) => {
    const matchesSearchTerm = matchesSearch(
      [`${scholar.firstName} ${scholar.lastName}`, scholar.scholarId, scholar.email, scholar.school],
      searchTerm
    );
    const matchesEnrollment =
      !filterEnrollment ||
      (filterEnrollment === 'not_enrolled'
        ? scholar.enrollmentStatus !== 'Verified'
        : scholar.enrollmentStatus === 'Verified');
    return (
      matchesSearchTerm &&
      matchesExact(scholar.school, filterSchool) &&
      matchesExact(scholar.program, filterProgram) &&
      matchesExact(scholar.status, filterStatus) &&
      matchesEnrollment
    );
  });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedScholars = filteredScholars.slice(startIndex, startIndex + itemsPerPage);

  const openScholar = (scholar) => {
    setSelectedScholar(scholar);
    setIsEditingFinancial(false);
  };

  const eligiblePageIds = paginatedScholars.filter(isGrantEligible).map((s) => s.id);
  const allEligibleOnPageSelected =
    eligiblePageIds.length > 0 && eligiblePageIds.every((id) => selectedIds.has(id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allEligibleOnPageSelected) {
        eligiblePageIds.forEach((id) => next.delete(id));
      } else {
        eligiblePageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (scholar) => {
    if (!isGrantEligible(scholar)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(scholar.id)) next.delete(scholar.id);
      else next.add(scholar.id);
      return next;
    });
  };

  const handleGrantOne = async (scholar) => {
    if (!isGrantEligible(scholar)) {
      Swal.fire({
        icon: 'error',
        title: 'Not eligible',
        text: 'Only scholars with Verified enrollment can be granted.',
      });
      return;
    }
    const confirm = await Swal.fire({
      title: 'Grant this scholar?',
      html: `Grant <b>${formatPersonName(scholar)}</b> their currently active term?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Grant',
      confirmButtonColor: 'var(--primary)',
    });
    if (!confirm.isConfirmed) return;

    const result = grantEligibleScholar(scholar.id);
    if (result.ok) {
      Swal.fire({
        icon: 'success',
        title: result.alreadyGranted ? 'Already granted' : 'Granted!',
        text: result.alreadyGranted
          ? "This scholar's active term was already granted."
          : `${formatPersonName(scholar)} has been granted for the active term.`,
        timer: 1800,
        showConfirmButton: false,
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Could not grant',
        text: GRANT_FAILURE_REASON[result.reason] || 'Unknown error.',
      });
    }
  };

  const handleGrantSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirm = await Swal.fire({
      title: `Grant ${ids.length} scholar(s)?`,
      text: 'Each selected scholar will be granted their currently active term. Only scholars with Verified enrollment are affected.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Grant ${ids.length}`,
      confirmButtonColor: 'var(--primary)',
    });
    if (!confirm.isConfirmed) return;

    const results = grantEligibleScholars(ids);
    const granted = results.filter((r) => r.ok && !r.alreadyGranted).length;
    const already = results.filter((r) => r.ok && r.alreadyGranted).length;
    const failed = results.filter((r) => !r.ok).length;
    setSelectedIds(new Set());
    Swal.fire({
      icon: failed > 0 ? 'warning' : 'success',
      title: 'Bulk granting complete',
      html: `Granted: <b>${granted}</b><br/>Already granted: <b>${already}</b>${failed > 0 ? `<br/>Could not grant: <b>${failed}</b>` : ''}`,
    });
  };

  return (
    <div className="page granting-page">
      <Header
        title="Granting"
        subtitle="Scholarship financial/grant information"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="filters-bar">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search by name or Scholar ID..." />
          <select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
            <option value="">All Schools</option>
            {schoolFilterOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
            <option value="">All Programs</option>
            {programFilterOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="on-hold">On-Hold</option>
            <option value="graduated">Graduated</option>
            <option value="terminated">Terminated</option>
          </select>
          <select
            value={filterEnrollment}
            onChange={(e) => setFilterEnrollment(e.target.value)}
            title="Filter by enrollment verification — only Verified scholars are eligible for granting"
          >
            <option value="">All Enrollment</option>
            <option value="enrolled">Enrolled (Verified)</option>
            <option value="not_enrolled">Not Yet Verified</option>
          </select>
        </div>

        {editAllowed && (
          <div className="bulk-grant-bar">
            <span>{selectedIds.size} selected</span>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={selectedIds.size === 0}
              onClick={handleGrantSelected}
            >
              <CheckCircle size={14} />
              Grant Selected
            </button>
            <span className="bulk-grant-hint">Only scholars with Verified enrollment can be selected.</span>
          </div>
        )}

        <div className="table-container">
          {filteredScholars.length === 0 ? (
            <EmptyState icon={DollarSign} title="No scholars found" message="Try adjusting your search or filters." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {editAllowed && (
                    <th style={{ width: 32 }}>
                      <input
                        type="checkbox"
                        checked={allEligibleOnPageSelected}
                        disabled={eligiblePageIds.length === 0}
                        onChange={toggleSelectAllOnPage}
                        title="Select all eligible (Verified) scholars on this page"
                      />
                    </th>
                  )}
                  <th>Scholar Name</th>
                  <th>School</th>
                  <th>Program</th>
                  <th>Enrollment</th>
                  <th>Tuition Fee</th>
                  <th>Per Sem Granted</th>
                  <th>Total Granted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedScholars.map((scholar) => {
                  const perSemGranted = getPerSemGranted(scholar, catalogPrograms, scholarshipCap);
                  const { semesterRows } = getGrantBreakdown(scholar, perSemGranted);
                  const totalGranted = semesterRows.reduce((sum, row) => sum + row.grantedAmount, 0);
                  const eligible = isGrantEligible(scholar);
                  return (
                    <tr key={scholar.id}>
                      {editAllowed && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(scholar.id)}
                            disabled={!eligible}
                            onChange={() => toggleSelectOne(scholar)}
                            title={eligible ? 'Select for bulk granting' : 'Not eligible — enrollment is not Verified'}
                          />
                        </td>
                      )}
                      <td>
                        <strong>{scholar.lastName}, {scholar.firstName}</strong>
                        <br />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{scholar.scholarId || 'N/A'}</span>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{scholar.school}</td>
                      <td style={{ fontSize: '0.875rem' }}>{scholar.program}</td>
                      <td>
                        <span className={`enrollment-status-badge ${
                          scholar.enrollmentStatus === 'Verified'
                            ? 'verified'
                            : scholar.enrollmentStatus === 'Not Enrolled'
                            ? 'not-enrolled'
                            : 'unverified'
                        }`}>
                          {scholar.enrollmentStatus === 'Verified'
                            ? 'VERIFIED'
                            : scholar.enrollmentStatus === 'Not Enrolled'
                            ? 'NOT ENROLLED'
                            : 'FOR VERIFICATION'}
                        </span>
                      </td>
                      <td>₱{getEffectiveTuition(scholar, catalogPrograms).toLocaleString()}</td>
                      <td>₱{perSemGranted.toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>₱{totalGranted.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-sm btn-primary" onClick={() => openScholar(scholar)}>
                            {editAllowed ? <Edit size={16} /> : <Eye size={16} />}
                            {editAllowed ? 'View / Edit' : 'View'}
                          </button>
                          {editAllowed && (
                            <button
                              className="btn btn-sm"
                              title={eligible ? 'Grant this scholar their currently active term' : 'Not eligible — enrollment is not Verified'}
                              disabled={!eligible}
                              onClick={() => handleGrantOne(scholar)}
                              style={{
                                background: eligible ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                                color: eligible ? '#10b981' : 'var(--text-secondary)',
                                opacity: eligible ? 1 : 0.6,
                                cursor: eligible ? 'pointer' : 'not-allowed',
                              }}
                            >
                              <CheckCircle size={16} />
                              Grant
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filteredScholars.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredScholars.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            itemLabel="scholars"
          />
        )}
      </div>

      {selectedScholar && (
        <div className="modal-overlay" onClick={() => setSelectedScholar(null)}>
          <div className="modal scholar-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>{formatPersonName(selectedScholar)} — Granting</h2>
              <button className="close-btn" onClick={() => setSelectedScholar(null)}><X size={18} /></button>
            </div>

            <div className="modal-body">
              <div className="financial-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(45, 149, 150, 0.1)',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(45, 149, 150, 0.2)',
                }}>
                  <h4 style={{ margin: 0, color: 'var(--primary-light)', fontSize: '1.125rem', fontWeight: 700 }}>Financial Information</h4>
                  {editAllowed && (!isEditingFinancial ? (
                    <button
                      className="btn-edit-financial"
                      onClick={() => {
                        setIsEditingFinancial(true);
                        setFinancialData({ tuitionFee: getEffectiveTuition(selectedScholar, catalogPrograms) });
                      }}
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-success-sm"
                        onClick={async () => {
                          try {
                            const normalizedTuition = Math.max(0, Number(financialData.tuitionFee) || 0);
                            const reflectedAmount = computeReflectedAmount(
                              normalizedTuition,
                              selectedScholar.school,
                              selectedScholar.program,
                              catalogPrograms,
                              scholarshipCap
                            );

                            // The currently-active term's enrolledSemesters
                            // entry (if any) was locked in using whatever
                            // tuition fee was on file at the time — it hasn't
                            // actually been disbursed yet, so correct it to
                            // match the new rate too. Past/completed
                            // semesters stay frozen as historical record.
                            const activeSy = (schoolYears || []).find((s) => s.isActive);
                            const activeSem = activeSy?.semesters?.find((s) => s.isActive);
                            const enrolledSemesters = (selectedScholar.enrolledSemesters || []).map((entry) =>
                              activeSy && activeSem &&
                              entry.schoolYear === activeSy.label &&
                              entry.semester === activeSem.name &&
                              entry.status !== 'on_hold'
                                ? { ...entry, grantedAmount: reflectedAmount }
                                : entry
                            );

                            await updateApplicant(selectedScholar.id, {
                              tuitionFee: normalizedTuition,
                              amountGranted: reflectedAmount,
                              enrolledSemesters,
                            });
                            setSelectedScholar({
                              ...selectedScholar,
                              tuitionFee: normalizedTuition,
                              amountGranted: reflectedAmount,
                              enrolledSemesters,
                            });
                            setIsEditingFinancial(false);
                            Swal.fire({
                              icon: 'success',
                              title: 'Updated!',
                              text: 'Financial information updated successfully',
                              timer: 1500,
                              showConfirmButton: false,
                            });
                          } catch {
                            Swal.fire({
                              icon: 'error',
                              title: 'Error',
                              text: 'Failed to update financial information',
                            });
                          }
                        }}
                      >
                        <CheckCircle size={14} />
                        Save
                      </button>
                      <button className="btn btn-secondary-sm" onClick={() => setIsEditingFinancial(false)}>
                        <XCircle size={14} />
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
                <div className="financial-grid">
                  <div className="financial-item">
                    <span className="label">Tuition Fee</span>
                    {isEditingFinancial ? (
                      <input
                        type="number"
                        className="financial-input"
                        value={financialData.tuitionFee}
                        onChange={(e) => setFinancialData({ ...financialData, tuitionFee: Number(e.target.value) })}
                        placeholder="Enter tuition fee"
                      />
                    ) : (
                      <span className="value">₱{getEffectiveTuition(selectedScholar, catalogPrograms).toLocaleString()}</span>
                    )}
                  </div>
                  <div className="financial-item">
                    <span className="label">Per Sem Granted</span>
                    <span className="value">
                      ₱{(
                        isEditingFinancial
                          ? computeReflectedAmount(financialData.tuitionFee, selectedScholar.school, selectedScholar.program, catalogPrograms, scholarshipCap)
                          : getPerSemGranted(selectedScholar, catalogPrograms, scholarshipCap)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="financial-item">
                    <span className="label">Total Granted</span>
                    <span className="value" style={{
                      color: '#10b981',
                      fontWeight: 700,
                      fontSize: '1.25rem',
                      textShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                    }}>
                      ₱{(isEditingFinancial
                        // While editing, preview uses the new rate × disbursed sems
                        ? (selectedScholar.enrolledSemesters || []).filter((e) => e.status !== 'on_hold').length *
                          computeReflectedAmount(financialData.tuitionFee, selectedScholar.school, selectedScholar.program, catalogPrograms, scholarshipCap)
                        // Otherwise sum the actual grantedAmount stored per semester
                        : (selectedScholar.enrolledSemesters || []).reduce((sum, e) => {
                            if (e.status === 'on_hold') return sum;
                            return sum + (typeof e.grantedAmount === 'number' ? e.grantedAmount : getPerSemGranted(selectedScholar, catalogPrograms, scholarshipCap));
                          }, 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>

                {(() => {
                  const perSemGranted = isEditingFinancial
                    ? computeReflectedAmount(financialData.tuitionFee, selectedScholar.school, selectedScholar.program, catalogPrograms, scholarshipCap)
                    : getPerSemGranted(selectedScholar, catalogPrograms, scholarshipCap);
                  const { semesterRows } = getGrantBreakdown(selectedScholar, perSemGranted);
                  const totalGranted = semesterRows.reduce((sum, row) => sum + row.grantedAmount, 0);

                  return (
                    <div style={{ marginTop: '1rem' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Granted per Semester
                      </h5>

                      {semesterRows.length > 0 ? (
                        <div className="semester-records-container">
                          <table className="semester-records-table">
                            <thead>
                              <tr>
                                <th>School Year</th>
                                <th>Semester</th>
                                <th>Granted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {semesterRows.map((row, index) => (
                                <tr key={`${row.schoolYear}-${row.semester}-${index}`}>
                                  <td>{row.schoolYear}</td>
                                  <td>{row.semester}</td>
                                  <td>₱{row.grantedAmount.toLocaleString()}</td>
                                </tr>
                              ))}
                              <tr>
                                <td colSpan={2} style={{ fontWeight: 700 }}>Total Granted</td>
                                <td style={{ fontWeight: 700, color: '#10b981' }}>₱{totalGranted.toLocaleString()}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="coe-empty">
                          <p>No semester records available.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .granting-page {
          background: var(--bg-secondary);
        }

        .bulk-grant-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        .bulk-grant-hint {
          color: var(--text-secondary);
          font-size: 0.8125rem;
          margin-left: auto;
        }

        .financial-section h4 {
          font-size: 1.125rem;
          font-weight: 700;
        }

        .financial-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          background: var(--bg-primary);
          padding: 1.5rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border-color);
        }

        .financial-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .financial-item .label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.025em;
          margin-bottom: 0.25rem;
        }

        .financial-item .value {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .financial-input {
          padding: 0.75rem 1rem;
          border: 2px solid var(--border-color);
          border-radius: 0.5rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 1rem;
          font-weight: 600;
          width: 100%;
          transition: all 0.2s ease;
        }

        .financial-input:focus {
          outline: none;
          border-color: var(--primary);
          background: var(--bg-primary);
          box-shadow: 0 0 0 3px rgba(45, 149, 150, 0.2);
        }

        .btn-edit-financial {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(45, 149, 150, 0.3);
        }

        .btn-edit-financial:hover {
          background: var(--primary-dark);
          box-shadow: 0 4px 8px rgba(45, 149, 150, 0.4);
          transform: translateY(-1px);
        }

        .btn-success-sm,
        .btn-secondary-sm {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.625rem 1.25rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-success-sm {
          background: #10b981;
          color: white;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
        }

        .btn-success-sm:hover {
          background: #059669;
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
          transform: translateY(-1px);
        }

        .btn-secondary-sm {
          background: var(--text-secondary);
          color: var(--text-primary);
          border: 1px solid var(--secondary);
        }

        .btn-secondary-sm:hover {
          background: var(--bg-tertiary);
          border-color: var(--text-muted);
          color: white;
        }

        .semester-records-container {
          border-radius: 0.5rem;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }

        .semester-records-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .semester-records-table thead {
          background: var(--bg-secondary);
        }

        .semester-records-table th {
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          border-bottom: 1px solid var(--border-color);
        }

        .semester-records-table td {
          padding: 0.75rem 1rem;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        }

        .semester-records-table tbody tr:hover {
          background: rgba(45, 149, 150, 0.05);
        }

        .coe-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem;
          color: var(--text-secondary);
          background: var(--bg-primary);
          border-radius: 0.5rem;
          border: 1px dashed var(--border-color);
        }

        .coe-empty p {
          margin: 0;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
