import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Swal from 'sweetalert2';
import { logAudit } from '../services/auditLog';
import {
  Plus,
  Upload,
  Download,
  Search,
  CheckCircle,
  Eye,
  FileSpreadsheet,
  X,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { downloadBfcspFormPdf, toBfcspFields } from '../utils/bfcspApplicationForm';
import { fetchBfcspApplication } from '../services/scholarshipApplications';
import { generateApplicationFormPdf } from '../services/backendApi';
import { matchesSearch, matchesExact } from '../utils/filtering';
import { computeTotalScore as computeTotalScoreFromRubric } from '../utils/evaluationRubric';
import { getApprovalEligibility } from '../utils/applicantEligibility';
import { getProgramDisplayLabel } from '../utils/programAbbreviations';
import RequirementsReviewModal from '../components/applications/RequirementsReviewModal';
import BulkApprovalModal from '../components/applications/BulkApprovalModal';

// The application form may only be viewed/downloaded once the applicant has
// actually submitted it. `requirements.applicationForm` is populated (by the
// context mapper) only for submitted forms, so its presence is the gate.
const hasSubmittedApplicationForm = (applicant) =>
  Boolean(applicant?.requirements?.applicationForm);

// Once an applicant is approved they become a City Scholar and belong to the
// Scholars module, not Applications. These statuses are filtered out here.
const SCHOLAR_STATUSES = ['approved', 'active', 'on-hold', 'graduated', 'terminated'];

// A score item's percentage of its own max — distinct from the column
// header's "(X%)" weight-in-total label. Renders nothing when there's no
// score yet (pct === null), matching every other optional-score display.
const PercentBadge = ({ pct }) =>
  pct === null ? null : (
    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> ({pct}%)</span>
  );

export default function Applications() {
  const {
    applicants, catalogSchools, catalogPrograms, addApplicant, updateApplicant, deleteApplicant,
    bulkDeleteApplicants, bulkImportApplicants, evaluationRubric,
    getRequirementVerification,
    catalogRequirements,
    systemSettings,
  } = useApp();

  // The admin-managed Application Requirements catalog (Settings →
  // Application Requirements) — was a hardcoded 8-item array here before.
  // Full catalog (active + archived), same {key, label} shape every existing
  // consumer below already expects, so nothing else needed to change.
  const REQUIREMENTS_LIST = (catalogRequirements || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(r => ({ key: r.id, label: r.name, active: r.active !== false }));

  // "Visible" for a given applicant = currently-active requirements, plus any
  // requirement that applicant already has a submission for even if it's
  // since been archived — so an archived requirement never counts as
  // "missing" against anyone, but a legacy submission never just disappears.
  const visibleRequirementsFor = (applicant) =>
    REQUIREMENTS_LIST.filter(r => r.active || applicant?.requirements?.[r.key]);
  const { onMenuClick } = useOutletContext() || {};

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Caps tuition at the SPECIFIC program's configured Tuition Cap (from the
  // real School/Program catalog managed in System Settings) when a matching
  // program is known, falling back to the admin-configured base
  // systemSettings.scholarshipCap otherwise — mirrors AppContext.jsx's
  // resolvePerSemGrant so the two never disagree.
  const computeReflectedAmount = (tuitionFee, school, program) => {
    const normalized = Math.max(0, toNumber(tuitionFee));
    const matchedProgram =
      catalogPrograms.find((p) => p.name === program && p.school === school) ||
      catalogPrograms.find((p) => p.name === program);
    const baseCap = Math.max(0, toNumber(systemSettings?.scholarshipCap)) || 25000;
    const cap = matchedProgram?.tuitionCap != null
      ? Math.max(0, toNumber(matchedProgram.tuitionCap))
      : baseCap;
    return Math.min(normalized, cap);
  };

  // Applicant birth dates are stored as a human-readable string (e.g.
  // "January 15, 2001" — see AppContext.jsx's formatBirthDate), but the
  // native <input type="date"> below only renders a value in yyyy-MM-dd
  // form; anything else is silently shown as blank. Reparse to that shape
  // here so the field actually displays.
  const toDateInputValue = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Auto-computed combined rubric score (out of 100) — see
  // utils/evaluationRubric.js for the formula (Requirements + Economic, each
  // scaled from the rubric's own point scale onto its weight, + Examination
  // weighted by examWeight). All three weights are editable in
  // Administration > Evaluation Criteria.
  const computeTotalScore = (applicant) => computeTotalScoreFromRubric(applicant, evaluationRubric);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [appSort, setAppSort] = useState({ column: 'name', direction: 'asc' });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add, edit, view
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [formData, setFormData] = useState(getEmptyFormData());
  const [selectedIds, setSelectedIds] = useState([]);
  // Requirements Review / Evaluation modal for one applicant — replaces the
  // old separate read-only Requirements popup AND the separate Application
  // Evaluation tab (Panel feedback: one continuous per-applicant workflow).
  // Stored as an id, not the object, so the modal always re-reads the live
  // applicant from context after a verify/reject/score action.
  const [reviewApplicantId, setReviewApplicantId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Deep link from NeedsVerification.jsx — it navigates here with
  // { state: { applicantId } } so this page opens straight to that
  // applicant's Requirements Review modal instead of the plain list.
  // Cleared right after use (replace, no new history entry) so refreshing
  // or navigating back here again doesn't reopen it.
  useEffect(() => {
    const targetId = location.state?.applicantId;
    if (!targetId) return;
    setReviewApplicantId(targetId);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.applicantId]);
  // Bulk Approval selection — ids of applicants checked in the main table.
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
  const [showBulkApprovalModal, setShowBulkApprovalModal] = useState(false);
  const fileInputRef = useRef(null);

  // Sorting handler for applications table
  const handleAppSort = (column) => {
    setAppSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Sort icon component
  const SortIcon = ({ column, currentSort }) => {
    if (currentSort.column !== column) {
      return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    }
    return currentSort.direction === 'asc' ? 
      <ArrowUp size={14} /> : 
      <ArrowDown size={14} />;
  };

  function getEmptyFormData() {
    return {
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phone: '',
      address: '',
      city: 'Calapan',
      school: '',
      program: '',
      yearLevel: 1,
      schoolYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
      gender: '',
      birthDate: '',
      tuitionFee: 0,
      amountGranted: 0,
      examScore: null,
      economicScore: null,
      interviewScore: null,
      interviewStatus: 'pending',
      notes: '',
    };
  }



  // School filter options: the eligible-schools catalog (managed in System
  // Settings) PLUS any school that actually appears on an applicant record
  // (covers schools not in the catalog), so every school present in the data
  // is selectable — matches the pattern used on the Scholars/Reports pages.
  const schoolFilterOptions = Array.from(new Set([
    ...(catalogSchools || []).map(s => s?.name).filter(Boolean),
    ...applicants.map(a => a?.school).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const filteredApplicants = applicants.filter(applicant => {
    const matchesSearchTerm = matchesSearch(
      [`${applicant.firstName} ${applicant.lastName}`, applicant.email],
      searchTerm
    );
    const matchesSchool = matchesExact(applicant.school, filterSchool);
    // Hide records that have moved on to the Scholars module.
    const isStillApplicant = !SCHOLAR_STATUSES.includes(applicant.status);
    return matchesSearchTerm && matchesSchool && isStillApplicant;
  }).sort((a, b) => {
    const { column, direction } = appSort;
    const multiplier = direction === 'asc' ? 1 : -1;
    
    switch (column) {
      case 'name':
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB) * multiplier;
      case 'school':
        return a.school.localeCompare(b.school) * multiplier;
      case 'program':
        return (a.program || '').localeCompare(b.program || '') * multiplier;
      case 'schoolYear':
        return (a.schoolYear || '').localeCompare(b.schoolYear || '') * multiplier;
      case 'gender':
        return (a.gender || '').localeCompare(b.gender || '') * multiplier;
      default:
        return 0;
    }
  });

  // Pagination for Applications
  const totalPages = Math.ceil(filteredApplicants.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedApplicants = filteredApplicants.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSchool]);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredApplicants.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleOpenModal = (mode, applicant = null) => {
    setModalMode(mode);
    if (applicant) {
      setSelectedApplicant(applicant);
      setFormData({
        ...applicant,
        birthDate: toDateInputValue(applicant.birthDate),
        tuitionFee: toNumber(applicant.tuitionFee),
        amountGranted: computeReflectedAmount(applicant.tuitionFee, applicant.school, applicant.program),
      });
    } else {
      setSelectedApplicant(null);
      setFormData(getEmptyFormData());
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedApplicant(null);
    setFormData(getEmptyFormData());
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'tuitionFee') {
      const tuitionFee = Math.max(0, toNumber(value));
      setFormData({
        ...formData,
        tuitionFee,
        amountGranted: computeReflectedAmount(tuitionFee, formData.school, formData.program),
      });
      return;
    }

    // Changing the school can invalidate the previously-selected program (it
    // may belong to a different school), and either change should refresh
    // the Reflected Scholarship Amount against the newly-matched program's
    // own Tuition Cap, not whatever program used to be selected.
    if (name === 'school' || name === 'program') {
      const nextSchool = name === 'school' ? value : formData.school;
      const programStillValid = name === 'school'
        ? catalogPrograms.some((p) => p.name === formData.program && p.school === nextSchool)
        : true;
      const nextProgram = name === 'program' ? value : (programStillValid ? formData.program : '');
      setFormData({
        ...formData,
        school: nextSchool,
        program: nextProgram,
        amountGranted: computeReflectedAmount(formData.tuitionFee, nextSchool, nextProgram),
      });
      return;
    }

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };





  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate Calapan city
    if (formData.city !== 'Calapan') {
      Swal.fire({
        title: 'Not Eligible',
        text: 'Only applicants from Calapan City are eligible for the scholarship.',
        icon: 'warning',
        confirmButtonColor: 'var(--warning)'
      });
      return;
    }

    if (modalMode === 'add') {
      addApplicant(formData);
      Swal.fire({
        title: 'Added!',
        text: `${formData.lastName}, ${formData.firstName} has been added successfully.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } else if (modalMode === 'edit') {
      updateApplicant(selectedApplicant.id, formData);
      Swal.fire({
        title: 'Updated!',
        text: 'Applicant information has been updated.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
    handleCloseModal();
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Applicant?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      deleteApplicant(id);
      Swal.fire({
        title: 'Deleted!',
        text: 'Applicant has been deleted.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };

  // Bulk delete selected applicants
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      Swal.fire({
        title: 'No Selection',
        text: 'Please select at least one applicant to delete.',
        icon: 'info',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }

    const result = await Swal.fire({
      title: `Delete ${selectedIds.length} Applicant${selectedIds.length > 1 ? 's' : ''}?`,
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete all!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      const count = selectedIds.length;
      bulkDeleteApplicants(selectedIds);
      setSelectedIds([]);
      Swal.fire({
        title: 'Deleted!',
        text: `${count} applicant${count > 1 ? 's have' : ' has'} been deleted.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }
  };


  // The pool "Rank" is computed against — every applicant still in this
  // workflow (not yet a Scholar), same set the old Evaluation tab ranked
  // within. Recomputed only when applicants/rubric actually change.
  const evaluationPool = useMemo(
    () => applicants.filter((a) => !SCHOLAR_STATUSES.includes(a.status)),
    [applicants]
  );

  const getApplicantRank = (applicant) => {
    const sorted = [...evaluationPool].sort(
      (a, b) => computeTotalScore(b) - computeTotalScore(a)
    );
    const idx = sorted.findIndex((a) => a.id === applicant.id);
    return idx === -1 ? null : idx + 1;
  };

  // Single source of truth for "can this applicant be approved right now" —
  // shared by the Requirements Review modal's Approve button and Bulk
  // Approval, so the two paths can never disagree (see utils/applicantEligibility.js).
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Approves one applicant — reused by the single Approve button (inside
  // RequirementsReviewModal) and, per-applicant, by Bulk Approval. Keeping
  // this as one function (instead of duplicating it per call site) is what
  // guarantees bulk approval can't drift from the individual guardrail/copy.
  const handleApproveApplicant = async (applicant) => {
    const eligibility = getApprovalEligibility(applicant, REQUIREMENTS_LIST, evaluationRubric, getRequirementVerification);
    if (!eligibility.eligible) {
      Swal.fire({
        icon: 'warning',
        title: 'Not Ready for Approval',
        html: `<p style="text-align:left">${escapeHtml(applicant.lastName)}, ${escapeHtml(applicant.firstName)} can't be approved yet:</p><ul style="text-align:left">${eligibility.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`,
      });
      return;
    }

    // A fully-scored-and-verified but below-threshold applicant can still be
    // approved individually, but only past an explicit typed justification —
    // never a silent one-click shortcut. Bulk approval never reaches this
    // branch (see getBulkApprovalEligibility): it skips these instead.
    let belowThresholdReason = null;
    if (!eligibility.meetsThreshold) {
      const { value } = await Swal.fire({
        title: 'Approve Below Threshold?',
        html: `<p style="text-align:left">This applicant's total score is <strong>${eligibility.totalScore}/100</strong>, below the 75-point qualifying threshold. Approving anyway requires a reason.</p>`,
        input: 'textarea',
        inputLabel: 'Reason for approving below threshold',
        inputPlaceholder: 'Enter justification...',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--warning, #f59e0b)',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Continue',
        inputValidator: (v) => { if (!v || !v.trim()) return 'A reason is required to approve below the threshold.'; },
      });
      if (!value) return;
      belowThresholdReason = value.trim();
    }

    const rank = getApplicantRank(applicant);
    const reqEntry = evaluationRubric.requirementsRubric.find(r => r.points === applicant.requirementsScore);
    const ecoEntry = evaluationRubric.economicRubric.find(r => r.points === applicant.economicScore);
    const result = await Swal.fire({
      title: 'Approve as City Scholar?',
      html: `
        <div style="text-align: left; padding: 10px;">
          <h4 style="margin-bottom: 15px; color: #1f2937;">${escapeHtml(applicant.lastName)}, ${escapeHtml(applicant.firstName)}</h4>
          <p><strong>Rank:</strong> ${rank ? `#${rank}` : '—'}</p>
          <p><strong>School:</strong> ${escapeHtml(applicant.school)}</p>
          <p><strong>Program:</strong> ${escapeHtml(applicant.program || 'N/A')}</p>
          <p><strong>Tuition Fee:</strong> PHP ${(applicant.tuitionFee || 0).toLocaleString()}</p>
          <p><strong>Reflected Scholarship Amount:</strong> PHP ${computeReflectedAmount(applicant.tuitionFee, applicant.school, applicant.program).toLocaleString()}</p>
          <p><strong>Exam Score:</strong> ${applicant.examScore || 0}/100</p>
          <p><strong>Requirements Score:</strong> ${applicant.requirementsScore != null ? applicant.requirementsScore + ' pts — ' + (reqEntry?.label || '') : 'Not scored'}</p>
          <p><strong>Economic Background:</strong> ${applicant.economicScore > 0 ? applicant.economicScore + ' pts — ' + (ecoEntry?.label || '') : 'Not rated'}</p>
          <hr>
          <p style="font-size: 1.05rem;"><strong>Total Combined Score:</strong> <span style="font-weight: bold;">${eligibility.totalScore}/100</span> ${eligibility.meetsThreshold ? '(Qualifies)' : '(Below threshold)'}</p>
          <hr>
          <p style="color: #22c55e; font-weight: bold; text-align: center;">Approve this applicant as a City Scholar?</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: 'var(--success)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Approve',
      cancelButtonText: 'Cancel',
    });
    if (!result.isConfirmed) return;

    updateApplicant(applicant.id, {
      status: 'active',
      amountGranted: computeReflectedAmount(applicant.tuitionFee, applicant.school, applicant.program),
    });
    if (belowThresholdReason) {
      logAudit({
        action: 'UPDATE',
        collection: 'users',
        documentId: applicant.firestoreId || applicant.scholarId || String(applicant.id),
        details: `Approved ${applicant.lastName}, ${applicant.firstName} below threshold (${eligibility.totalScore}/100): ${belowThresholdReason}`,
      });
    }
    setReviewApplicantId(null);
    Swal.fire('Approved!', `${applicant.lastName}, ${applicant.firstName} has been approved as a City Scholar.`, 'success');
  };

  const handleRejectApplicant = async (applicant) => {
    const result = await Swal.fire({
      title: 'Reject Application?',
      html: `
        <div style="text-align: left; padding: 10px;">
          <h4 style="margin-bottom: 15px; color: #1f2937;">${escapeHtml(applicant.lastName)}, ${escapeHtml(applicant.firstName)}</h4>
          <p><strong>School:</strong> ${escapeHtml(applicant.school)}</p>
          <hr>
          <p style="color: #ef4444; font-weight: bold; text-align: center;">Please provide a reason for rejection:</p>
        </div>
      `,
      input: 'textarea',
      inputLabel: 'Reason for Rejection',
      inputPlaceholder: 'Enter detailed reason for rejection...',
      inputAttributes: { 'aria-label': 'Rejection reason' },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--danger)',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Reject',
      cancelButtonText: 'Cancel',
      inputValidator: (value) => { if (!value) return 'You must provide a reason for rejection!'; },
    });
    if (!result.isConfirmed) return;
    updateApplicant(applicant.id, { status: 'rejected', rejectionReason: result.value });
    setReviewApplicantId(null);
    Swal.fire('Rejected!', `Application for ${applicant.lastName}, ${applicant.firstName} has been rejected.`, 'success');
  };

  // Bulk Approval's actual approve step — BulkApprovalModal has already
  // filtered `eligibleApplicants` down to the ones that pass
  // getBulkApprovalEligibility (complete + verified requirements, complete
  // scoring, AND at/above the qualifying threshold). One updateApplicant
  // call per applicant, same as an individual approve, so each one still
  // gets its own Audit Trail entry (see AppContext.jsx's updateApplicant) —
  // never a single collapsed "N applicants approved" record.
  const handleConfirmBulkApprove = async (eligibleApplicants) => {
    await Promise.all(eligibleApplicants.map((applicant) =>
      updateApplicant(applicant.id, {
        status: 'active',
        amountGranted: computeReflectedAmount(applicant.tuitionFee, applicant.school, applicant.program),
      })
    ));
    setBulkSelectedIds([]);
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const importedApplicants = jsonData.map(row => ({
          firstName: row['First Name'] || row['firstName'] || '',
          lastName: row['Last Name'] || row['lastName'] || '',
          middleName: row['Middle Name'] || row['middleName'] || '',
          email: row['Email'] || row['email'] || '',
          phone: row['Phone'] || row['phone'] || '',
          address: row['Address'] || row['address'] || '',
          city: row['City'] || row['city'] || 'Calapan',
          school: row['School'] || row['school'] || '',
          program: row['Program'] || row['program'] || '',
          tuitionFee: toNumber(row['Tuition Fee'] || row['tuitionFee']),
          amountGranted: computeReflectedAmount(
            row['Tuition Fee'] || row['tuitionFee'],
            row['School'] || row['school'] || '',
            row['Program'] || row['program'] || ''
          ),
          yearLevel: parseInt(row['Year Level'] || row['yearLevel']) || 1,
          gender: row['Gender'] || row['gender'] || '',
          birthDate: row['Birth Date'] || row['birthDate'] || '',
          requirements: {
            applicationForm: false,
            idPictures: false,
            form137: false,
            goodMoral: false,
            votersId: false,
            barangayResidency: false,
            electricBills: false,
            cedula: false,
          },
          examScore: null,
          economicScore: null,
          interviewScore: null,
          interviewStatus: 'pending',
          notes: row['Notes'] || row['notes'] || '',
        })).filter(a => a.city === 'Calapan'); // Only import Calapan residents

        if (importedApplicants.length > 0) {
          bulkImportApplicants(importedApplicants);
          Swal.fire({
            icon: 'success',
            title: 'Import Successful',
            text: `Successfully imported ${importedApplicants.length} applicants!`,
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'No Valid Applicants',
            text: 'No valid applicants found in the file. Only Calapan residents are eligible.',
          });
        }
      } catch (error) {
        console.error('Error importing Excel:', error);
        Swal.fire({
          icon: 'error',
          title: 'Import Error',
          text: 'Error importing file. Please ensure it is a valid Excel file.',
        });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Builds the official BFCSP application form PDF (template overlay) for one
  // applicant and triggers a download. Pulls the full BFCSP record from Firestore
  // when available so every field is filled, falling back to the admin applicant.
  const handleDownloadForm = async (applicant) => {
    // Guard: never produce the form for an applicant who hasn't submitted it.
    if (!hasSubmittedApplicationForm(applicant)) {
      Swal.fire({
        icon: 'info',
        title: 'Form Not Submitted',
        text: 'This applicant has not submitted their application form yet, so it cannot be viewed or downloaded.',
      });
      return;
    }
    Swal.fire({
      title: 'Preparing application form…',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
    });
    try {
      const fullRecord = await fetchBfcspApplication(applicant);
      // Full BFCSP fields win; admin applicant fills any gaps (name, school, …).
      const merged = fullRecord ? { ...applicant, ...fullRecord } : applicant;

      // Prefer the shared backend generator (same one the scholar app uses); if
      // it's unreachable, fall back to the client-side pdf-lib generator.
      const blob = await generateApplicationFormPdf(merged);
      if (blob) {
        const f = toBfcspFields(merged);
        const namePart = [f.lastName, f.firstName].filter(Boolean).join('_') || 'applicant';
        const fileName = `BFCSP_Application_${namePart}.pdf`.replace(/\s+/g, '_');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        await downloadBfcspFormPdf(merged);
      }
      Swal.close();
    } catch (error) {
      console.error('Error generating application form PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: error.message || 'Unable to generate the application form PDF.',
      });
    }
  };

  const handleExcelExport = () => {
    const exportData = filteredApplicants.map(a => ({
      'First Name': a.firstName,
      'Last Name': a.lastName,
      'Middle Name': a.middleName,
      'Email': a.email,
      'Phone': a.phone,
      'Address': a.address,
      'City': a.city,
      'School': a.school,
      'Program': a.program,
      'Tuition Fee': a.tuitionFee || 0,
      'Reflected Scholarship Amount': a.amountGranted || 0,
      'Year Level': a.yearLevel,
      'Gender': a.gender,
      'Birth Date': a.birthDate,
      'Status': a.status,
      'Exam Score': a.examScore,
      'Economic Score': a.economicScore,
      'Interview Status': a.interviewStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Applicants');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `applicants_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="page applications-page">
      <Header
        title="Applications Management"
        subtitle="Find an applicant, review requirements, evaluate, and approve — all in one place"
        onMenuClick={onMenuClick}
      />

      <div className="page-content">
        {/* Actions Bar */}
        <div className="actions-bar">
          <div className="actions-left">
            <div className="filters-grid">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search applicants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
              >
                <option value="">All Schools</option>
                {schoolFilterOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="actions-right">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              style={{ display: 'none' }}
            />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>
              <Upload size={18} />
              Import Excel
            </button>
            <button className="btn btn-secondary" onClick={handleExcelExport}>
              <Download size={18} />
              Export Excel
            </button>
            <button className="btn btn-primary" onClick={() => handleOpenModal('add')}>
              <Plus size={18} />
              Add Applicant
            </button>
          </div>
        </div>

        {/* Bulk Approval bar */}
        {bulkSelectedIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', marginBottom: '1rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px' }}>
            <span style={{ fontWeight: 600, color: '#22c55e', fontSize: '0.9rem' }}>
              {bulkSelectedIds.length} applicant{bulkSelectedIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              className="btn btn-sm btn-success"
              onClick={() => setShowBulkApprovalModal(true)}
            >
              <CheckCircle size={14} /> Approve Selected
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setBulkSelectedIds([])}
            >
              <X size={13} /> Clear
            </button>
          </div>
        )}

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={filteredApplicants.length > 0 && filteredApplicants.every(a => bulkSelectedIds.includes(a.id))}
                    ref={(el) => {
                      if (el) {
                        const some = filteredApplicants.some(a => bulkSelectedIds.includes(a.id));
                        const all = filteredApplicants.length > 0 && filteredApplicants.every(a => bulkSelectedIds.includes(a.id));
                        el.indeterminate = some && !all;
                      }
                    }}
                    onChange={(e) => {
                      const filteredIds = filteredApplicants.map(a => a.id);
                      setBulkSelectedIds((prev) =>
                        e.target.checked
                          ? [...new Set([...prev, ...filteredIds])]
                          : prev.filter((id) => !filteredIds.includes(id))
                      );
                    }}
                    title="Select all filtered applicants"
                  />
                </th>
                <th onClick={() => handleAppSort('name')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Name
                    <SortIcon column="name" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('school')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    School
                    <SortIcon column="school" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('program')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Program
                    <SortIcon column="program" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('schoolYear')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    School Year
                    <SortIcon column="schoolYear" currentSort={appSort} />
                  </div>
                </th>
                <th onClick={() => handleAppSort('gender')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Gender
                    <SortIcon column="gender" currentSort={appSort} />
                  </div>
                </th>
                <th>Requirements</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedApplicants.map(applicant => {
                return (
                  <tr key={applicant.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={bulkSelectedIds.includes(applicant.id)}
                        onChange={(e) => {
                          setBulkSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, applicant.id]
                              : prev.filter((id) => id !== applicant.id)
                          );
                        }}
                      />
                    </td>
                    <td>
                      <div className="applicant-cell">
                        <div className="applicant-avatar">
                          {applicant.firstName[0]}{applicant.lastName[0]}
                        </div>
                        <div className="applicant-details">
                          <span className="applicant-name">
                            {applicant.lastName}, {applicant.firstName}
                          </span>
                          <span className="applicant-email">{applicant.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{applicant.school}</td>
                    <td title={applicant.program}>{getProgramDisplayLabel(applicant.program)}</td>
                    <td>{applicant.schoolYear || 'N/A'}</td>
                    <td>{applicant.gender}</td>
                    <td>
                      {(() => {
                        const visible = visibleRequirementsFor(applicant);
                        const total = visible.length;
                        const submitted = visible.filter(r => applicant.requirements?.[r.key]).length;
                        const isComplete = submitted === total;
                        return (
                          <button
                            type="button"
                            title="Review requirements & evaluation"
                            onClick={() => setReviewApplicantId(applicant.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              background: isComplete ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                              color: isComplete ? '#86efac' : '#fcd34d',
                            }}
                          >
                            {submitted}/{total}
                            <Eye size={13} />
                          </button>
                        );
                      })()}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn view"
                          onClick={() => handleOpenModal('view', applicant)}
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="action-btn view"
                          onClick={() => handleDownloadForm(applicant)}
                          disabled={!hasSubmittedApplicationForm(applicant)}
                          title={
                            hasSubmittedApplicationForm(applicant)
                              ? 'Download Application Form (PDF)'
                              : 'Application form not submitted yet'
                          }
                          style={
                            hasSubmittedApplicationForm(applicant)
                              ? undefined
                              : { opacity: 0.4, cursor: 'not-allowed' }
                          }
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredApplicants.length === 0 && (
            <div className="empty-state">
              <FileSpreadsheet size={48} />
              <h3>No applicants found</h3>
              <p>Try adjusting your search or filters</p>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredApplicants.length > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredApplicants.length)} of {filteredApplicants.length} entries
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <span style={{ padding: '0 1rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="pagination-select-container">
                <label>Items per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="pagination-select"
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

      {/* Requirements Review + Evaluation — one modal per applicant, replacing
          both the old read-only Requirements popup and the separate
          Application Evaluation tab. */}
      {reviewApplicantId && (() => {
        const reviewApplicant = applicants.find((a) => a.id === reviewApplicantId);
        if (!reviewApplicant) return null;
        return (
          <RequirementsReviewModal
            applicant={reviewApplicant}
            requirementsList={REQUIREMENTS_LIST}
            evaluationRubric={evaluationRubric}
            rank={getApplicantRank(reviewApplicant)}
            poolSize={evaluationPool.length}
            onClose={() => setReviewApplicantId(null)}
            onApprove={handleApproveApplicant}
            onReject={handleRejectApplicant}
          />
        );
      })()}

      {/* Bulk Approval — confirmation (eligible/ineligible breakdown) then
          result summary. Approval itself goes through handleConfirmBulkApprove,
          which calls the same updateApplicant used everywhere else, one
          applicant at a time (individual Audit Trail entries). */}
      {showBulkApprovalModal && (
        <BulkApprovalModal
          applicants={applicants.filter((a) => bulkSelectedIds.includes(a.id))}
          requirementsList={REQUIREMENTS_LIST}
          evaluationRubric={evaluationRubric}
          getRequirementVerification={getRequirementVerification}
          onCancel={() => setShowBulkApprovalModal(false)}
          onApprove={handleConfirmBulkApprove}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'add' && 'Add New Applicant'}
                {modalMode === 'edit' && 'Edit Applicant'}
                {modalMode === 'view' && 'Applicant Details'}
              </h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              {modalMode === 'view' && selectedApplicant && (() => {
                const canDownload = hasSubmittedApplicationForm(selectedApplicant);
                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    {!canDownload && (
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                        Available after the applicant submits their form
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDownloadForm(selectedApplicant)}
                      disabled={!canDownload}
                      title={canDownload ? 'Download Application Form' : 'Application form not submitted yet'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        ...(canDownload ? {} : { opacity: 0.5, cursor: 'not-allowed' }),
                      }}
                    >
                      <Download size={16} />
                      Download Application Form
                    </button>
                  </div>
                );
              })()}
              <div className="form-section">
                <h3>Personal Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={formData.middleName}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Birth Date</label>
                    <input
                      type="date"
                      name="birthDate"
                      value={formData.birthDate}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                      className={formData.city !== 'Calapan' ? 'input-error' : ''}
                    />
                    {formData.city !== 'Calapan' && (
                      <span className="input-hint error">Only Calapan residents are eligible</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Academic Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>School *</label>
                    <select
                      name="school"
                      value={formData.school}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="">Select School</option>
                      {catalogSchools.map(school => (
                        <option key={school.id} value={school.name}>{school.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Program *</label>
                    <select
                      name="program"
                      value={formData.program}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="">Select Program</option>
                      {catalogPrograms
                        .filter((program) => program.school === formData.school)
                        .map((program) => (
                          <option key={program.id} value={program.name}>{program.name}</option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tuition Fee (Per Semester) *</label>
                    <input
                      type="number"
                      min={0}
                      name="tuitionFee"
                      value={formData.tuitionFee}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    />
                  </div>
                  <div className="form-group">
                    <label>Reflected Scholarship Amount</label>
                    <input
                      type="number"
                      name="amountGranted"
                      value={computeReflectedAmount(formData.tuitionFee, formData.school, formData.program)}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label>Year Level</label>
                    <select
                      name="yearLevel"
                      value={formData.yearLevel}
                      onChange={handleInputChange}
                      disabled={modalMode === 'view'}
                    >
                      <option value={1}>1st Year</option>
                      <option value={2}>2nd Year</option>
                      <option value={3}>3rd Year</option>
                      <option value={4}>4th Year</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>School Year *</label>
                    <select
                      name="schoolYear"
                      value={formData.schoolYear}
                      onChange={handleInputChange}
                      required
                      disabled={modalMode === 'view'}
                    >
                      <option value="2024-2025">2024-2025</option>
                      <option value="2025-2026">2025-2026</option>
                      <option value="2026-2027">2026-2027</option>
                      <option value="2027-2028">2027-2028</option>
                    </select>
                  </div>
                </div>
              </div>

              {modalMode !== 'view' && (
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {modalMode === 'add' ? 'Add Applicant' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
