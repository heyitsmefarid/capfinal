import { useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import { Search, FileCheck, FileText, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, ShieldAlert } from 'lucide-react';
import { matchesSearch, matchesExact } from '../utils/filtering';
import { formatPersonName } from '../utils/nameFormat';
import { getSchoolDisplayLabel } from '../utils/schoolAbbreviations';
import SchoolLabel from '../components/common/SchoolLabel';

// A scholar/applicant status a person can hold once approved into the
// program — same list Applications.jsx/Scholars.jsx already use to tell
// "still an applicant" apart from "already a scholar".
const SCHOLAR_STATUSES = ['approved', 'active', 'on-hold', 'graduated', 'terminated'];

// Centralized "what needs an admin's eyes right now" queue. Reuses the
// EXISTING verification state machine end to end — getRequirementVerification
// and getCorVerification (both from AppContext.jsx) are the same functions
// Applications.jsx's RequirementsReviewModal and Scholars.jsx's COR-per-
// Semester section already call. This page does not decide what "pending
// verification" or "rejected" mean — it only collects the applicants/
// scholars already in those states and gives them one clickable list,
// deep-linking into the SAME review modals for the actual verify/reject
// action (and therefore the same audit trail logging, the same preview-
// before-download behavior, and the same guardrails).
export default function NeedsVerification() {
  const { applicants, catalogRequirements, getRequirementVerification, getCorVerification } = useApp();
  const { onMenuClick } = useOutletContext() || {};
  const navigate = useNavigate();

  // Same derivation Applications.jsx uses for its own REQUIREMENTS_LIST —
  // not re-implemented, just recomputed locally from the same catalog (the
  // existing convention in this codebase for small derived lists; see
  // schoolFilterOptions in Scholars.jsx/AcademicRecords.jsx/Reports.jsx).
  const REQUIREMENTS_LIST = (catalogRequirements || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(r => ({ key: r.id, label: r.name, active: r.active !== false }));

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState(''); // '' | 'Requirement' | 'COR'
  const [filterSchool, setFilterSchool] = useState('');
  // Default view is exactly "needs verification" (pending only) — rejected
  // items are a deliberate secondary view, never folded into the default
  // queue (a rejected doc only becomes "needs verification" again once the
  // applicant/scholar resubmits, which flips it back to pending_verification
  // automatically — see deriveVerificationStatus in AppContext.jsx).
  const [filterStatus, setFilterStatus] = useState('pending_verification');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ column: 'name', direction: 'asc' });

  // Builds one flat row per outstanding item (one requirement, or one COR
  // submission for one term) — never one row per applicant, so the list
  // stays a compact, scannable queue instead of a wide per-person table.
  const verificationItems = useMemo(() => {
    const items = [];

    applicants.forEach((applicant) => {
      // Requirements only matter while the person is still being evaluated —
      // once approved, the approval eligibility gate (applicantEligibility.js)
      // already required every submitted requirement to be verified, so a
      // scholar/graduate/terminated record should never carry a pending one.
      if (!SCHOLAR_STATUSES.includes(applicant.status)) {
        REQUIREMENTS_LIST.filter((r) => r.active).forEach((req) => {
          if (!applicant?.requirements?.[req.key]) return; // not submitted — nothing to verify yet
          const status = getRequirementVerification(applicant, req.key);
          if (status === 'pending_verification' || status === 'rejected') {
            items.push({
              id: `req-${applicant.id}-${req.key}`,
              kind: 'Requirement',
              label: req.label,
              applicant,
              status,
            });
          }
        });
      }

      // COR — every submitted term, regardless of current status, so a
      // scholar who submitted COR before going on-hold/terminated still
      // surfaces here if it was never verified.
      (applicant.corSubmissions || []).forEach((sub) => {
        if (!sub?.fileUrl) return;
        const termKey = `${sub.academicYear}::${sub.semester}`;
        const status = getCorVerification(applicant, termKey);
        if (status === 'pending_verification' || status === 'rejected') {
          items.push({
            id: `cor-${applicant.id}-${termKey}`,
            kind: 'COR',
            label: `COR — ${sub.semester || 'N/A'}, ${sub.academicYear || 'N/A'}`,
            applicant,
            status,
          });
        }
      });
    });

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicants, catalogRequirements]);

  const schoolFilterOptions = Array.from(new Set(
    verificationItems.map((i) => i.applicant?.school).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  const filteredItems = verificationItems.filter((item) => {
    const matchesTerm = matchesSearch(
      [formatPersonName(item.applicant), item.applicant?.school, item.applicant?.program, item.label],
      searchTerm
    );
    const matchesType = !filterType || item.kind === filterType;
    const matchesSchool = matchesExact(item.applicant?.school, filterSchool);
    const matchesStatus = !filterStatus || item.status === filterStatus;
    return matchesTerm && matchesType && matchesSchool && matchesStatus;
  }).sort((a, b) => {
    const { column, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;
    switch (column) {
      case 'name':
        return formatPersonName(a.applicant).localeCompare(formatPersonName(b.applicant)) * multiplier;
      case 'type':
        return a.kind.localeCompare(b.kind) * multiplier;
      case 'school':
        return String(a.applicant?.school || '').localeCompare(String(b.applicant?.school || '')) * multiplier;
      case 'status':
        return a.status.localeCompare(b.status) * multiplier;
      default:
        return 0;
    }
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterSchool, filterStatus]);

  const handleSort = (column) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.column !== column) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const pendingCount = verificationItems.filter((i) => i.status === 'pending_verification').length;
  const rejectedCount = verificationItems.filter((i) => i.status === 'rejected').length;

  // Opens the SAME existing review interface each item already has —
  // Requirements go to Applications.jsx's RequirementsReviewModal, COR goes
  // to Scholars.jsx's Scholar Profile (COR per Semester section). Both use
  // the same navigation-state deep-link pattern already wired into those
  // pages (see location.state.applicantId / .scholarId there).
  const handleOpenItem = (item) => {
    if (item.kind === 'Requirement') {
      navigate('/applications', { state: { applicantId: item.applicant.id } });
    } else {
      navigate('/scholars', { state: { scholarId: item.applicant.id } });
    }
  };

  // Same badge colors as the existing verification badge in
  // RequirementsReviewModal.jsx — kept visually identical so this list and
  // the modal it opens never look like two different systems.
  const STATUS_BADGE = {
    pending_verification: { label: 'Pending Verification', bg: 'rgba(245,158,11,0.15)', color: '#fcd34d' },
    rejected: { label: 'Rejected', bg: 'rgba(239,68,68,0.15)', color: '#fca5a5' },
  };
  const statusBadge = (status) => {
    const badge = STATUS_BADGE[status] || { label: status?.toUpperCase() || 'UNKNOWN', bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' };
    return (
      <span style={{
        fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
        background: badge.bg, color: badge.color, whiteSpace: 'nowrap',
      }}>
        {badge.label.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="page needs-verification-page">
      <Header
        title="Needs Verification"
        subtitle="Application requirements and COR submissions awaiting admin action"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        <div className="stat-cards" style={{ marginBottom: '1rem' }}>
          <div className="stat-card">
            <div className="stat-label"><ShieldAlert size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Pending Verification</div>
            <div className="stat-value">{pendingCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rejected (on file)</div>
            <div className="stat-value">{rejectedCount}</div>
          </div>
        </div>

        <div className="filters-bar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by name, school, or item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="Requirement">Requirement</option>
            <option value="COR">COR</option>
          </select>
          <select value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)}>
            <option value="">All Schools</option>
            {schoolFilterOptions.map((name) => (
              <option key={name} value={name} title={name}>{getSchoolDisplayLabel(name)}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="pending_verification">Pending Verification</option>
            <option value="rejected">Rejected</option>
            <option value="">All (Pending + Rejected)</option>
          </select>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Name <SortIcon column="name" />
                  </div>
                </th>
                <th onClick={() => handleSort('type')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Type <SortIcon column="type" />
                  </div>
                </th>
                <th>Item</th>
                <th onClick={() => handleSort('school')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    School <SortIcon column="school" />
                  </div>
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Status <SortIcon column="status" />
                  </div>
                </th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => (
                <tr key={item.id}>
                  <td>{formatPersonName(item.applicant)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {item.kind === 'Requirement' ? <FileText size={14} /> : <FileCheck size={14} />}
                      {item.kind}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>{item.label}</td>
                  <td><SchoolLabel name={item.applicant?.school} /></td>
                  <td>{statusBadge(item.status)}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => handleOpenItem(item)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredItems.length === 0 && (
            <div className="empty-state">
              <ShieldAlert size={48} />
              <p>{verificationItems.length === 0 ? 'Nothing needs verification right now.' : 'No records match your filters.'}</p>
            </div>
          )}
        </div>

        {filteredItems.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} record{filteredItems.length !== 1 ? 's' : ''}
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <span style={{ padding: '0 1rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Page {safePage} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="pagination-select-container">
              <label>Items per page:</label>
              <select
                className="pagination-select"
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
