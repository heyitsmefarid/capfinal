import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useOutletContext } from 'react-router-dom';
import Header from '../components/layout/Header';
import {
  FileText,
  Download,
  ChevronDown,
  Users,
  DollarSign,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Award,
  UserX,
  Building2,
  CheckCircle2,
  Eye,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from 'recharts';
import { loadLetterheadImages, getLetterheadLayout, drawLetterheadBands } from '../utils/reportLetterhead';
import { matchesExact } from '../utils/filtering';
import { fetchReportSummary } from '../services/backendApi';
import { getSchoolDisplayLabel } from '../utils/schoolAbbreviations';
import { getProgramDisplayLabel } from '../utils/programAbbreviations';
import { getPerSemGranted, getGrantBreakdown, getEffectiveTuition, getApplicableCap } from '../utils/granting';
import { getApprovalEligibility } from '../utils/applicantEligibility';
import { rubricMaxPoints } from '../utils/evaluationRubric';

// The four headline categories from the CED requirements, plus the
// dedicated Applicant Reports category and every other pre-existing
// detailed report group — all selectable from the single Report Type
// dropdown in the filter card (see reportTypes/the dropdown JSX below).
const REPORT_CATEGORIES = {
  MASTERLIST: 'Masterlist',
  DEMOGRAPHIC: 'Demographic',
  DISBURSEMENT: 'Disbursement',
  GRADUATE: 'Graduation',
  // Applicants who haven't been approved yet are NOT Scholars — this
  // category is deliberately kept separate from the four above (and from
  // every scholar-facing report below) and is rendered in its own bar,
  // never merged into the Masterlist/Demographic/Disbursement/Graduation
  // dropdown groups.
  APPLICANT: 'Applicant Reports',
  DASHBOARD: 'Dashboard Summary Reports',
  ACADEMIC: 'Academic Performance Reports',
  COMPLIANCE: 'Compliance & Documentation Reports',
  ENROLLMENT: 'Other Enrollment & Status Reports',
  ANALYTICAL: 'Comparative & Analytical Reports',
};

// Internal bookkeeping fields on a report row — never shown as a table
// column, never exported. Currently just the grouped-report row-type flag
// (see generateMasterlistHierarchy/withTotalRow) used purely for on-screen
// bold styling of subtotal/TOTAL rows.
const INTERNAL_ROW_KEYS = new Set(['_rowType']);
const visibleHeaders = (row) => Object.keys(row || {}).filter((k) => !INTERNAL_ROW_KEYS.has(k));

// Same palette Dashboard.jsx's charts already use, reused here for the
// Year-to-Year Program Comparison chart so both pages' charts read as one
// visual system rather than introducing a second color scheme.
const BAR_COLORS = ['#2d9596', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e'];

// Appends a TOTAL row to a flat list of report rows — every report must show
// one (requirement #3/#17). `fill` supplies values for whichever columns a
// total makes sense for (e.g. a count or amount column); every other column
// on the total row is left blank rather than guessing at a label.
const withTotalRow = (rows, fill) => {
  if (!rows || rows.length === 0) return rows;
  const headers = visibleHeaders(rows[0]);
  const totalRow = { _rowType: 'total' };
  headers.forEach((h) => { totalRow[h] = h in fill ? fill[h] : ''; });
  return [...rows, totalRow];
};

export default function Reports() {
  const {
    applicants, catalogSchools, catalogPrograms, schoolYears, evaluationRubric, systemSettings, signatories,
    catalogRequirements, getRequirementVerification,
  } = useApp();
  const economicScoreLabels = Object.fromEntries(
    evaluationRubric.economicRubric.map((r) => [r.points, r.label])
  );
  const { onMenuClick } = useOutletContext() || {};
  const [selectedReport, setSelectedReport] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null);
  const [filterHEI, setFilterHEI] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYearLevel, setFilterYearLevel] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('');
  // "Sex" in every user-facing label per the CED requirement — the
  // underlying scholar record field stays `gender`, unchanged.
  const [filterSex, setFilterSex] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterAY, setFilterAY] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  // Applicant Reports-only filters — meaningless for scholar reports (a
  // Scholar has already left the Applications pipeline), so these only
  // apply/render when the Applicant Reports category is active. See
  // getFilteredApplicantPool below.
  const [filterAppStatus, setFilterAppStatus] = useState('');
  const [filterReqStatus, setFilterReqStatus] = useState('');
  const [filterEvalStatus, setFilterEvalStatus] = useState('');
  const [filterExamStatus, setFilterExamStatus] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('');
  const [filterEconBackground, setFilterEconBackground] = useState('');
  const [filterAge, setFilterAge] = useState('');
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  // Holds the generated PDF (as a Blob + object URL) so it can be shown in
  // an in-app preview before the admin commits to downloading it — same
  // "view before download" pattern already used for submitted requirements
  // in Applications.jsx, just fed a locally-generated blob instead of a
  // remote file URL.
  const [pdfPreview, setPdfPreview] = useState(null); // { url, blob, filename, title }
  const dropdownRef = useRef(null);

  // On-screen convenience only — narrows/orders/pages the currently
  // generated report's table. Exports (Excel/PDF) always use the full
  // reportData.data, unaffected by these.
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [reportSortConfig, setReportSortConfig] = useState({ column: null, direction: 'asc' });
  const [reportCurrentPage, setReportCurrentPage] = useState(1);
  const [reportItemsPerPage, setReportItemsPerPage] = useState(10);

  const handleReportSort = (column) => {
    setReportSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setReportCurrentPage(1);
  };

  // Displays a currency/percentage-formatted string ("₱12,000", "45.6%") as a
  // number for sorting purposes; falls back to string comparison (e.g. "7/8"
  // progression, plain names) when either side isn't numeric-like.
  const toComparable = (v) => {
    const str = String(v ?? '').trim();
    if (!str) return null;
    const num = Number(str.replace(/[₱,%\s]/g, ''));
    return Number.isFinite(num) ? num : null;
  };

  // Compact-display swap for School/HEI and Program columns — used
  // everywhere a report is actually seen: the on-screen table, the Excel
  // export, and the PDF (see toDisplayRows below), so printed tables stay
  // narrow enough to fit the page instead of overflowing on long official
  // names. Idempotent: calling it on an already-abbreviated value (a
  // generator that already abbreviated at generation time, e.g. the
  // Masterlist Hierarchy) just returns that value unchanged, so it's safe
  // to apply uniformly regardless of what a given generator already did.
  const displayCellValue = (header, value) => {
    if (/^(HEI|HEI Name|School|School \/ HEI)$/i.test(header)) return getSchoolDisplayLabel(value);
    if (header === 'Program') return getProgramDisplayLabel(value);
    return value;
  };

  // Maps every row's School/HEI/Program values through displayCellValue —
  // the single place Excel export and PDF export both go through so they
  // never disagree with what the on-screen table shows.
  const toDisplayRows = (data) =>
    (data || []).map((row) => {
      const out = {};
      visibleHeaders(row).forEach((h) => { out[h] = displayCellValue(h, row[h]); });
      return out;
    });

  // Revoke the preview's object URL when it's replaced/cleared or the page
  // unmounts, so an abandoned preview doesn't leak memory.
  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setReportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let active = true;

    fetchReportSummary()
      .then((response) => {
        if (active) {
          setLiveSummary(response?.summary || null);
        }
      })
      .catch(() => {
        if (active) {
          setLiveSummary(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const reportTypes = [
    // ── MASTERLIST ──────────────────────────────────────────
    {
      id: 'masterlist-hierarchy',
      name: 'Masterlist — School / Program Hierarchy',
      category: REPORT_CATEGORIES.MASTERLIST,
      icon: Building2,
      description: 'Scholar counts grouped by School then Program, with subtotals and a grand total',
      fields: ['School', 'Program', 'Scholars'],
    },
    {
      id: 'master-list-all',
      name: 'Master List of Scholars',
      category: REPORT_CATEGORIES.MASTERLIST,
      icon: Users,
      description: 'Complete scholar list — filter by School, Program, Year Level, Barangay, or Sex',
      fields: ['Full Name', 'HEI', 'Program', 'Year Level', 'Sex'],
    },
    {
      id: 'list-per-hei',
      name: 'Scholar List per HEI',
      category: REPORT_CATEGORIES.MASTERLIST,
      icon: Building2,
      description: 'Select one School/HEI for its scholar list, or leave School unset for a per-school count + GRAND TOTAL',
      fields: ['HEI Name', 'Number of Scholars'],
    },

    // ── DEMOGRAPHIC ─────────────────────────────────────────
    {
      id: 'demographic-profile',
      name: 'Demographic Summary',
      category: REPORT_CATEGORIES.DEMOGRAPHIC,
      icon: Users,
      description: 'Aggregated Age / Sex / Economic Background breakdown, with TOTAL',
      fields: ['Age', 'Sex', 'Economic Background'],
    },
    {
      id: 'demographic-per-student',
      name: 'Demographic Detail (Per Student)',
      category: REPORT_CATEGORIES.DEMOGRAPHIC,
      icon: Users,
      description: 'Individual scholar list with Age, Sex, Barangay, and Economic Background',
      fields: ['Full Name', 'HEI', 'Program', 'Age', 'Sex', 'Barangay', 'Economic Background'],
    },
    {
      id: 'gender-distribution',
      name: 'Sex Distribution Report',
      category: REPORT_CATEGORIES.DEMOGRAPHIC,
      icon: Users,
      description: 'Sex demographics of the scholarship program',
      fields: ['Sex', 'Count', 'Percentage'],
    },

    // ── DISBURSEMENT ────────────────────────────────────────
    {
      id: 'disbursement-per-semester',
      name: 'Disbursement — Per Semester',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: DollarSign,
      description: 'Scholars granted and total actually granted per semester, from real per-semester records',
      fields: ['Semester', 'Number of Scholars', 'Total Granted'],
    },
    {
      id: 'disbursement-per-school',
      name: 'Disbursement — Per School',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: Building2,
      description: 'Total actually granted per HEI',
      fields: ['School', 'Scholars', 'Total Granted'],
    },
    {
      id: 'disbursement-per-scholar',
      name: 'Disbursement — Per Scholar',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: Users,
      description: 'Every scholar’s actual granted semesters, from their real per-semester records',
      fields: ['Scholar', 'School', 'Program', 'Semester', 'Amount Granted'],
    },
    {
      id: 'semester-disbursement',
      name: 'Semester Disbursement (Flat List)',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: DollarSign,
      description: 'One row per active/approved scholar’s per-semester and lifetime grant',
      fields: ['Academic Year', 'Semester', 'Scholar Name', 'HEI', 'Per-Semester Grant', 'Total Granted to Date'],
    },
    {
      id: 'hei-fund-allocation',
      name: 'HEI Fund Allocation Summary',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: Building2,
      description: 'Budget tracking per partner school',
      fields: ['HEI Name', 'Number of Scholars', 'Total Required Funds', 'Total Disbursed', 'Remaining Budget'],
    },
    {
      id: 'program-financial-summary',
      name: 'Total Program Financial Summary',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: TrendingUp,
      description: 'Executive-level financial overview',
      fields: ['Total Active Scholars', 'Total Budget Required', 'Total Disbursed'],
    },
    {
      id: 'unused-grant',
      name: 'Unused Grant Monitoring Report',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: AlertTriangle,
      description: 'Scholars whose actual tuition is below their applicable grant cap',
      fields: ['Scholar Name', 'HEI', 'Actual Tuition', 'Grant Cap', 'Unused Portion'],
    },
    {
      id: 'outstanding-payment',
      name: 'Outstanding Payment Report',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: FileText,
      description: 'Monitor pending releases',
      fields: ['Scholar Name', 'HEI', 'Semester', 'Approved Amount', 'Amount Released', 'Balance', 'Status'],
    },
    {
      id: 'funds-released-semester',
      name: 'Total Funds Released This Semester',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: DollarSign,
      description: 'Financial disbursement summary for current semester',
      fields: ['Semester', 'Academic Year', 'Scholar Name', 'Amount Released'],
    },
    {
      id: 'funds-remaining',
      name: 'Funds Remaining Report',
      category: REPORT_CATEGORIES.DISBURSEMENT,
      icon: TrendingUp,
      description: 'Budget balance and allocation status per HEI',
      fields: ['HEI', 'Allocated Funds', 'Released Funds', 'Remaining Funds'],
    },

    // ── GRADUATE ────────────────────────────────────────────
    {
      id: 'graduation-report',
      name: 'Graduation Report',
      category: REPORT_CATEGORIES.GRADUATE,
      icon: GraduationCap,
      description: 'Graduated scholars with dynamic completed/required progress and percentage',
      fields: ['Scholar Name', 'HEI', 'Program', 'Graduation Progress', 'Progress %', 'Total Amount Received'],
    },
    {
      id: 'graduating-scholars',
      name: 'Graduating Scholars Report',
      category: REPORT_CATEGORIES.GRADUATE,
      icon: GraduationCap,
      // Not yet graduated — at the final scholarship semester (same rule as
      // the Graduating filter in Scholars.jsx), so CED can monitor who's
      // approaching completion this term.
      description: 'Scholars at their final scholarship semester, approaching graduation',
      fields: ['Scholar Name', 'Scholar ID', 'HEI', 'Program', 'Progression', 'Progress %', 'Current Status'],
    },
    {
      id: 'graduation-progress-rate',
      name: 'Graduation Progress Rate',
      category: REPORT_CATEGORIES.GRADUATE,
      icon: Award,
      description: 'Track completion rates and retention',
      fields: ['Total Awarded', 'Graduated', 'Still Active', 'Terminated', 'Graduation Rate %'],
    },
    {
      id: 'cost-per-graduate',
      name: 'Cost per Graduate Report',
      category: REPORT_CATEGORIES.GRADUATE,
      icon: DollarSign,
      description: 'Program ROI analysis',
      fields: ['Scholar Name', 'Total Semesters Funded', 'Total Amount Received', 'Graduation Status'],
    },

    // ── APPLICANT REPORTS ───────────────────────────────────
    // Dedicated to applicants who have not yet been approved — never mixed
    // with the scholar-facing categories above.
    {
      id: 'applicant-masterlist',
      name: 'Applicant Masterlist',
      category: REPORT_CATEGORIES.APPLICANT,
      icon: Users,
      description: 'Complete applicant list — filter by School, Program, Year Level, Barangay, or Sex',
      fields: ['Applicant Name', 'School / HEI', 'Program', 'Year Level', 'Sex', 'Age', 'Barangay', 'Application Status', 'Date Submitted'],
    },
    {
      id: 'applicant-status',
      name: 'Applicant Status Report',
      category: REPORT_CATEGORIES.APPLICANT,
      icon: ClipboardCheck,
      description: 'Applicants grouped by their actual application status (Pending / Rejected)',
      fields: ['Status', 'Applicants', 'Percentage'],
    },
    {
      id: 'applicant-demographic',
      name: 'Applicant Demographic Report',
      category: REPORT_CATEGORIES.APPLICANT,
      icon: Users,
      description: 'Sex / Age / Barangay / Economic Background breakdown of applicants, with TOTAL',
      fields: ['Sex', 'Age', 'Barangay', 'Economic Background'],
    },
    {
      id: 'applicant-requirements',
      name: 'Applicant Requirements Report',
      category: REPORT_CATEGORIES.APPLICANT,
      icon: ClipboardCheck,
      description: 'Requirement submission progress and verification status per applicant',
      fields: ['Applicant', 'School / HEI', 'Program', 'Requirement Progress', 'Requirements Status', 'Missing / Pending Requirements', 'Verification Status'],
    },
    {
      id: 'applicant-evaluation',
      name: 'Applicant Evaluation / Exam Report',
      category: REPORT_CATEGORIES.APPLICANT,
      icon: Award,
      description: 'Exam, Requirements, and Economic Background scores plus the combined evaluation result',
      fields: ['Applicant', 'School / HEI', 'Program', 'Exam Score', 'Requirements Score', 'Economic Score', 'Overall Evaluation', 'Result'],
    },
    {
      id: 'applicant-approval',
      name: 'Applicant Approval Report',
      category: REPORT_CATEGORIES.APPLICANT,
      icon: CheckCircle2,
      description: 'Read-only approval readiness — never approves, rejects, or changes an applicant',
      fields: ['Applicant', 'School / HEI', 'Program', 'Evaluation Status', 'Requirements Status', 'Approval Status', 'Remarks'],
    },
    {
      id: 'applicant-pending-incomplete',
      name: 'Pending / Incomplete Applicants Report',
      category: REPORT_CATEGORIES.APPLICANT,
      icon: AlertTriangle,
      description: 'Applicants still missing requirements, verification, or evaluation scores',
      fields: ['Applicant', 'School / HEI', 'Program', 'Issue', 'Status'],
    },

    // ── Other reports ───────────────────────────────────────
    {
      id: 'total-active-scholars',
      name: 'Total Active Scholars Report',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: Users,
      description: 'Current count of all active scholars',
      fields: ['Total Active', 'Active %', 'Total Scholars'],
    },
    {
      id: 'scholars-per-hei-graph',
      name: 'Scholars per HEI (Graph Data)',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: Building2,
      description: 'Distribution of scholars across partner institutions',
      fields: ['HEI Name', 'Active Scholars', 'On-Hold', 'Graduated', 'Total'],
    },
    {
      id: 'academic-standing-distribution',
      name: 'Academic Standing Distribution',
      category: REPORT_CATEGORIES.DASHBOARD,
      icon: GraduationCap,
      description: 'Performance categorization of all scholars',
      fields: ['GWA Range', 'Count', 'Percentage', 'Status'],
    },

    // III. Academic Performance Reports
    {
      id: 'academic-performance',
      name: 'Scholar Academic Performance Report',
      category: REPORT_CATEGORIES.ACADEMIC,
      icon: GraduationCap,
      description: 'Retention and compliance monitoring',
      fields: ['Scholar Name', 'HEI', 'Program', 'Semester & AY', 'GWA', 'Academic Status', 'Remarks'],
    },
    {
      id: 'at-risk-scholars',
      name: 'At-Risk Scholars Report',
      category: REPORT_CATEGORIES.ACADEMIC,
      icon: AlertTriangle,
      description: 'Early intervention for struggling scholars',
      fields: ['Scholar Name', 'HEI', 'Program', 'GPA Below Threshold', 'Failed Subjects', 'Recommendation'],
    },
    {
      id: 'retention-continuation',
      name: 'Retention & Continuation Report',
      category: REPORT_CATEGORIES.ACADEMIC,
      icon: Award,
      description: 'Track eligibility for next semester',
      fields: ['Scholar Name', 'Previous Semester Status', 'Current Enrollment Status', 'Eligibility Result'],
    },

    // IV. Compliance & Documentation Reports
    {
      id: 'requirements-submission',
      name: 'Requirements Submission Report',
      category: REPORT_CATEGORIES.COMPLIANCE,
      icon: ClipboardCheck,
      description: 'Monitor document compliance',
      fields: ['Scholar Name', 'HEI', 'Required Documents', 'Submission Status', 'Date Submitted', 'Verified By'],
    },
    {
      id: 'agreement-monitoring',
      name: 'Scholarship Agreement Monitoring Report',
      category: REPORT_CATEGORIES.COMPLIANCE,
      icon: FileText,
      description: 'Legal compliance tracking',
      fields: ['Scholar Name', 'Date Agreement Signed', 'Parent/Guardian Signature', 'HEI Certification Status'],
    },

    // V. Enrollment & Status Reports
    {
      id: 'enrollment-verification',
      name: 'Enrollment Verification Report',
      category: REPORT_CATEGORIES.ENROLLMENT,
      icon: ClipboardCheck,
      description: 'Confirm scholars are officially enrolled',
      fields: ['Scholar Name', 'HEI', 'Program', 'Units Enrolled', 'Semester', 'Enrollment Status'],
    },
    {
      id: 'status-summary',
      name: 'Scholarship Status Summary',
      category: REPORT_CATEGORIES.ENROLLMENT,
      icon: Users,
      description: 'Quick overview of scholar standing',
      fields: ['Total Active', 'On Hold', 'Terminated', 'Graduated', 'Transferred'],
    },
    {
      id: 'terminated-dropped',
      name: 'Terminated / Dropped Scholars Report',
      category: REPORT_CATEGORIES.ENROLLMENT,
      icon: UserX,
      description: 'Monitor attrition',
      fields: ['Scholar Name', 'HEI', 'Reason for Termination', 'Date Terminated', 'Total Funds Used'],
    },

    // VI. Comparative & Analytical Reports
    {
      id: 'year-to-year-growth',
      name: 'Year-to-Year Program Growth Report',
      category: REPORT_CATEGORIES.ANALYTICAL,
      icon: TrendingUp,
      description: 'Strategic planning and trend analysis',
      fields: ['Academic Year', 'Total Scholars', 'Total Budget', 'New Scholars Added', 'Graduates'],
    },
    {
      id: 'year-to-year-program-comparison',
      name: 'Year-to-Year Program Comparison',
      category: REPORT_CATEGORIES.ANALYTICAL,
      icon: TrendingUp,
      description: 'Compare scholar counts per program across school years',
      fields: ['School Year', 'Program', 'Number of Scholars'],
    },
  ];

  // Auto-generate report data when selectedReport changes
  const [reportData, setReportData] = useState(null);

  // Reset to page 1 whenever the on-screen search narrows the result set.
  useEffect(() => {
    setReportCurrentPage(1);
  }, [reportSearchTerm]);

  const getSelectedReportInfo = () => reportTypes.find(r => r.id === selectedReport);

  // Academic Year / Semester filtering can't just compare the flat
  // schoolYear/semester fields: those are set once at registration and are
  // never updated afterward — the admin's "advance active term" action
  // (enrollActiveScholarsInSemester) only appends to enrolledSemesters, so a
  // scholar active for several terms still has their original registration
  // term in the flat fields. enrolledSemesters is the real per-term record;
  // fall back to the flat fields only for scholars with no term history yet
  // (e.g. a still-pending applicant).
  const matchesAcademicTerm = (a) => {
    const enrolled = Array.isArray(a.enrolledSemesters) ? a.enrolledSemesters : [];
    if (enrolled.length === 0) {
      return matchesExact(a.schoolYear, filterAY) && matchesExact(a.semester, filterSemester);
    }
    if (!filterAY && !filterSemester) return true;
    return enrolled.some(
      (e) => matchesExact(e.schoolYear, filterAY) && matchesExact(e.semester, filterSemester)
    );
  };

  // A "Scholar" is an applicant who has been approved into the program.
  // "pending" (awaiting review) and "rejected" applicants are not scholars
  // and must never count in scholar-facing reports/statistics, regardless
  // of the "All Statuses" filter — that filter only enumerates statuses a
  // scholar can hold (see the Scholar Status dropdown below), so "all"
  // means all scholar statuses, not literally every applicant.
  const SCHOLAR_STATUSES = ['approved', 'active', 'on-hold', 'graduated', 'terminated'];

  const getFilteredScholars = () => {
    return applicants.filter(a => {
      if (!SCHOLAR_STATUSES.includes(a.status)) return false;
      if (!matchesExact(a.school, filterHEI)) return false;
      if (!matchesExact(a.program, filterProgram)) return false;
      if (!matchesExact(a.status, filterStatus)) return false;
      if (!matchesAcademicTerm(a)) return false;
      if (filterYearLevel && String(a.yearLevel || '') !== String(filterYearLevel)) return false;
      if (!matchesExact(a.barangay, filterBarangay)) return false;
      // Sex filter reads the stored `gender` field ("Male"/"Female").
      if (!matchesExact(a.gender, filterSex)) return false;
      return true;
    });
  };

  // --- Applicant Reports — a dedicated pool, dedicated helpers -------------
  // An "Applicant" is the mirror image of a Scholar: still in the pipeline,
  // i.e. every status NOT in SCHOLAR_STATUSES (in practice just 'pending'
  // and 'rejected' — the only two values Applications.jsx itself ever writes
  // to a still-in-progress applicant; see its own identical `isStillApplicant`
  // filter). Applicant Reports must never include a Scholar record, and
  // Scholar reports must never include an Applicant — this is the single
  // shared boundary both pools are built from.
  const getApplicantPool = () => applicants.filter((a) => !SCHOLAR_STATUSES.includes(a.status));

  // The admin-managed Application Requirements catalog — same shape/rule
  // Applications.jsx builds it with (REQUIREMENTS_LIST/visibleRequirementsFor
  // there), reproduced here rather than imported since it's page-local state
  // shaping, not a shared utility.
  const REQUIREMENTS_LIST = (catalogRequirements || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((r) => ({ key: r.id, label: r.name, active: r.active !== false }));
  const visibleRequirementsFor = (applicant) =>
    REQUIREMENTS_LIST.filter((r) => r.active || applicant?.requirements?.[r.key]);

  // Single source of truth for "is this applicant ready to be approved" —
  // the exact same helper Applications.jsx's Approve button and Bulk
  // Approval already use (utils/applicantEligibility.js). Reused here purely
  // to REPORT on evaluation/requirements/approval readiness — reports never
  // call approve/reject and never write anything back.
  const applicantEligibility = (a) =>
    getApprovalEligibility(a, REQUIREMENTS_LIST, evaluationRubric, getRequirementVerification);

  const applicantRequirementsSummary = (a) => {
    const visible = visibleRequirementsFor(a);
    const submitted = visible.filter((r) => a.requirements?.[r.key]);
    const missing = visible.filter((r) => !a.requirements?.[r.key]).map((r) => r.label);
    const unverified = submitted.filter((r) => getRequirementVerification(a, r.key) !== 'verified');
    return {
      submittedCount: submitted.length,
      totalCount: visible.length,
      complete: visible.length > 0 && submitted.length === visible.length,
      missing,
      verificationStatus: submitted.length === 0 ? 'N/A' : unverified.length === 0 ? 'Verified' : 'Pending Verification',
    };
  };

  // Reads the stored `examScore` directly (present/absent), distinct from
  // applicantEligibility's stricter ">0 counts toward approval" rule — this
  // is just "does this applicant have an exam score on file".
  const applicantExamStatus = (a) => (a.examScore != null ? 'Taken' : 'Not Taken');

  // Derived, report-only label — never written back, never a stored status.
  // Reuses the same eligibility check Applications.jsx's Approve button
  // gates on, so it can never disagree with what an admin sees there.
  const applicantApprovalStatus = (a) => {
    if (a.status === 'rejected') return 'Rejected';
    return applicantEligibility(a).eligible ? 'Eligible for Approval' : 'Not Yet Eligible';
  };

  const getFilteredApplicantPool = () => {
    return getApplicantPool().filter((a) => {
      if (!matchesExact(a.school, filterHEI)) return false;
      if (!matchesExact(a.program, filterProgram)) return false;
      if (filterYearLevel && String(a.yearLevel || '') !== String(filterYearLevel)) return false;
      if (!matchesExact(a.barangay, filterBarangay)) return false;
      if (!matchesExact(a.gender, filterSex)) return false;
      if (!matchesExact(a.schoolYear, filterAY)) return false;
      if (!matchesExact(a.status, filterAppStatus)) return false;
      if (filterAge && String(computeAge(a) ?? '') !== String(filterAge)) return false;
      if (filterEconBackground && (economicScoreLabels[a.economicScore] || 'Not Tagged') !== filterEconBackground) return false;
      if (filterReqStatus) {
        const isComplete = applicantRequirementsSummary(a).complete;
        if (filterReqStatus === 'Complete' && !isComplete) return false;
        if (filterReqStatus === 'Incomplete' && isComplete) return false;
      }
      if (filterEvalStatus) {
        const isComplete = applicantEligibility(a).isFullyScored;
        if (filterEvalStatus === 'Complete' && !isComplete) return false;
        if (filterEvalStatus === 'Incomplete' && isComplete) return false;
      }
      if (filterExamStatus && applicantExamStatus(a) !== filterExamStatus) return false;
      if (filterApprovalStatus && applicantApprovalStatus(a) !== filterApprovalStatus) return false;
      return true;
    });
  };

  // HEI options: the eligible-schools catalog (managed in System Settings,
  // Firestore-backed) PLUS any school name that actually appears on a scholar
  // record. Scholar records store the full catalog name (e.g. "Luna Goco
  // Colleges, Inc."), not the old hardcoded short names ("Luna Colleges") that
  // used to live here — using those meant every HEI-filtered/per-HEI report
  // matched zero records. Mirrors the same fix already applied in Scholars.jsx.
  const schoolOptions = Array.from(new Set([
    ...(catalogSchools || []).map(s => s?.name).filter(Boolean),
    ...applicants.map(a => a?.school).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  // Program options: same reasoning as schoolOptions — the eligible-programs
  // catalog PLUS any program name that actually appears on a scholar record.
  const programOptions = Array.from(new Set([
    ...(catalogPrograms || []).map(p => p?.name).filter(Boolean),
    ...applicants.map(a => a?.program).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  // Barangay is free text captured at scholar registration (see AppContext's
  // buildAddress) — no fixed catalog exists, so options come from whatever
  // values are actually on file, same pattern as schoolOptions.
  const barangayOptions = Array.from(new Set(
    applicants.map(a => a?.barangay).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  // Year Level options: whatever values actually appear on scholar records —
  // matches Scholars.jsx's own Year Level filter (Number(scholar.yearLevel)).
  const yearLevelOptions = Array.from(new Set(
    applicants.map(a => a?.yearLevel).filter((v) => v != null && v !== '')
  )).sort((a, b) => Number(a) - Number(b));

  // Academic Year options: the School Year Management catalog (Firestore-backed)
  // PLUS any schoolYear label that actually appears on a scholar record, so a
  // newly-added or historical year is always selectable — same pattern as
  // schoolOptions above.
  const academicYearOptions = Array.from(new Set([
    ...(schoolYears || []).map(sy => sy?.label).filter(Boolean),
    ...applicants.map(a => a?.schoolYear).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  // A report titled "(All HEIs)" claims something untrue once a single HEI is
  // selected, so the on-screen heading and the PDF title both follow the filter.
  // The dropdown keeps the registry name — that names the report *type*, not
  // this particular run of it.
  const reportDisplayTitle = (name) => (
    filterHEI && name ? name.replace(/\(All HEIs\)/i, `(${filterHEI})`) : name
  );

  // Same reasoning for the download: exporting one master list per school
  // otherwise yields Master_List_All_HEIs.pdf, (1), (2)... with no way to tell
  // them apart.
  const reportFileName = (base) => {
    if (!filterHEI || !base) return base;
    const slug = filterHEI.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    return `${base.replace(/_?All_HEIs/i, '')}_${slug}`;
  };

  // Shown in place of the old "Generated: <timestamp>" line — a report is defined
  // by the term it covers, not the moment it was printed. The HEI is deliberately
  // not repeated here; reportDisplayTitle already names it in the heading above.
  // Plain ASCII separator: jsPDF's built-in fonts are WinAnsi-encoded.
  // Every applied filter, so a printed report is self-describing without
  // needing the on-screen filter bar next to it (requirement: "Applied
  // filters" in the print header). Only non-default filters are listed.
  const reportScopeLabel = () => {
    const isApplicantReport = getSelectedReportInfo()?.category === REPORT_CATEGORIES.APPLICANT;
    const parts = isApplicantReport
      ? [`Academic Year: ${filterAY || 'All Academic Years'}`]
      : [
          `Semester: ${filterSemester || 'All Semesters'}`,
          `Academic Year: ${filterAY || 'All Academic Years'}`,
        ];
    if (filterHEI) parts.push(`School: ${getSchoolDisplayLabel(filterHEI)}`);
    if (filterProgram) parts.push(`Program: ${getProgramDisplayLabel(filterProgram)}`);
    if (filterYearLevel) parts.push(`Year Level: ${ordinalYearLevel(filterYearLevel)}`);
    if (filterBarangay) parts.push(`Barangay: ${filterBarangay}`);
    if (filterSex) parts.push(`Sex: ${filterSex}`);
    if (isApplicantReport) {
      if (filterAppStatus) parts.push(`Application Status: ${filterAppStatus.toUpperCase()}`);
      if (filterAge) parts.push(`Age: ${filterAge}`);
      if (filterEconBackground) parts.push(`Economic Background: ${filterEconBackground}`);
      if (filterReqStatus) parts.push(`Requirements Status: ${filterReqStatus}`);
      if (filterEvalStatus) parts.push(`Evaluation Status: ${filterEvalStatus}`);
      if (filterExamStatus) parts.push(`Exam Status: ${filterExamStatus}`);
      if (filterApprovalStatus) parts.push(`Approval Status: ${filterApprovalStatus}`);
    } else if (filterStatus) {
      parts.push(`Status: ${filterStatus.toUpperCase()}`);
    }
    return parts.join('  |  ');
  };

  // Master list shows the full legal name including middle name. Blank parts are
  // dropped so a missing middle name doesn't leave a double space — the browser
  // collapses that, but the PDF export renders it literally.
  const fullName = (s) => [s.firstName, s.middleName, s.lastName]
    .map(part => (part || '').trim())
    .filter(Boolean)
    .join(' ');

  // Year level is derived from semesters used and clamped to the configured
  // program length — deliberately NOT the stored `yearLevel` field. This mirrors
  // getEffectiveYearLevel/getYearLevelText in Scholars.jsx so the report and the
  // Scholars list can't show a different year for the same person.
  const yearLevelText = (s) => {
    const maxYear = Math.ceil((systemSettings?.numberOfSemesters || 8) / 2);
    const year = Math.min(maxYear, Math.max(1, Math.ceil((Number(s?.semestersUsed) || 0) / 2)));
    const ordinals = ['1st', '2nd', '3rd', '4th'];
    return year <= 4 ? `${ordinals[year - 1]} Year` : `Year ${year}`;
  };

  // Plain "Nth Year" label for a raw yearLevel filter value (1, 2, 3, ...) —
  // used only for the Year Level filter's option labels, not tied to
  // semestersUsed the way yearLevelText above is.
  const ordinalYearLevel = (yl) => {
    const year = Number(yl) || 0;
    const ordinals = ['1st', '2nd', '3rd', '4th'];
    return year >= 1 && year <= 4 ? `${ordinals[year - 1]} Year` : `Year ${year}`;
  };

  // --- Shared financial helpers (fix for "editing a scholar's fee doesn't
  // reflect in disbursement/Total Granted") ---------------------------------
  // Every disbursement/financial report below is built on these three
  // wrappers around utils/granting.js's shared helpers (the SAME functions
  // Granting.jsx and Scholars.jsx already use to display a scholar's grant),
  // instead of the old flat `tuitionFee`/`amountGranted` fields multiplied by
  // semestersUsed. A scholar's actual total is always the SUM of their real,
  // stored per-semester grantedAmount records — never "current rate × count".
  const scholarPerSemGranted = (s) => getPerSemGranted(s, catalogPrograms, systemSettings?.scholarshipCap);
  const scholarGrantBreakdown = (s) => getGrantBreakdown(s, scholarPerSemGranted(s));
  const scholarTotalGranted = (s) =>
    scholarGrantBreakdown(s).semesterRows.reduce((sum, row) => sum + row.grantedAmount, 0);

  // Report Generation Functions
  // Shared "SCHOOL TOTALS … TOTAL" summary bar — a per-school scholar count
  // plus one grand total, rendered as its own footer band (on-screen, PDF,
  // and Excel) below the main table instead of as extra table rows. With
  // one School/HEI already selected there's nothing to break down, so it
  // collapses to a single TOTAL figure either way.
  const computeSchoolTotalsBar = (scholars) => {
    if (filterHEI) {
      return { items: [], grandLabel: 'TOTAL', grandTotal: scholars.length };
    }
    const schoolsPresent = Array.from(new Set(scholars.map((s) => s.school).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    const items = schoolsPresent.map((schoolName) => ({
      label: getSchoolDisplayLabel(schoolName),
      count: scholars.filter((s) => s.school === schoolName).length,
    }));
    return { items, grandLabel: 'TOTAL', grandTotal: scholars.length };
  };

  const generateMasterListAll = () => {
    const scholars = getFilteredScholars();
    // With a single HEI selected every row would repeat the same school, so the
    // column is dropped — the HEI is named once in the report heading instead
    // (see reportDisplayTitle), which keeps the exported PDF self-describing.
    const showHEI = !filterHEI;
    // Deliberately no Scholar ID column — this is a readable masterlist, not
    // a lookup table; School/Program show as abbreviations at export time
    // (see toDisplayRows) to keep the table narrow. Totals live in the
    // SCHOOL TOTALS/GRAND TOTAL bar below the table (see computeSchoolTotalsBar),
    // not as an extra row here.
    return scholars.map(s => ({
      'Full Name': fullName(s),
      ...(showHEI ? { 'School / HEI': s.school } : {}),
      'Program': s.program,
      'Year Level': yearLevelText(s),
      'Sex': s.gender || 'N/A',
      'Barangay': s.barangay || 'N/A',
      'Status': s.status ? s.status.toUpperCase() : 'N/A',
    }));
  };

  // Hierarchical Masterlist: School > Program actual records only — the
  // SCHOOL TOTALS/GRAND TOTAL summary lives entirely in the bar below the
  // table (see computeSchoolTotalsBar), not as extra rows mixed into the
  // data. School+Program selected = that program's count in that school;
  // School only = that school's programs; no filter = every school's
  // programs, with the bar showing every school's total plus the grand
  // total across ALL schools (never just the selected one).
  const generateMasterlistHierarchy = () => {
    const scholars = getFilteredScholars();
    const schoolsPresent = filterHEI
      ? [filterHEI]
      : Array.from(new Set(scholars.map(s => s.school).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    const dataRows = [];
    schoolsPresent.forEach((schoolName) => {
      const schoolScholars = scholars.filter((s) => s.school === schoolName);
      if (schoolScholars.length === 0) return;
      const programsPresent = filterProgram
        ? [filterProgram]
        : Array.from(new Set(schoolScholars.map((s) => s.program).filter(Boolean))).sort((a, b) => a.localeCompare(b));

      programsPresent.forEach((programName) => {
        const count = schoolScholars.filter((s) => s.program === programName).length;
        if (count === 0) return;
        dataRows.push({
          'School': getSchoolDisplayLabel(schoolName),
          'Program': getProgramDisplayLabel(programName),
          'Scholars': count,
        });
      });
    });
    return dataRows;
  };

  // Scholar List per HEI: when one School/HEI is selected, show that HEI's
  // actual scholar list + its total (financial figures live in the
  // Disbursement reports, not duplicated here). When no HEI is selected,
  // show every school's scholar COUNT plus one GRAND TOTAL — a summary
  // view, not a giant repeated-column dump of every scholar under every
  // school.
  const generateListPerHEI = () => {
    const scholars = getFilteredScholars();

    if (filterHEI) {
      const rows = scholars.map(s => ({
        'Scholar Name': fullName(s),
        'Program': s.program,
        'Year Level': yearLevelText(s),
        'Sex': s.gender || 'N/A',
        'Status': s.status ? s.status.toUpperCase() : 'N/A',
      }));
      return withTotalRow(rows, {
        'Scholar Name': 'TOTAL', Program: '', 'Year Level': '', Sex: '', Status: String(scholars.length),
      });
    }

    const schoolsPresent = Array.from(new Set(scholars.map(s => s.school).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const rows = schoolsPresent.map(schoolName => ({
      'HEI Name': getSchoolDisplayLabel(schoolName),
      'Number of Scholars': scholars.filter(s => s.school === schoolName).length,
    }));
    return withTotalRow(rows, { 'HEI Name': 'GRAND TOTAL', 'Number of Scholars': scholars.length });
  };

  // Computed age (in whole years) from the stored birthDate string — shared
  // by the aggregated Demographic Summary and the per-student detail below,
  // so the two views can never disagree about a scholar's age bracket.
  const computeAge = (s) => {
    if (!s?.birthDate) return null;
    const dob = new Date(s.birthDate);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const hadBirthdayThisYear =
      now.getMonth() > dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
    if (!hadBirthdayThisYear) age -= 1;
    return age;
  };

  // Applicant Reports-only filter option lists — built from the applicant
  // pool only (never from scholar records), same "distinct values actually
  // on file" pattern as barangayOptions/yearLevelOptions above.
  const econBackgroundOptions = Array.from(new Set(
    getApplicantPool().map((a) => economicScoreLabels[a.economicScore]).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
  const ageOptions = Array.from(new Set(
    getApplicantPool().map((a) => computeAge(a)).filter((v) => v != null)
  )).sort((a, b) => a - b);

  const generateDemographicProfile = () => {
    const scholars = getFilteredScholars();

    const total = scholars.length || 1;

    const sexMap = scholars.reduce((acc, s) => {
      const key = s.gender || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // Age buckets by single year where the range is small enough to be
    // useful (matches the spec's "18 = 10, 19 = 15, ..." example), falling
    // back to "17 & below"/"26+" catch-alls at the edges.
    const ageMap = {};
    scholars.forEach(s => {
      const age = computeAge(s);
      if (age == null) return;
      const key = age <= 17 ? '17 & below' : age >= 26 ? '26+' : String(age);
      ageMap[key] = (ageMap[key] || 0) + 1;
    });

    const locationMap = scholars.reduce((acc, s) => {
      const key = s.barangay || s.city || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // Existing economic-background categories/labels already defined in
    // Administration > Evaluation Criteria — never invented here.
    const socioeconomicMap = scholars.reduce((acc, s) => {
      const key = economicScoreLabels[s.economicScore] || 'Not Tagged';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const toRows = (dimension, mapObj, sortNumeric = false) => {
      const entries = Object.entries(mapObj);
      if (sortNumeric) entries.sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0));
      return entries.map(([value, count]) => ({
        'Profile Dimension': dimension,
        'Category': value,
        'Count': count,
        'Percentage': `${((count / total) * 100).toFixed(1)}%`,
      }));
    };

    const rows = [
      ...toRows('Sex', sexMap),
      ...toRows('Age', ageMap, true),
      ...toRows('Geographic Location (Barangay)', locationMap),
      ...toRows('Economic Background', socioeconomicMap),
    ];
    return withTotalRow(rows, {
      'Profile Dimension': 'TOTAL',
      Category: 'TOTAL SCHOLARS',
      Count: scholars.length,
      Percentage: '100%',
    });
  };

  // Per-student demographic detail — the same scholar rows as the Masterlist,
  // with the demographic columns (Age, Sex, Barangay, Economic Background)
  // added, per the "per-student demographic masterlist/detail" requirement.
  const generateDemographicPerStudent = () => {
    const scholars = getFilteredScholars();
    const showHEI = !filterHEI;
    const rows = scholars.map(s => ({
      'Scholar': fullName(s),
      'Age': computeAge(s) ?? 'N/A',
      'Sex': s.gender || 'N/A',
      'Barangay': s.barangay || 'N/A',
      ...(showHEI ? { School: s.school } : {}),
      'Program': s.program,
      'Economic Background': economicScoreLabels[s.economicScore] || 'Not Tagged',
    }));
    return withTotalRow(rows, {
      'Scholar': 'TOTAL SCHOLARS',
      Age: '',
      Sex: '',
      Barangay: '',
      ...(showHEI ? { School: '' } : {}),
      Program: '',
      'Economic Background': String(scholars.length),
    });
  };

  // Flat, ungrouped disbursement listing (legacy report, kept for the "Other
  // Reports" list) — each row's amount is now the scholar's actual per-sem
  // granted amount (not tuitionFee+miscFee, which is what's BILLED, not
  // necessarily what was granted).
  const generateSemesterDisbursement = () => {
    const scholars = getFilteredScholars().filter(s => s.status === 'active' || s.status === 'approved');
    const rows = scholars.map(s => ({
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Semester': s.semester || filterSemester || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Per-Semester Grant': `₱${scholarPerSemGranted(s).toLocaleString()}`,
      'Total Granted to Date': `₱${scholarTotalGranted(s).toLocaleString()}`,
      'Date Paid': s.paymentDate || 'Pending',
      'Payment Reference Number': s.paymentReference || 'N/A',
    }));
    const total = scholars.reduce((sum, s) => sum + scholarTotalGranted(s), 0);
    return withTotalRow(rows, {
      'Academic Year': '', Semester: '', 'Scholar Name': 'TOTAL',
      HEI: '', 'Per-Semester Grant': '', 'Total Granted to Date': `₱${total.toLocaleString()}`,
      'Date Paid': '', 'Payment Reference Number': '',
    });
  };

  // Disbursement — Per Semester: every distinct schoolYear+semester actually
  // on file (from real enrolledSemesters records, not a guess), with the
  // number of scholars granted that term and the real grantedAmount summed
  // for that term. The TOTAL row's scholar count is the report's overall
  // filtered scholar count, not a sum of the per-term counts — a scholar
  // granted across several terms would otherwise be counted once per term.
  const generateDisbursementPerSemester = () => {
    const scholars = getFilteredScholars();
    const totalsByTerm = new Map(); // "schoolYear::semester" -> { amount, scholarIds }
    scholars.forEach((s) => {
      const { semesterRows } = scholarGrantBreakdown(s);
      semesterRows.forEach((row) => {
        const key = `${row.schoolYear}::${row.semester}`;
        const entry = totalsByTerm.get(key) || { amount: 0, scholarIds: new Set() };
        entry.amount += row.grantedAmount;
        entry.scholarIds.add(s.id);
        totalsByTerm.set(key, entry);
      });
    });
    const rows = Array.from(totalsByTerm.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => {
        const [schoolYear, semester] = key.split('::');
        return {
          'Semester': `${semester}, ${schoolYear}`,
          'Number of Scholars': entry.scholarIds.size,
          'Total Granted': `₱${entry.amount.toLocaleString()}`,
        };
      });
    const grandTotal = Array.from(totalsByTerm.values()).reduce((s, v) => s + v.amount, 0);
    return withTotalRow(rows, {
      'Semester': 'TOTAL', 'Number of Scholars': scholars.length, 'Total Granted': `₱${grandTotal.toLocaleString()}`,
    });
  };

  // Disbursement — Per School (requirement #7B): total actually granted per
  // HEI — sum of every scholar's real per-semester records, grouped by school.
  const generateDisbursementPerSchool = () => {
    const scholars = getFilteredScholars();
    const schoolsPresent = filterHEI
      ? [filterHEI]
      : Array.from(new Set(scholars.map((s) => s.school).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const rows = schoolsPresent.map((schoolName) => {
      const schoolScholars = scholars.filter((s) => s.school === schoolName);
      const total = schoolScholars.reduce((sum, s) => sum + scholarTotalGranted(s), 0);
      return { 'School': getSchoolDisplayLabel(schoolName), 'Scholars': schoolScholars.length, 'Total Granted': `₱${total.toLocaleString()}` };
    });
    const grandTotal = rows.reduce((sum, r) => sum + Number(String(r['Total Granted']).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, { 'School': 'TOTAL', Scholars: scholars.length, 'Total Granted': `₱${grandTotal.toLocaleString()}` });
  };

  // Disbursement — Per Scholar: one row per actual granted semester record
  // (Scholar | School | Program | Semester | Amount Granted) — a scholar
  // granted for 3 semesters gets 3 rows, each showing that semester's real
  // stored amount, never today's rate multiplied by a semester count. The
  // TOTAL row sums every row's amount; it is a financial total, not a
  // scholar count, so scholars appearing in multiple rows are correctly
  // reflected in the sum without being "double-counted" as people (the
  // report is a grant ledger, not a headcount — see the Masterlist reports
  // for scholar counts).
  const generateDisbursementPerScholar = () => {
    const scholars = getFilteredScholars();
    const rows = scholars.flatMap((s) => {
      const { semesterRows } = scholarGrantBreakdown(s);
      return semesterRows.map((row) => ({
        'Scholar': fullName(s),
        'School': getSchoolDisplayLabel(s.school),
        'Program': getProgramDisplayLabel(s.program),
        'Semester': `${row.semester}, ${row.schoolYear}`,
        'Amount Granted': `₱${row.grantedAmount.toLocaleString()}`,
      }));
    });
    const grandTotal = rows.reduce((sum, r) => sum + Number(String(r['Amount Granted']).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, {
      'Scholar': 'TOTAL', School: '', Program: '', Semester: '',
      'Amount Granted': `₱${grandTotal.toLocaleString()}`,
    });
  };

  const generateHEIFundAllocation = () => {
    const scholars = getFilteredScholars();
    const rows = schoolOptions.map(schoolName => {
      const schoolScholars = scholars.filter(s => s.school === schoolName);
      const totalRequired = schoolScholars.reduce((sum, s) => sum + getEffectiveTuition(s, catalogPrograms), 0);
      const totalDisbursed = schoolScholars.reduce((sum, s) => sum + scholarTotalGranted(s), 0);
      const remaining = Math.max(0, totalRequired - totalDisbursed);

      return {
        'HEI Name': schoolName,
        'Number of Scholars': schoolScholars.length,
        'Total Required Funds': `₱${totalRequired.toLocaleString()}`,
        'Total Disbursed': `₱${totalDisbursed.toLocaleString()}`,
        'Remaining Budget': `₱${remaining.toLocaleString()}`,
      };
    });
    const sum = (key) => rows.reduce((s, r) => s + Number(String(r[key]).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, {
      'HEI Name': 'TOTAL', 'Number of Scholars': scholars.length,
      'Total Required Funds': `₱${sum('Total Required Funds').toLocaleString()}`,
      'Total Disbursed': `₱${sum('Total Disbursed').toLocaleString()}`,
      'Remaining Budget': `₱${sum('Remaining Budget').toLocaleString()}`,
    });
  };

  const generateProgramFinancialSummary = () => {
    const activeScholars = getFilteredScholars().filter(a => a.status === 'active' || a.status === 'approved');
    const totalBudget = activeScholars.reduce((sum, s) => sum + getEffectiveTuition(s, catalogPrograms), 0);
    const totalDisbursed = activeScholars.reduce((sum, s) => sum + scholarTotalGranted(s), 0);
    const variance = totalBudget - totalDisbursed;
    const avgCost = activeScholars.length > 0 ? totalDisbursed / activeScholars.length : 0;

    const rows = activeScholars.map(s => ({
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Semester': filterSemester || 'All',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Total Budget Required': `₱${getEffectiveTuition(s, catalogPrograms).toLocaleString()}`,
      'Total Funds Disbursed': `₱${scholarTotalGranted(s).toLocaleString()}`,
    }));
    return withTotalRow(rows, {
      'Academic Year': '', Semester: '', 'Scholar Name': `TOTAL (${activeScholars.length} scholars)`, HEI: '',
      'Total Budget Required': `₱${totalBudget.toLocaleString()}`,
      'Total Funds Disbursed': `₱${totalDisbursed.toLocaleString()} — Variance ₱${variance.toLocaleString()}, Avg ₱${avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/scholar`,
    });
  };

  // Unused Grant Monitoring — a scholar's actual tuition (getEffectiveTuition,
  // the same value Granting.jsx bills against) compared to their applicable
  // CEILING (program Tuition Cap, or the admin-configured base
  // scholarshipCap — getApplicableCap, deliberately NOT the already-capped
  // grant amount) — flags scholars whose actual tuition is below what the
  // program would otherwise allow.
  const generateUnusedGrant = () => {
    const scholars = getFilteredScholars();
    const rows = scholars
      .map((s) => ({
        s,
        actualTuition: getEffectiveTuition(s, catalogPrograms),
        cap: getApplicableCap(s, catalogPrograms, systemSettings?.scholarshipCap),
      }))
      .filter(({ actualTuition, cap }) => actualTuition < cap)
      .map(({ s, actualTuition, cap }) => ({
        'Scholar ID': s.scholarId || 'N/A',
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Actual Tuition': `₱${actualTuition.toLocaleString()}`,
        'Grant Cap': `₱${cap.toLocaleString()}`,
        'Unused Portion': `₱${(cap - actualTuition).toLocaleString()}`,
      }));
    const totalUnused = rows.reduce((sum, r) => sum + Number(String(r['Unused Portion']).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, {
      'Scholar ID': '', 'Scholar Name': 'TOTAL', HEI: '', 'Actual Tuition': '', 'Grant Cap': '',
      'Unused Portion': `₱${totalUnused.toLocaleString()}`,
    });
  };

  const generateAcademicPerformance = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => {
      const academicStatus = s.gwa <= 2.0 ? 'PASSED' : s.gwa <= 2.5 ? 'PROBATION' : 'FAILED';
      return {
        'Scholar ID': s.scholarId || 'N/A',
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Program': s.program,
        'Semester & AY': s.schoolYear || filterAY || 'N/A',
        'GWA': s.gwa || 'N/A',
        'Academic Status': academicStatus,
        'Remarks': s.notes || '',
      };
    });
  };

  const generateAtRiskScholars = () => {
    const GWA_THRESHOLD = 2.5;
    const scholars = getFilteredScholars().filter(s => s.gwa > GWA_THRESHOLD);
    
    return scholars.map(s => ({
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Program': s.program,
      'GPA Below Threshold': `${s.gwa} > ${GWA_THRESHOLD}`,
      'Failed Subjects': s.grades?.[0]?.subjects?.filter(sub => sub.grade > 3.0).length || 0,
      'Recommendation': s.gwa > 3.0 ? 'Probation' : 'Warning',
    }));
  };

  const generateRetentionContinuation = () => {
    const scholars = getFilteredScholars();

    return scholars.map(s => {
      const previousStatus = s.status === 'active' ? 'Active' : s.status === 'on-hold' ? 'On-Hold' : s.status;
      const enrollmentStatus = s.enrollmentStatus || (s.status === 'terminated' ? 'Not Enrolled' : 'Verified');
      const eligible = s.status === 'active' && (s.gwa || 5) <= 2.5;

      return {
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'Previous Semester Status': previousStatus?.toUpperCase(),
        'Current Enrollment Status': enrollmentStatus,
        'Eligibility Result': eligible ? 'ELIGIBLE' : s.status === 'terminated' ? 'NOT ELIGIBLE' : 'FOR REVIEW',
      };
    });
  };

  const generateRequirementsSubmission = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => {
      const status = s.status === 'active' || s.status === 'graduated' ? 'Complete' : s.status === 'terminated' ? 'Incomplete' : 'Partial';
      const submittedDate = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A';

      return {
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Required Documents': 'Application Form, COR, Grades, Agreement',
        'Submission Status': status,
        'Date Submitted': submittedDate,
        'Verified By': 'CED Admin',
      };
    });
  };

  const generateAgreementMonitoring = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => ({
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'Date Agreement Signed': s.agreementDate || 'Pending',
      'Parent/Guardian Signature Status': s.parentGuardianName ? 'Signed' : 'Pending',
      'HEI Certification Status': s.enrollmentStatus || 'For Verification',
    }));
  };

  const generateEnrollmentVerification = () => {
    const scholars = getFilteredScholars();
    return scholars.map(s => ({
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Program': s.program,
      'Units Enrolled': s.unitsEnrolled || 'N/A',
      'Semester': s.semester || filterSemester || 'N/A',
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Enrollment Status': s.enrollmentStatus || (s.status === 'terminated' ? 'Not Enrolled' : 'Verified'),
    }));
  };

  const generateOutstandingPayments = () => {
    const scholars = getFilteredScholars().filter(
      s => ['active', 'approved', 'on-hold'].includes(s.status)
    );

    const rows = scholars.map(s => {
      const approvedAmount = scholarPerSemGranted(s);
      const released = s.disbursementStatus === 'Completed' ? approvedAmount : 0;
      const balance = approvedAmount - released;

      return {
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Semester': s.semester || filterSemester || 'N/A',
        'Approved Amount': `₱${approvedAmount.toLocaleString()}`,
        'Amount Released': `₱${released.toLocaleString()}`,
        'Balance': `₱${balance.toLocaleString()}`,
        'Status': s.disbursementStatus || 'Pending',
      };
    });
    const sum = (key) => rows.reduce((acc, r) => acc + Number(String(r[key]).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, {
      'Scholar Name': 'TOTAL', HEI: '', Semester: '',
      'Approved Amount': `₱${sum('Approved Amount').toLocaleString()}`,
      'Amount Released': `₱${sum('Amount Released').toLocaleString()}`,
      'Balance': `₱${sum('Balance').toLocaleString()}`,
      'Status': '',
    });
  };

  const generateYearToYearGrowth = () => {
    const scholars = getFilteredScholars();
    const years = academicYearOptions;
    return years.map((year) => {
      const yearStart = Number(year.split('-')[0]);
      const scholarsForYear = scholars.filter(a => (a.yearAwarded || new Date(a.createdAt).getFullYear()) <= yearStart);
      const totalScholars = scholarsForYear.length;
      const graduates = scholarsForYear.filter(a => a.status === 'graduated').length;
      const newScholars = scholars.filter(a => (a.yearAwarded || new Date(a.createdAt).getFullYear()) === yearStart).length;
      const budget = scholarsForYear.reduce((sum, s) => sum + (s.amountGranted || 0), 0);

      return {
        'Academic Year': year,
        'Total Scholars': totalScholars,
        'Total Budget': `₱${budget.toLocaleString()}`,
        'New Scholars Added': newScholars,
        'Graduates': graduates,
      };
    });
  };

  // Year-to-Year Program Comparison — shared aggregation for both the flat
  // table below and its chart. A scholar counts once per school year even if
  // they have multiple enrolled semesters that year (via the Set), so this is
  // a headcount-per-year view, not a semester-disbursement ledger (see
  // generateDisbursementPerSemester for that).
  //
  // School year comes from each scholar's real per-term history
  // (scholarGrantBreakdown/enrolledSemesters — the same source
  // generateDisbursementPerSemester/PerScholar already use), not the flat
  // registration-time `schoolYear` field, so this reflects years actually
  // enrolled. A scholar with no enrolled-semester history yet (approved but
  // not yet enrolled into a term) falls back to their registration-time
  // schoolYear, matching matchesAcademicTerm's own fallback elsewhere in this
  // file.
  //
  // Program is the scholar's raw stored `program` value — deliberately NOT
  // passed through getProgramDisplayLabel, since that field already holds the
  // full program name; abbreviating it here would defeat the "use full
  // program names" requirement this report was built for.
  //
  // Known limitation: enrolledSemesters does not record which program a
  // scholar was in during each historical term, only the doc's current
  // `program` — so a scholar who switched programs appears under their
  // CURRENT program for every year shown, including past ones. This is the
  // same accepted tradeoff generateDisbursementPerSemester/PerScholar already
  // make; there is no per-term program field in the data model to do better.
  const yearToYearProgramCounts = () => {
    const scholars = getFilteredScholars();
    const countsByYear = new Map(); // schoolYear -> Map(program -> Set(scholarId))
    scholars.forEach((s) => {
      const programName = s.program || 'Unspecified Program';
      const { semesterRows } = scholarGrantBreakdown(s);
      const years = new Set(semesterRows.map((row) => row.schoolYear).filter(Boolean));
      if (years.size === 0 && s.schoolYear) years.add(s.schoolYear);
      years.forEach((year) => {
        if (!countsByYear.has(year)) countsByYear.set(year, new Map());
        const programMap = countsByYear.get(year);
        const set = programMap.get(programName) || new Set();
        set.add(s.id);
        programMap.set(programName, set);
      });
    });

    const years = Array.from(new Set([...academicYearOptions, ...countsByYear.keys()])).sort((a, b) => a.localeCompare(b));
    const programsSeen = Array.from(countsByYear.values()).flatMap((m) => Array.from(m.keys()));
    const programs = filterProgram
      ? [filterProgram]
      : Array.from(new Set([...programOptions, ...programsSeen])).sort((a, b) => a.localeCompare(b));

    return { countsByYear, years, programs };
  };

  const generateYearToYearProgramComparison = () => {
    const { countsByYear, years, programs } = yearToYearProgramCounts();
    const rows = [];
    years.forEach((year) => {
      const programMap = countsByYear.get(year) || new Map();
      programs.forEach((program) => {
        const count = programMap.get(program)?.size || 0;
        // Omit empty year/program combinations from the table — the chart
        // (built from the same data below) still plots them at zero.
        if (count === 0) return;
        rows.push({
          'School Year': year,
          'Program': program,
          'Number of Scholars': count,
        });
      });
    });
    const grandTotal = rows.reduce((sum, r) => sum + r['Number of Scholars'], 0);
    return withTotalRow(rows, { 'School Year': 'TOTAL', Program: '', 'Number of Scholars': grandTotal });
  };

  // Chart-ready pivot for the same report: one row per school year, one
  // numeric field per program (recharts needs {schoolYear, [program]: count}
  // shaped rows, not the flat table's one-row-per-combination shape). Built
  // from the exact same countsByYear map as the table above, so they can
  // never disagree.
  const generateYearToYearProgramComparisonChart = () => {
    const { countsByYear, years, programs } = yearToYearProgramCounts();
    const chartRows = years.map((year) => {
      const programMap = countsByYear.get(year) || new Map();
      const row = { schoolYear: year };
      programs.forEach((program) => {
        row[program] = programMap.get(program)?.size || 0;
      });
      return row;
    });
    return { chartRows, programs };
  };

  const generateCostPerGraduate = () => {
    const graduates = getFilteredScholars().filter(a => a.status === 'graduated');
    const rows = graduates.map(s => {
      const fundedSemesters = s.semestersUsed || 0;
      const totalReceived = scholarTotalGranted(s);
      const avgPerSemester = fundedSemesters > 0 ? totalReceived / fundedSemesters : 0;

      return {
        'Scholar ID': s.scholarId || 'N/A',
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Program': s.program,
        'Total Semesters Funded': fundedSemesters,
        'Total Amount Received': `₱${totalReceived.toLocaleString()}`,
        'Average Cost per Semester': `₱${avgPerSemester.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        'Graduation Status': 'Graduated',
      };
    });
    const total = rows.reduce((sum, r) => sum + Number(String(r['Total Amount Received']).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, {
      'Scholar ID': '', 'Scholar Name': `TOTAL (${graduates.length} graduates)`, HEI: '', Program: '',
      'Total Semesters Funded': '', 'Total Amount Received': `₱${total.toLocaleString()}`,
      'Average Cost per Semester': '', 'Graduation Status': '',
    });
  };

  const generateStatusSummary = () => {
    const scholars = getFilteredScholars();
    const statusRows = [
      { key: 'active', label: 'Total Active Scholars' },
      { key: 'on-hold', label: 'On Hold' },
      { key: 'terminated', label: 'Terminated' },
      { key: 'graduated', label: 'Graduated' },
      { key: 'transferred', label: 'Transferred' },
    ];

    return statusRows.map(({ key, label }) => {
      const matching = scholars.filter(a => a.status === key);
      return {
        'Status': label,
        'Count': matching.length,
        'Sample Scholars': matching.slice(0, 8).map(s => `${s.firstName} ${s.lastName}`).join(', ') || 'N/A',
        'Total Scholars': scholars.length,
      };
    });
  };

  // Graduation Report (requirement #4): "Graduation Progress: completed/
  // required" plus the percentage, computed dynamically as
  // completed/required*100 — never hard-coded. `completed` is the scholar's
  // actual semestersUsed at the time they graduated (never re-derived above
  // the configured program length); `required` is systemSettings.
  // numberOfSemesters, the same progression length used throughout the app.
  // This only ever READS status — it never sets 'graduated' itself; that
  // remains the existing Graduate action/semester-cap sweep's job alone.
  const generateGraduationReport = () => {
    const required = systemSettings?.numberOfSemesters || 8;
    const graduates = getFilteredScholars().filter(a => a.status === 'graduated');
    const rows = graduates.map(s => {
      const completed = Math.min(required, s.semestersUsed || 0);
      const pct = required > 0 ? ((completed / required) * 100).toFixed(1) : '0.0';
      return {
        'Scholar ID': s.scholarId || 'N/A',
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'HEI': s.school,
        'Program': s.program,
        'Date of Graduation': s.graduationDate || 'N/A',
        'Graduation Progress': `${completed}/${required}`,
        'Progress %': `${pct}%`,
        'Total Amount Received': `₱${scholarTotalGranted(s).toLocaleString()}`,
      };
    });
    const total = rows.reduce((sum, r) => sum + Number(String(r['Total Amount Received']).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, {
      'Scholar ID': '', 'Scholar Name': `TOTAL (${graduates.length} graduates)`, HEI: '', Program: '',
      'Date of Graduation': '', 'Graduation Progress': '', 'Progress %': '',
      'Total Amount Received': `₱${total.toLocaleString()}`,
    });
  };

  // Reuses the EXACT same eligibility rule as the "Graduating" filter in
  // Scholars.jsx (semestersUsed === numberOfSemesters - 1) — a scholar at
  // their final scholarship semester, not yet auto-graduated by the
  // semester-cap sweep in AppContext.jsx. This is deliberately the same
  // condition, not a re-derivation, so this report can never disagree with
  // that filter. "Graduating" here is a report/eligibility label only — it
  // never writes `status`; only the existing Graduate action (or the
  // semester-cap auto-graduation sweep) can ever set status to 'graduated'.
  const generateGraduatingScholars = () => {
    const maxSemesters = systemSettings?.numberOfSemesters || 8;
    const scholars = getFilteredScholars().filter(
      (s) => (s.semestersUsed || 0) === maxSemesters - 1
    );
    const rows = scholars.map(s => {
      const completed = s.semestersUsed || 0;
      const pct = maxSemesters > 0 ? ((completed / maxSemesters) * 100).toFixed(1) : '0.0';
      return {
        'Scholar Name': `${s.firstName} ${s.lastName}`,
        'Scholar ID': s.scholarId || 'N/A',
        'HEI': s.school,
        'Program': s.program,
        'Year Level': yearLevelText(s),
        'Academic Year': s.schoolYear || filterAY || 'N/A',
        'Progression': `${completed}/${maxSemesters}`,
        'Progress %': `${pct}%`,
        'Current Status': s.status?.toUpperCase() || 'N/A',
        'Enrollment Status': s.enrollmentStatus === 'Verified'
          ? 'ENROLLED'
          : s.enrollmentStatus === 'Not Enrolled'
          ? 'NOT ENROLLED'
          : 'FOR VERIFICATION',
      };
    });
    return withTotalRow(rows, {
      'Scholar Name': 'TOTAL APPROACHING GRADUATION', 'Scholar ID': '', HEI: '', Program: '', 'Year Level': '',
      'Academic Year': '', Progression: '', 'Progress %': '', 'Current Status': String(scholars.length), 'Enrollment Status': '',
    });
  };

  const generateTerminatedReport = () => {
    const terminated = getFilteredScholars().filter(a => a.status === 'terminated');
    const rows = terminated.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Reason for Termination': s.terminationReason || 'Not specified',
      'Date Terminated': s.terminationDate || 'N/A',
      'Total Funds Used': `₱${scholarTotalGranted(s).toLocaleString()}`,
    }));
    const total = rows.reduce((sum, r) => sum + Number(String(r['Total Funds Used']).replace(/[₱,]/g, '')), 0);
    return withTotalRow(rows, {
      'Scholar ID': '', 'Scholar Name': `TOTAL (${terminated.length})`, HEI: '', 'Reason for Termination': '',
      'Date Terminated': '', 'Total Funds Used': `₱${total.toLocaleString()}`,
    });
  };

  // Dashboard Summary Report Functions
  const generateTotalActiveScholars = () => {
    const scholars = getFilteredScholars();
    const activeScholars = scholars.filter(a => a.status === 'active');
    const totalScholars = scholars.length;
    const activePercentage = totalScholars > 0 ? ((activeScholars.length / totalScholars) * 100).toFixed(1) : '0.0';

    return activeScholars.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Program': s.program,
      'Year Level': s.yearLevel,
      'Scholarship Status': s.status?.toUpperCase() || 'ACTIVE',
      'Total Active Scholars': activeScholars.length,
      'Total Scholars': totalScholars,
      'Active Percentage': `${activePercentage}%`,
    }));
  };

  const generateFundsReleasedSemester = () => {
    const currentSemester = filterSemester || '1st Semester';
    const recipients = getFilteredScholars().filter(a =>
      (a.status === 'active' || a.status === 'approved') &&
      a.disbursementStatus === 'Completed'
    );

    const totalReleased = recipients.reduce((sum, s) => sum + scholarPerSemGranted(s), 0);
    const avgPerScholar = recipients.length > 0 ? totalReleased / recipients.length : 0;

    const rows = recipients.map(s => ({
      'Academic Year': s.schoolYear || filterAY || 'All',
      'Semester': currentSemester,
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Amount Released': `₱${scholarPerSemGranted(s).toLocaleString()}`,
      'Date Paid': s.paymentDate || 'N/A',
      'Payment Reference': s.paymentReference || 'N/A',
    }));
    return withTotalRow(rows, {
      'Academic Year': '', Semester: '', 'Scholar Name': `TOTAL (avg ₱${avgPerScholar.toLocaleString(undefined, { maximumFractionDigits: 0 })}/scholar)`,
      HEI: '', 'Amount Released': `₱${totalReleased.toLocaleString()}`, 'Date Paid': '', 'Payment Reference': '',
    });
  };

  const generateFundsRemaining = () => {
    const scholars = getFilteredScholars();
    const byHEI = schoolOptions.map(schoolName => {
      const schoolScholars = scholars.filter(a => a.school === schoolName);
      const disbursed = schoolScholars
        .filter(a => a.disbursementStatus === 'Completed')
        .reduce((sum, s) => sum + scholarTotalGranted(s), 0);
      const allocated = schoolScholars.reduce((sum, s) => sum + getEffectiveTuition(s, catalogPrograms), 0);
      const remaining = Math.max(allocated - disbursed, 0);

      return {
        'HEI': schoolName,
        'Allocated Funds': `₱${allocated.toLocaleString()}`,
        'Released Funds': `₱${disbursed.toLocaleString()}`,
        'Remaining Funds': `₱${remaining.toLocaleString()}`,
      };
    });

    const totalAllocated = byHEI.reduce((sum, row) => sum + Number(row['Allocated Funds'].replace(/[₱,]/g, '')), 0);
    const totalDisbursed = byHEI.reduce((sum, row) => sum + Number(row['Released Funds'].replace(/[₱,]/g, '')), 0);
    const remaining = totalAllocated - totalDisbursed;
    const utilizationRate = totalAllocated > 0 ? ((totalDisbursed / totalAllocated) * 100).toFixed(1) : '0.0';

    const rows = byHEI.map(row => ({ ...row }));
    return withTotalRow(rows, {
      'HEI': 'TOTAL',
      'Allocated Funds': `₱${totalAllocated.toLocaleString()}`,
      'Released Funds': `₱${totalDisbursed.toLocaleString()}`,
      'Remaining Funds': `₱${remaining.toLocaleString()} (${utilizationRate}% utilized)`,
    });
  };

  const generateScholarsPerHEI = () => {
    const scholars = getFilteredScholars();
    return schoolOptions.map(schoolName => {
      const schoolScholars = scholars.filter(s => s.school === schoolName);
      const active = schoolScholars.filter(s => s.status === 'active').length;
      const onHold = schoolScholars.filter(s => s.status === 'on-hold').length;
      const graduated = schoolScholars.filter(s => s.status === 'graduated').length;
      const terminated = schoolScholars.filter(s => s.status === 'terminated').length;

      return {
        'HEI Name': schoolName,
        'Active Scholars': active,
        'On-Hold': onHold,
        'Graduated': graduated,
        'Terminated': terminated,
        'Total Scholars': schoolScholars.length,
        'Active %': schoolScholars.length > 0 ? ((active / schoolScholars.length) * 100).toFixed(1) + '%' : '0%',
      };
    });
  };

  const generateAcademicStandingDistribution = () => {
    const scholarsWithGWA = getFilteredScholars().filter(a => a.gwa !== null && a.gwa !== undefined);
    
    const excellent = scholarsWithGWA.filter(s => s.gwa <= 1.5).length;
    const veryGood = scholarsWithGWA.filter(s => s.gwa > 1.5 && s.gwa <= 2.0).length;
    const good = scholarsWithGWA.filter(s => s.gwa > 2.0 && s.gwa <= 2.5).length;
    const fair = scholarsWithGWA.filter(s => s.gwa > 2.5 && s.gwa <= 3.0).length;
    const poor = scholarsWithGWA.filter(s => s.gwa > 3.0).length;
    
    const total = scholarsWithGWA.length || 1;
    
    const pct = (count) => ((count / total) * 100).toFixed(1) + '%';
    const getNames = (predicate) =>
      scholarsWithGWA
        .filter(predicate)
        .slice(0, 5)
        .map(s => `${s.firstName} ${s.lastName}`)
        .join(', ') || 'N/A';

    return [
      { 'GWA Range': '1.0 - 1.5', 'Standing': 'Excellent', 'Count': excellent, 'Percentage': pct(excellent), 'Sample Scholars': getNames(s => s.gwa <= 1.5) },
      { 'GWA Range': '1.51 - 2.0', 'Standing': 'Very Good', 'Count': veryGood, 'Percentage': pct(veryGood), 'Sample Scholars': getNames(s => s.gwa > 1.5 && s.gwa <= 2.0) },
      { 'GWA Range': '2.01 - 2.5', 'Standing': 'Good', 'Count': good, 'Percentage': pct(good), 'Sample Scholars': getNames(s => s.gwa > 2.0 && s.gwa <= 2.5) },
      { 'GWA Range': '2.51 - 3.0', 'Standing': 'Fair', 'Count': fair, 'Percentage': pct(fair), 'Sample Scholars': getNames(s => s.gwa > 2.5 && s.gwa <= 3.0) },
      { 'GWA Range': '> 3.0', 'Standing': 'Poor', 'Count': poor, 'Percentage': pct(poor), 'Sample Scholars': getNames(s => s.gwa > 3.0) },
      { 'GWA Range': 'Total', 'Standing': 'All', 'Count': scholarsWithGWA.length, 'Percentage': '100%', 'Sample Scholars': 'All Scholars' },
    ];
  };

  const generateGenderDistribution = () => {
    const scholars = getFilteredScholars();
    const maleCount = scholars.filter(a => a.gender === 'Male').length;
    const femaleCount = scholars.filter(a => a.gender === 'Female').length;
    const total = scholars.length || 1;

    return [
      { 'Sex': 'Male', 'Count': maleCount, 'Percentage': ((maleCount / total) * 100).toFixed(1) + '%' },
      { 'Sex': 'Female', 'Count': femaleCount, 'Percentage': ((femaleCount / total) * 100).toFixed(1) + '%' },
      { 'Sex': 'TOTAL', 'Count': total, 'Percentage': '100%', _rowType: 'total' },
    ];
  };

  const generateGraduationProgressRate = () => {
    const scholars = getFilteredScholars();
    const totalAwarded = scholars.length;
    const graduated = scholars.filter(a => a.status === 'graduated').length;
    const stillActive = scholars.filter(a => a.status === 'active').length;
    const terminated = scholars.filter(a => a.status === 'terminated').length;
    const onHold = scholars.filter(a => a.status === 'on-hold').length;

    const graduationRate = totalAwarded > 0 ? ((graduated / totalAwarded) * 100).toFixed(1) : '0';
    const retentionRate = totalAwarded > 0 ? (((graduated + stillActive) / totalAwarded) * 100).toFixed(1) : '0';
    const attritionRate = totalAwarded > 0 ? ((terminated / totalAwarded) * 100).toFixed(1) : '0';

    return scholars.map(s => ({
      'Scholar ID': s.scholarId || 'N/A',
      'Scholar Name': `${s.firstName} ${s.lastName}`,
      'HEI': s.school,
      'Current Status': s.status?.toUpperCase() || 'N/A',
      'Total Scholars Awarded': totalAwarded,
      'Graduated': graduated,
      'Still Active': stillActive,
      'On-Hold': onHold,
      'Terminated': terminated,
      'Graduation Rate': graduationRate + '%',
      'Retention Rate': retentionRate + '%',
      'Attrition Rate': attritionRate + '%',
    }));
  };

  // ── APPLICANT REPORTS ──────────────────────────────────────────────────
  // Dedicated to the applicant pool (getFilteredApplicantPool) only — never
  // the scholar pool. Read-only: every value below is computed from data
  // that already exists; nothing here ever writes back to an applicant
  // record (no approve/reject/score mutation happens anywhere in this file).

  const applicantFullName = (a) => `${a.lastName || ''}, ${a.firstName || ''}`.replace(/^, /, '').replace(/, $/, '');

  // 1. Applicant Masterlist
  const generateApplicantMasterlist = () => {
    const pool = getFilteredApplicantPool();
    const showHEI = !filterHEI;
    const rows = pool.map((a) => ({
      'Applicant Name': applicantFullName(a),
      ...(showHEI ? { 'School / HEI': a.school } : {}),
      'Program': a.program,
      'Year Level': ordinalYearLevel(a.yearLevel),
      'Sex': a.gender || 'N/A',
      'Age': computeAge(a) ?? 'N/A',
      'Barangay': a.barangay || 'N/A',
      'Application Status': a.status ? a.status.toUpperCase() : 'N/A',
      'Date Submitted': a.createdAt || 'N/A',
    }));
    return withTotalRow(rows, {
      'Applicant Name': 'TOTAL APPLICANTS',
      ...(showHEI ? { 'School / HEI': '' } : {}),
      Program: '', 'Year Level': '', Sex: '', Age: '', Barangay: '', 'Application Status': '',
      'Date Submitted': String(pool.length),
    });
  };

  // 2. Applicant Status Report — grouped by the applicant's ACTUAL stored
  // `status` value. While still an applicant, that is only ever 'pending' or
  // 'rejected' — the moment an applicant is approved they become a Scholar
  // (SCHOLAR_STATUSES) and move to the Masterlist reports instead, so no
  // "Approved" row ever appears here. Detailed per-applicant listing for any
  // one status is the Applicant Masterlist with Application Status filtered
  // to it — the same "filter narrows every report" pattern used everywhere
  // else in this module, not a second bespoke drill-down UI.
  const generateApplicantStatusReport = () => {
    const pool = getFilteredApplicantPool();
    const statusMap = pool.reduce((acc, a) => {
      const key = a.status || 'pending';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const total = pool.length || 1;
    const rows = Object.entries(statusMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([status, count]) => ({
        'Status': status.toUpperCase(),
        'Applicants': count,
        'Percentage': `${((count / total) * 100).toFixed(1)}%`,
      }));
    return withTotalRow(rows, { Status: 'TOTAL APPLICANTS', Applicants: pool.length, Percentage: '100%' });
  };

  // 3. Applicant Demographic Report — same four dimensions (Sex / Age /
  // Barangay / Economic Background) as the Scholar Demographic Summary, over
  // the applicant pool instead. "Sex", never "Gender".
  const generateApplicantDemographic = () => {
    const pool = getFilteredApplicantPool();
    const total = pool.length || 1;

    const sexMap = pool.reduce((acc, a) => {
      const key = a.gender || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const ageMap = {};
    pool.forEach((a) => {
      const age = computeAge(a);
      if (age == null) return;
      const key = age <= 17 ? '17 & below' : age >= 26 ? '26+' : String(age);
      ageMap[key] = (ageMap[key] || 0) + 1;
    });

    const locationMap = pool.reduce((acc, a) => {
      const key = a.barangay || a.city || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const socioeconomicMap = pool.reduce((acc, a) => {
      const key = economicScoreLabels[a.economicScore] || 'Not Tagged';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const toRows = (dimension, mapObj, sortNumeric = false) => {
      const entries = Object.entries(mapObj);
      if (sortNumeric) entries.sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0));
      return entries.map(([value, count]) => ({
        'Profile Dimension': dimension,
        'Category': value,
        'Count': count,
        'Percentage': `${((count / total) * 100).toFixed(1)}%`,
      }));
    };

    const rows = [
      ...toRows('Sex', sexMap),
      ...toRows('Age', ageMap, true),
      ...toRows('Geographic Location (Barangay)', locationMap),
      ...toRows('Economic Background', socioeconomicMap),
    ];
    return withTotalRow(rows, {
      'Profile Dimension': 'TOTAL', Category: 'TOTAL APPLICANTS', Count: pool.length, Percentage: '100%',
    });
  };

  // 4. Applicant Requirements Report — reuses the exact same requirements
  // catalog + submission/verification data Applications.jsx's Requirements
  // Review modal reads (REQUIREMENTS_LIST, applicant.requirements,
  // getRequirementVerification). Nothing here is invented.
  const generateApplicantRequirements = () => {
    const pool = getFilteredApplicantPool();
    const showHEI = !filterHEI;
    const rows = pool.map((a) => {
      const summary = applicantRequirementsSummary(a);
      return {
        'Applicant': applicantFullName(a),
        ...(showHEI ? { 'School / HEI': a.school } : {}),
        'Program': a.program,
        'Requirement Progress': `${summary.submittedCount}/${summary.totalCount}`,
        'Requirements Status': summary.complete ? 'Complete' : 'Incomplete',
        'Missing / Pending Requirements': summary.missing.length > 0 ? summary.missing.join(', ') : '—',
        'Verification Status': summary.verificationStatus,
      };
    });
    const completeCount = rows.filter((r) => r['Requirements Status'] === 'Complete').length;
    return withTotalRow(rows, {
      'Applicant': 'TOTAL APPLICANTS',
      ...(showHEI ? { 'School / HEI': '' } : {}),
      Program: '', 'Requirement Progress': `${completeCount}/${pool.length} complete`,
      'Requirements Status': '', 'Missing / Pending Requirements': '',
      'Verification Status': String(pool.length),
    });
  };

  // 5. Applicant Evaluation / Exam Report — Exam/Requirements/Economic
  // scores exactly as stored, plus the Overall Evaluation score from the
  // SAME formula Applications.jsx uses (computeTotalScore via
  // getApprovalEligibility — no new scoring formula). Any admin-configured
  // custom criteria (Administration > Evaluation Criteria) show as their own
  // columns automatically, under their own configured name — this report
  // never hardcodes "Academic Score"/"Activity Score" columns that don't
  // exist in the data model; if an admin adds one as a custom criterion, it
  // appears here by that name. Missing scores are never shown as 0 — only a
  // fully-scored applicant (isFullyScored) gets a computed Overall
  // Evaluation figure, matching the same rule Applications.jsx's Approve
  // button already gates on.
  const generateApplicantEvaluation = () => {
    const pool = getFilteredApplicantPool();
    const showHEI = !filterHEI;
    const reqMax = rubricMaxPoints(evaluationRubric.requirementsRubric);
    const econMax = rubricMaxPoints(evaluationRubric.economicRubric);
    const customCriteria = evaluationRubric.customCriteria || [];

    const rows = pool.map((a) => {
      const elig = applicantEligibility(a);
      const row = {
        'Applicant': applicantFullName(a),
        ...(showHEI ? { 'School / HEI': a.school } : {}),
        'Program': a.program,
        'Exam Score': a.examScore != null ? `${a.examScore}/100` : 'Not Taken',
        'Requirements Score': a.requirementsScore != null ? `${a.requirementsScore}/${reqMax} pts` : 'Not Scored',
        'Economic Score': a.economicScore != null ? `${a.economicScore}/${econMax} pts` : 'Not Rated',
      };
      customCriteria.forEach((c) => {
        const raw = a.customCriteriaScores?.[c.id];
        row[c.name] = raw != null ? String(raw) : 'Not Scored';
      });
      row['Overall Evaluation'] = elig.isFullyScored ? `${elig.totalScore}/100` : 'Incomplete — Pending Scores';
      row['Result'] = elig.isFullyScored ? (elig.meetsThreshold ? 'Qualifies' : 'Below Threshold') : 'Pending';
      return row;
    });

    const scoredCount = pool.filter((a) => applicantEligibility(a).isFullyScored).length;
    const fill = {
      'Applicant': 'TOTAL APPLICANTS',
      ...(showHEI ? { 'School / HEI': '' } : {}),
      Program: '', 'Exam Score': '', 'Requirements Score': '', 'Economic Score': '',
    };
    customCriteria.forEach((c) => { fill[c.name] = ''; });
    fill['Overall Evaluation'] = `${scoredCount}/${pool.length} fully scored`;
    fill['Result'] = String(pool.length);
    return withTotalRow(rows, fill);
  };

  // 6. Applicant Approval Report — READ ONLY. Reports the same eligibility
  // the Approve button already computes; never approves/rejects/changes
  // status/modifies scores itself. No "Date Approved" column: once approved
  // an applicant becomes a Scholar and leaves this pool entirely, and no
  // such date is stored anywhere in the data model (flagged in the
  // implementation summary as a genuine data-model gap, not invented here).
  const generateApplicantApproval = () => {
    const pool = getFilteredApplicantPool();
    const showHEI = !filterHEI;
    const rows = pool.map((a) => {
      const elig = applicantEligibility(a);
      const reqComplete = applicantRequirementsSummary(a).complete;
      return {
        'Applicant': applicantFullName(a),
        ...(showHEI ? { 'School / HEI': a.school } : {}),
        'Program': a.program,
        'Evaluation Status': elig.isFullyScored ? 'Complete' : 'Incomplete',
        'Requirements Status': reqComplete ? 'Complete' : 'Incomplete',
        'Approval Status': applicantApprovalStatus(a),
        'Remarks': a.status === 'rejected' ? (a.rejectionReason || '—') : (elig.reasons.length > 0 ? elig.reasons.join('; ') : '—'),
      };
    });
    const eligibleCount = rows.filter((r) => r['Approval Status'] === 'Eligible for Approval').length;
    return withTotalRow(rows, {
      'Applicant': 'TOTAL APPLICANTS',
      ...(showHEI ? { 'School / HEI': '' } : {}),
      Program: '', 'Evaluation Status': '', 'Requirements Status': '',
      'Approval Status': `${eligibleCount} eligible`, 'Remarks': String(pool.length),
    });
  };

  // 7. Pending / Incomplete Applicants Report — every applicant still
  // pending (not rejected — a rejection is a final decision, not an
  // "incomplete" state) who isn't yet eligible for approval, with the exact
  // reasons from getApprovalEligibility (missing/unverified requirements,
  // missing exam/economic/requirements score) — never invented reasons.
  const generatePendingIncompleteApplicants = () => {
    const pool = getFilteredApplicantPool().filter((a) => a.status !== 'rejected');
    const showHEI = !filterHEI;
    const rows = pool
      .map((a) => ({ a, elig: applicantEligibility(a) }))
      .filter(({ elig }) => !elig.eligible)
      .map(({ a, elig }) => ({
        'Applicant': applicantFullName(a),
        ...(showHEI ? { 'School / HEI': a.school } : {}),
        'Program': a.program,
        'Issue': elig.reasons.join('; '),
        'Status': 'Pending / Incomplete',
      }));
    return withTotalRow(rows, {
      'Applicant': 'TOTAL PENDING / INCOMPLETE',
      ...(showHEI ? { 'School / HEI': '' } : {}),
      Program: '', Issue: '', Status: String(rows.length),
    });
  };

  // Dispatches to the right generator above. Declared here (after every
  // generator, not before) so each reference below is to an already-declared
  // const — avoids a temporal-dead-zone footgun even though, since this is
  // only ever CALLED from an effect/event handler (never at this point in
  // the render), it would have worked either way.
  const generateReportData = (reportId) => {
    let data = [];
    let reportName = '';

    switch (reportId) {
      case 'masterlist-hierarchy': data = generateMasterlistHierarchy(); reportName = 'Masterlist_Hierarchy'; break;
      case 'master-list-all': data = generateMasterListAll(); reportName = 'Master_List_All_HEIs'; break;
      case 'list-per-hei': data = generateListPerHEI(); reportName = 'Scholar_List_Per_HEI'; break;
      case 'demographic-profile': data = generateDemographicProfile(); reportName = 'Demographic_Profile'; break;
      case 'demographic-per-student': data = generateDemographicPerStudent(); reportName = 'Demographic_Per_Student'; break;
      case 'disbursement-per-semester': data = generateDisbursementPerSemester(); reportName = 'Disbursement_Per_Semester'; break;
      case 'disbursement-per-school': data = generateDisbursementPerSchool(); reportName = 'Disbursement_Per_School'; break;
      case 'disbursement-per-scholar': data = generateDisbursementPerScholar(); reportName = 'Disbursement_Per_Scholar'; break;
      case 'semester-disbursement': data = generateSemesterDisbursement(); reportName = 'Semester_Disbursement'; break;
      case 'hei-fund-allocation': data = generateHEIFundAllocation(); reportName = 'HEI_Fund_Allocation'; break;
      case 'program-financial-summary': data = generateProgramFinancialSummary(); reportName = 'Program_Financial_Summary'; break;
      case 'unused-grant': data = generateUnusedGrant(); reportName = 'Unused_Grant_Monitoring'; break;
      case 'academic-performance': data = generateAcademicPerformance(); reportName = 'Academic_Performance'; break;
      case 'at-risk-scholars': data = generateAtRiskScholars(); reportName = 'At_Risk_Scholars'; break;
      case 'retention-continuation': data = generateRetentionContinuation(); reportName = 'Retention_Continuation'; break;
      case 'requirements-submission': data = generateRequirementsSubmission(); reportName = 'Requirements_Submission'; break;
      case 'agreement-monitoring': data = generateAgreementMonitoring(); reportName = 'Agreement_Monitoring'; break;
      case 'enrollment-verification': data = generateEnrollmentVerification(); reportName = 'Enrollment_Verification'; break;
      case 'outstanding-payment': data = generateOutstandingPayments(); reportName = 'Outstanding_Payment'; break;
      case 'year-to-year-growth': data = generateYearToYearGrowth(); reportName = 'Year_To_Year_Growth'; break;
      case 'year-to-year-program-comparison':
        data = generateYearToYearProgramComparison();
        reportName = 'Year_To_Year_Program_Comparison';
        break;
      case 'cost-per-graduate': data = generateCostPerGraduate(); reportName = 'Cost_Per_Graduate'; break;
      case 'status-summary': data = generateStatusSummary(); reportName = 'Status_Summary'; break;
      case 'graduation-report': data = generateGraduationReport(); reportName = 'Graduation_Report'; break;
      case 'graduating-scholars': data = generateGraduatingScholars(); reportName = 'Graduating_Scholars'; break;
      case 'terminated-dropped': data = generateTerminatedReport(); reportName = 'Terminated_Scholars'; break;
      case 'total-active-scholars': data = generateTotalActiveScholars(); reportName = 'Total_Active_Scholars'; break;
      case 'funds-released-semester': data = generateFundsReleasedSemester(); reportName = 'Funds_Released_This_Semester'; break;
      case 'funds-remaining': data = generateFundsRemaining(); reportName = 'Funds_Remaining'; break;
      case 'scholars-per-hei-graph': data = generateScholarsPerHEI(); reportName = 'Scholars_Per_HEI'; break;
      case 'academic-standing-distribution': data = generateAcademicStandingDistribution(); reportName = 'Academic_Standing_Distribution'; break;
      case 'gender-distribution': data = generateGenderDistribution(); reportName = 'Gender_Distribution'; break;
      case 'graduation-progress-rate': data = generateGraduationProgressRate(); reportName = 'Graduation_Progress_Rate'; break;
      case 'applicant-masterlist': data = generateApplicantMasterlist(); reportName = 'Applicant_Masterlist'; break;
      case 'applicant-status': data = generateApplicantStatusReport(); reportName = 'Applicant_Status_Report'; break;
      case 'applicant-demographic': data = generateApplicantDemographic(); reportName = 'Applicant_Demographic_Report'; break;
      case 'applicant-requirements': data = generateApplicantRequirements(); reportName = 'Applicant_Requirements_Report'; break;
      case 'applicant-evaluation': data = generateApplicantEvaluation(); reportName = 'Applicant_Evaluation_Exam_Report'; break;
      case 'applicant-approval': data = generateApplicantApproval(); reportName = 'Applicant_Approval_Report'; break;
      case 'applicant-pending-incomplete': data = generatePendingIncompleteApplicants(); reportName = 'Pending_Incomplete_Applicants'; break;
      default: data = []; reportName = 'Report';
    }
    // The SCHOOL TOTALS / GRAND TOTAL summary bar — rendered below the table
    // instead of as extra rows — applies to the two Masterlist reports whose
    // rows are broken down by school.
    const schoolTotals = data.length > 0 && (reportId === 'master-list-all' || reportId === 'masterlist-hierarchy')
      ? computeSchoolTotalsBar(getFilteredScholars())
      : null;
    // Chart pivot for the Year-to-Year Program Comparison report only — every
    // other report has no chart and these stay null. Built from the same
    // aggregation as the table above (see yearToYearProgramCounts), so the
    // chart and table can never disagree.
    const chart = reportId === 'year-to-year-program-comparison'
      ? generateYearToYearProgramComparisonChart()
      : null;
    return {
      data,
      name: reportName,
      schoolTotals,
      chartRows: chart?.chartRows || null,
      chartPrograms: chart?.programs || null,
    };
  };

  const handleReportSelect = (reportId) => {
    setSelectedReport(reportId);
    setReportSearchTerm('');
    setReportSortConfig({ column: null, direction: 'asc' });
    setReportCurrentPage(1);
    if (reportId) {
      const result = generateReportData(reportId);
      setReportData(result);
    } else {
      setReportData(null);
    }
  };

  // Auto-refresh report when filters change
  useEffect(() => {
    if (selectedReport) {
      const result = generateReportData(selectedReport);
      setReportData(result);
      setReportCurrentPage(1);
    }
  }, [
    filterHEI, filterProgram, filterYearLevel, filterBarangay, filterSex, filterSemester, filterAY, filterStatus,
    filterAppStatus, filterReqStatus, filterEvalStatus, filterExamStatus, filterApprovalStatus, filterEconBackground, filterAge,
  ]);

  // Generic export handlers
  // The signature-block role order every printed report follows — "Prepared
  // by" first, "Approved by" last. Mirrors SystemSettings.jsx's
  // SIGNATORY_ROLES (display-order constant, intentionally duplicated here —
  // it's just print layout, not business logic).
  const SIGNATORY_PRINT_ORDER = ['Prepared by', 'Reviewed by', 'Certified Correct by', 'Approved by', 'Noted by'];
  const SIGNATORY_ROW_HEIGHT = 26;

  // The signatory entries to print (falls back to a clean blank Prepared/
  // Reviewed/Approved placeholder when no signatories are configured yet —
  // never hard-codes a name) plus the exact vertical space the block needs.
  // Split out from drawSignatoryBlock so previewPDF can reserve this same
  // amount of trailer space on the table's LAST page up front — see the
  // "no orphan signatory page" fix there. Drawing and reservation always
  // agree because they both call this one function.
  const computeSignatoryLayout = () => {
    const activeRoles = SIGNATORY_PRINT_ORDER.filter((role) => (signatories || []).some((s) => s.role === role));
    const rolesToShow = activeRoles.length > 0 ? activeRoles : ['Prepared by', 'Reviewed by', 'Approved by'];
    const entries = rolesToShow.map((role) => ({
      role,
      person: [...(signatories || [])]
        .filter((s) => s.role === role)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0],
    }));
    // The whole block (however many rows of up to 3 signatories each) is one
    // indivisible unit — Prepared/Reviewed/Approved must never be split
    // across pages, so its height is always reserved and drawn as a whole.
    const neededHeight = Math.ceil(entries.length / 3) * SIGNATORY_ROW_HEIGHT + 10;
    return { entries, neededHeight };
  };

  // Draws the report's signature block (blank line + name + position per
  // signatory). No page-break/fit check here — previewPDF already reserved
  // enough trailer space on the table's final page for School Totals + this
  // block together (see computeSignatoryLayout/computeSchoolTotalsLayout and
  // the shared margin.bottom reservation there), so this always fits on
  // whatever page startY is already on. That reservation is what guarantees
  // the signatory section can never end up alone on its own page.
  const drawSignatoryBlock = (doc, startY) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const colWidth = (pageWidth - margin * 2) / 3;
    const { entries } = computeSignatoryLayout();
    const y = startY + 16;

    doc.setFontSize(9);
    entries.forEach((entry, idx) => {
      const col = idx % 3;
      const rowIdx = Math.floor(idx / 3);
      const x = margin + col * colWidth;
      const rowY = y + rowIdx * SIGNATORY_ROW_HEIGHT;
      doc.setFont(undefined, 'normal');
      doc.text(entry.role, x, rowY);
      doc.line(x, rowY + 14, x + colWidth - 10, rowY + 14);
      doc.setFont(undefined, 'bold');
      doc.text(entry.person?.name || '', x, rowY + 19);
      doc.setFont(undefined, 'normal');
      doc.text(entry.person?.position || '', x, rowY + 24);
    });
  };

  const SCHOOL_TOTALS_ENTRY_GAP = 12;
  const SCHOOL_TOTALS_ROW_HEIGHT = 6;

  // Lays out the SCHOOL TOTALS entries into as few lines as fit the page
  // width — horizontal when there's room, wrapping to additional lines
  // rather than shrinking text or running off the page — and returns the
  // exact vertical space the whole plain-text summary needs. Split out from
  // drawSchoolTotalsBar so previewPDF can reserve this same amount of
  // trailer space (together with the signatory block) on the table's LAST
  // page up front — see the "no orphan signatory page" fix there.
  const computeSchoolTotalsLayout = (doc, contentWidth, schoolTotals) => {
    if (!schoolTotals) return { rows: [], totalHeight: 0 };
    const items = schoolTotals.items || [];
    doc.setFontSize(8);
    const rows = [];
    if (items.length > 0) {
      let row = [];
      let rowWidth = 0;
      items.forEach((item) => {
        const entryWidth = doc.getTextWidth(`${item.label}  ${item.count}`);
        const needed = entryWidth + (row.length > 0 ? SCHOOL_TOTALS_ENTRY_GAP : 0);
        if (row.length > 0 && rowWidth + needed > contentWidth) {
          rows.push(row);
          row = [];
          rowWidth = 0;
        }
        row.push({ ...item, entryWidth });
        rowWidth += entryWidth + (row.length > 1 ? SCHOOL_TOTALS_ENTRY_GAP : 0);
      });
      rows.push(row);
    }
    const headingBlock = items.length > 0 ? 6 : 0;
    const listBlock = rows.length * SCHOOL_TOTALS_ROW_HEIGHT;
    const totalHeight = 9 + headingBlock + listBlock + (items.length > 0 ? 3 : 0) + 6;
    return { rows, totalHeight };
  };

  // Draws the SCHOOL TOTALS / TOTAL summary below the report table as a
  // plain, formal text block — deliberately NO card/colored container/
  // rounded box (a prior design), matching a printed report rather than a
  // dashboard panel: a thin separator rule, a small "SCHOOL TOTALS" heading,
  // each school's label+count, and a bold TOTAL line. No page-break/fit
  // check here — previewPDF already reserved enough trailer space on the
  // table's final page for this + the signatory block together (see
  // computeSchoolTotalsLayout and the shared margin.bottom reservation
  // there), so this always fits on whatever page startY is already on.
  // Returns the Y position just below it, for the signatory block.
  const drawSchoolTotalsBar = (doc, startY, schoolTotals) => {
    if (!schoolTotals) return startY;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const items = schoolTotals.items || [];
    const { rows } = computeSchoolTotalsLayout(doc, contentWidth, schoolTotals);

    // Subtle rule separating the totals from the table — no fill, no box.
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    doc.line(margin, startY + 2, pageWidth - margin, startY + 2);

    let cursorY = startY + 9;
    doc.setTextColor(30, 41, 59);

    if (items.length > 0) {
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('SCHOOL TOTALS', margin, cursorY);
      cursorY += 6;

      rows.forEach((row) => {
        let x = margin;
        row.forEach((item) => {
          doc.setFontSize(8);
          doc.setFont(undefined, 'normal');
          doc.text(item.label, x, cursorY);
          const labelWidth = doc.getTextWidth(item.label);
          doc.setFont(undefined, 'bold');
          doc.text(String(item.count), x + labelWidth + 4, cursorY);
          x += item.entryWidth + SCHOOL_TOTALS_ENTRY_GAP;
        });
        cursorY += SCHOOL_TOTALS_ROW_HEIGHT;
      });
      cursorY += 3;
    }

    doc.setFontSize(9.5);
    doc.setFont(undefined, 'bold');
    doc.text(`${schoolTotals.grandLabel}: ${schoolTotals.grandTotal}`, margin, cursorY);

    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    return cursorY + 6;
  };

  // Renders the SCHOOL TOTALS / GRAND TOTAL summary as extra sheet rows,
  // using the report's own first two columns so they land in the same
  // grid the data rows use instead of introducing stray columns.
  const buildSchoolTotalsExcelRows = (headers, schoolTotals) => {
    const [firstHeader, secondHeader] = headers;
    const blankRow = () => {
      const row = {};
      headers.forEach((h) => { row[h] = ''; });
      return row;
    };
    const rows = [blankRow()];
    if (schoolTotals.items.length > 0) {
      const sectionRow = blankRow();
      sectionRow[firstHeader] = 'SCHOOL TOTALS';
      rows.push(sectionRow);
      schoolTotals.items.forEach((item) => {
        const row = blankRow();
        row[firstHeader] = item.label;
        if (secondHeader) row[secondHeader] = item.count;
        rows.push(row);
      });
    }
    const grandRow = blankRow();
    grandRow[firstHeader] = schoolTotals.grandLabel;
    if (secondHeader) grandRow[secondHeader] = schoolTotals.grandTotal;
    rows.push(grandRow);
    return rows;
  };

  const exportToExcel = (data, filename, schoolTotals) => {
    // toDisplayRows both strips internal bookkeeping fields (e.g. _rowType on
    // grouped/TOTAL rows) and abbreviates School/HEI/Program — Excel should
    // only ever see real, print-ready report columns, matching what the
    // on-screen table and the PDF both show.
    const rows = toDisplayRows(data);
    if (schoolTotals && data.length > 0) {
      rows.push(...buildSchoolTotalsExcelRows(visibleHeaders(data[0]), schoolTotals));
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  };

  // Long free-text columns that are allowed to wrap across multiple lines in
  // the PDF table — every other column (Applicant Name, School/HEI, Year
  // Level, Sex, Age, Barangay, Application Status, Date Submitted, Scholars/
  // counts, etc.) must always render its full value on ONE line. This is
  // PDF-only layout logic; it has no on-screen counterpart.
  const PDF_WRAP_ALLOWED_HEADERS = new Set([
    'Program', 'Missing / Pending Requirements', 'Remarks', 'Issue',
  ]);

  // The width (in the doc's current font/size) of the single longest WORD in
  // a header — never the whole header string. A header may wrap onto a
  // second line at a space ("Application" / "Status" — fine), but no single
  // word within it may ever be narrower than the column, which is what
  // forces jsPDF to fall back to splitting the word itself letter-by-letter
  // ("Co" / "unt", "Perce" / "ntage"). Every column's width guarantees at
  // least this much room, regardless of how short its data values are.
  const headerWordMinWidth = (doc, header) => {
    const words = String(header).split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    return Math.max(...words.map((w) => doc.getTextWidth(w)));
  };

  // Computes a fixed cellWidth for every column except the wrap-allowed
  // ones, sized from that column's own widest value (data, or the header's
  // longest single word if that's wider) so it never has to break a short
  // value onto a second line — the whole point of the "keep names on one
  // line" requirement — and never has to split a header word letter-by-
  // letter either. Whatever page width is left over is handed to the
  // wrap-allowed column(s), which then wrap normally. Falls back to leaving
  // autoTable's own auto-fit in charge for a column when there's no
  // wrap-allowed column in this report to absorb the rest.
  const buildReportColumnStyles = (doc, contentWidth, headers, bodyRows) => {
    const cellPaddingH = 2 * 2.4 + 1; // matches styles.cellPadding below (both sides) + a small buffer
    const minWidth = 8;
    const maxFixedWidth = 55; // sanity cap — one long outlier value can't eat the page
    // Absolute floor for a wrap-allowed (e.g. Program) column — just enough
    // to avoid ever wrapping letter-by-letter. Only kicks in as a last
    // resort (see the scale-down step below); in the normal case the
    // wrap-allowed column gets whatever space is actually left over, which
    // is usually well above this.
    const flexAbsoluteFloor = 25;
    doc.setFontSize(8);

    const flexIndexes = [];
    let naturalWidths = headers.map((header, colIdx) => {
      if (PDF_WRAP_ALLOWED_HEADERS.has(header)) {
        flexIndexes.push(colIdx);
        return null; // sized from leftover space instead, see below
      }
      // Sized from the column's DATA values (a data value must always stay
      // on one full line — using the whole header too would needlessly
      // inflate columns like "Application Status"/"School / HEI" whose
      // header text is longer than any value that appears in them), but
      // never narrower than the header's longest single word (see
      // headerWordMinWidth) — the header itself may still wrap onto a
      // second line at a word boundary, just never split a word in half.
      let widest = 0;
      bodyRows.forEach((row) => {
        const w = doc.getTextWidth(String(row[colIdx] ?? ''));
        if (w > widest) widest = w;
      });
      widest = Math.max(widest, headerWordMinWidth(doc, header));
      return Math.min(maxFixedWidth, Math.max(minWidth, widest + cellPaddingH));
    });

    let fixedTotal = naturalWidths.reduce((sum, w) => sum + (w || 0), 0);
    const flexFloorTotal = flexAbsoluteFloor * (flexIndexes.length || 0);

    // Last-resort fallback: only if the "never wrap" columns alone would
    // already leave no room for the wrap-allowed column, scale them down
    // (never the font) just enough to guarantee that floor. This is rare —
    // it only fires when a report genuinely has too many wide one-line
    // columns to fit the page at once.
    if (flexIndexes.length > 0 && fixedTotal > contentWidth - flexFloorTotal) {
      const floor = Math.max(contentWidth - flexFloorTotal, minWidth * naturalWidths.filter((w) => w != null).length);
      const scale = floor / fixedTotal;
      naturalWidths = naturalWidths.map((w) => (w == null ? null : Math.max(minWidth, w * scale)));
      fixedTotal = naturalWidths.reduce((sum, w) => sum + (w || 0), 0);
    }

    const remainingForFlex = flexIndexes.length > 0
      ? Math.max(contentWidth - fixedTotal, flexAbsoluteFloor * flexIndexes.length)
      : 0;

    const columnStyles = {};
    headers.forEach((header, colIdx) => {
      const isNumeric = bodyRows.every((row) => {
        const v = row[colIdx];
        if (v == null || v === '') return true;
        return /^-?[\d,]+(\.\d+)?%?$/.test(String(v).trim());
      });
      const style = {};
      if (naturalWidths[colIdx] != null) {
        style.cellWidth = naturalWidths[colIdx];
      } else if (flexIndexes.length > 0) {
        style.cellWidth = remainingForFlex / flexIndexes.length;
      }
      if (header === '#' || isNumeric) style.halign = 'center';
      columnStyles[colIdx] = style;
    });
    return columnStyles;
  };

  // Builds the report PDF exactly as before, but instead of saving it
  // straight to disk, opens it in an in-app preview modal first — the admin
  // reviews the actual formatted/paginated document (letterhead, table
  // layout, page breaks) and only downloads it from there if it looks right.
  // PDF Preview and the downloaded PDF are the exact same jsPDF/autoTable
  // document — the preview modal just displays the same blob this function
  // produces (see setPdfPreview/downloadPreviewedPdf below) — so any change
  // here always applies identically to both, by construction.
  const previewPDF = async (data, title, filename, schoolTotals) => {
    const images = await loadLetterheadImages();
    const doc = new jsPDF('p', 'mm', 'letter');
    const { headerHeight, footerHeight } = getLetterheadLayout(doc);
    const margin = 14;
    const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;

    doc.setFontSize(16);
    doc.text(title, 14, headerHeight + 8);
    doc.setFontSize(10);
    doc.text(reportScopeLabel(), 14, headerHeight + 14);

    let finalY = headerHeight + 20;

    // No-orphan-page fix: School Totals + the signatory block must always
    // land together on the report's LAST page (never alone on a page of
    // their own — see requirement "no signatory-only page"). Reserving
    // their combined height as extra bottom margin on the table itself,
    // computed up front, guarantees autoTable's own pagination naturally
    // stops early enough on every page (including — critically — the last
    // one) to leave room for them, instead of drawing them afterward and
    // discovering there's no space left (which is what produced an orphan
    // signatory-only page before). A generous cap keeps this reservation
    // from ever starving the table itself in a pathological edge case
    // (a huge signatory roster, say).
    const schoolTotalsLayout = computeSchoolTotalsLayout(doc, contentWidth, schoolTotals);
    const signatoryLayout = computeSignatoryLayout();
    const trailerGap = 16; // matches drawSignatoryBlock's own startY+16 offset
    const trailerHeight = Math.min(
      schoolTotalsLayout.totalHeight + trailerGap + signatoryLayout.neededHeight,
      150
    );

    if (data.length > 0) {
      // Abbreviated School/HEI/Program (same as the on-screen table and
      // Excel) so the printed table stays narrow enough to fit the page
      // width instead of overflowing — see toDisplayRows/displayCellValue.
      const displayData = toDisplayRows(data);
      const dataHeaders = visibleHeaders(displayData[0]);
      // jsPDF's built-in fonts only support WinAnsi encoding, which has no ₱
      // glyph — it silently renders as "±" instead. Swap in an ASCII-safe
      // "PHP" prefix for the PDF only; Excel/on-screen keep the real ₱ symbol.
      const toPdfSafe = (val) => (typeof val === 'string' ? val.replace(/₱/g, 'PHP ') : val);
      // Leading "#" row-number column, matching the on-screen table — blank
      // on TOTAL/subtotal/section rows, same as there.
      const headers = ['#', ...dataHeaders];
      let rowNum = 0;
      const rows = displayData.map((row, i) => {
        const rowType = data[i]?._rowType;
        const numLabel = rowType ? '' : String(++rowNum);
        return [numLabel, ...dataHeaders.map(header => toPdfSafe(row[header]))];
      });

      autoTable(doc, {
        startY: headerHeight + 20,
        head: [headers],
        body: rows,
        // 'grid': thin bordered cells, plain white body, no alternating row
        // color — this call is local to previewPDF/Reports.jsx (the only
        // place jspdf-autotable is used in this app), so it only affects
        // report PDFs, never the on-screen Reports table or any other page.
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.4, // compact row height
          textColor: [30, 41, 59],
          fillColor: [255, 255, 255],
          lineColor: [180, 195, 205],
          lineWidth: 0.15,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [27, 77, 92], // dark teal
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          lineColor: [180, 195, 205],
          lineWidth: 0.15,
        },
        columnStyles: buildReportColumnStyles(doc, contentWidth, headers, rows),
        margin: { top: headerHeight + 20, bottom: footerHeight + 4 + trailerHeight, left: margin, right: margin },
        didDrawPage: () => drawLetterheadBands(doc, images),
        // Bold/shade section-header, subtotal, and TOTAL rows so they read
        // clearly and never get mistaken for ordinary data — same rows the
        // on-screen table bolds (see the _rowType-aware <tr> below).
        // `data` (not displayData) still carries _rowType, same order/length.
        didParseCell: (hookData) => {
          if (hookData.section !== 'body') return;
          const rowType = data[hookData.row.index]?._rowType;
          if (rowType === 'total') {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fillColor = [222, 236, 236];
          } else if (rowType === 'subtotal' || rowType === 'section-header') {
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fillColor = [240, 244, 246];
          }
        },
      });
      finalY = doc.lastAutoTable.finalY;
    } else {
      drawLetterheadBands(doc, images);
    }

    finalY = drawSchoolTotalsBar(doc, finalY, schoolTotals);
    drawSignatoryBlock(doc, finalY);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    // Replace any previous preview's object URL rather than leaking it.
    setPdfPreview(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { url, blob, filename, title };
    });
  };

  const closePdfPreview = () => {
    if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    setPdfPreview(null);
  };

  const downloadPreviewedPdf = () => {
    if (!pdfPreview) return;
    saveAs(pdfPreview.blob, `${pdfPreview.filename}.pdf`);
  };

  // Whether the currently-selected report belongs to the dedicated Applicant
  // Reports section — swaps the filter panel's scholar-only controls
  // (Semester, Scholar Status) for applicant-only ones (Application/
  // Requirements/Evaluation/Exam/Approval Status, Economic Background, Age).
  const isApplicantReportActive = getSelectedReportInfo()?.category === REPORT_CATEGORIES.APPLICANT;

  return (
    <div className="page reports-page">
      <Header
        title="Reports & Analytics"
        subtitle="Generate comprehensive reports for scholarship program monitoring"
        onMenuClick={onMenuClick}
      />

      {liveSummary && (
        <div className="dashboard-content" style={{ marginTop: '1rem' }}>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-label">Live Applications</div>
              <div className="stat-value">{liveSummary.applications}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Live Active Scholars</div>
              <div className="stat-value">{liveSummary.activeScholars}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Attendance Logs</div>
              <div className="stat-value">{liveSummary.attendanceLogs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Announcements</div>
              <div className="stat-value">{liveSummary.announcements}</div>
            </div>
          </div>
        </div>
      )}

      <div className="reports-content">
        {/* Report Selector & Filters — the Report Type dropdown below already
            groups every report (including the dedicated Applicant Reports
            category) by category, so the quick-pick category bars that used
            to sit above this card were removed rather than duplicating that
            picker. */}
        <div className="card filter-card">
          <div className="filter-grid">
            <div className="filter-item filter-item-wide">
              <label><FileText size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />Report Type</label>
              <div className="report-dropdown" ref={dropdownRef}>
                <button
                  type="button"
                  className={`report-dropdown-trigger ${selectedReport ? 'has-value' : ''}`}
                  onClick={() => setReportDropdownOpen(prev => !prev)}
                >
                  <span>{selectedReport ? reportTypes.find(r => r.id === selectedReport)?.name : '— Select a Report —'}</span>
                  <ChevronDown size={16} className={`dropdown-chevron ${reportDropdownOpen ? 'open' : ''}`} />
                </button>
                {reportDropdownOpen && (
                  <div className="report-dropdown-menu">
                    <button
                      type="button"
                      className="report-dropdown-item placeholder-item"
                      onClick={() => { handleReportSelect(null); setReportDropdownOpen(false); }}
                    >
                      — Clear Selection —
                    </button>
                    {Object.entries(REPORT_CATEGORIES).map(([key, category]) => {
                      const categoryReports = reportTypes.filter(r => r.category === category);
                      if (categoryReports.length === 0) return null;
                      return (
                        <div key={key} className="report-dropdown-group">
                          <div className="report-dropdown-group-label">{category}</div>
                          {categoryReports.map(r => {
                            const Icon = r.icon;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                className={`report-dropdown-item ${selectedReport === r.id ? 'active' : ''}`}
                                onClick={() => { handleReportSelect(r.id); setReportDropdownOpen(false); }}
                              >
                                <Icon size={14} />
                                <span>{r.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="filter-item">
              <label>Academic Year</label>
              <select value={filterAY} onChange={(e) => { setFilterAY(e.target.value); }}>
                <option value="">All Academic Years</option>
                {academicYearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            {!isApplicantReportActive && (
              <div className="filter-item">
                <label>Semester</label>
                <select value={filterSemester} onChange={(e) => { setFilterSemester(e.target.value); }}>
                  <option value="">All Semesters</option>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                </select>
              </div>
            )}
            <div className="filter-item">
              <label>School / HEI</label>
              <select value={filterHEI} onChange={(e) => { setFilterHEI(e.target.value); }}>
                <option value="">All Schools</option>
                {schoolOptions.map(schoolName => (
                  <option key={schoolName} value={schoolName}>{getSchoolDisplayLabel(schoolName)}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Program</label>
              <select value={filterProgram} onChange={(e) => { setFilterProgram(e.target.value); }}>
                <option value="">All Programs</option>
                {programOptions.map(name => (
                  <option key={name} value={name}>{getProgramDisplayLabel(name)}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Year Level</label>
              <select value={filterYearLevel} onChange={(e) => { setFilterYearLevel(e.target.value); }}>
                <option value="">All Year Levels</option>
                {yearLevelOptions.map(yl => (
                  <option key={yl} value={yl}>{ordinalYearLevel(yl)}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Barangay</label>
              <select value={filterBarangay} onChange={(e) => { setFilterBarangay(e.target.value); }}>
                <option value="">All Barangays</option>
                {barangayOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>Sex</label>
              <select value={filterSex} onChange={(e) => { setFilterSex(e.target.value); }}>
                <option value="">All / Both</option>
                <option value="Female">Female (All Girls)</option>
                <option value="Male">Male (All Boys)</option>
              </select>
            </div>
            {isApplicantReportActive ? (
              <>
                <div className="filter-item">
                  <label>Application Status</label>
                  <select value={filterAppStatus} onChange={(e) => { setFilterAppStatus(e.target.value); }}>
                    <option value="">All Statuses</option>
                    <option value="pending">PENDING</option>
                    <option value="rejected">REJECTED</option>
                  </select>
                </div>
                <div className="filter-item">
                  <label>Age</label>
                  <select value={filterAge} onChange={(e) => { setFilterAge(e.target.value); }}>
                    <option value="">All Ages</option>
                    {ageOptions.map((age) => (
                      <option key={age} value={age}>{age}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-item">
                  <label>Economic Background</label>
                  <select value={filterEconBackground} onChange={(e) => { setFilterEconBackground(e.target.value); }}>
                    <option value="">All Categories</option>
                    {econBackgroundOptions.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-item">
                  <label>Requirements Status</label>
                  <select value={filterReqStatus} onChange={(e) => { setFilterReqStatus(e.target.value); }}>
                    <option value="">All</option>
                    <option value="Complete">Complete</option>
                    <option value="Incomplete">Incomplete</option>
                  </select>
                </div>
                <div className="filter-item">
                  <label>Evaluation Status</label>
                  <select value={filterEvalStatus} onChange={(e) => { setFilterEvalStatus(e.target.value); }}>
                    <option value="">All</option>
                    <option value="Complete">Complete</option>
                    <option value="Incomplete">Incomplete</option>
                  </select>
                </div>
                <div className="filter-item">
                  <label>Exam Status</label>
                  <select value={filterExamStatus} onChange={(e) => { setFilterExamStatus(e.target.value); }}>
                    <option value="">All</option>
                    <option value="Taken">Taken</option>
                    <option value="Not Taken">Not Taken</option>
                  </select>
                </div>
                <div className="filter-item">
                  <label>Approval Status</label>
                  <select value={filterApprovalStatus} onChange={(e) => { setFilterApprovalStatus(e.target.value); }}>
                    <option value="">All</option>
                    <option value="Eligible for Approval">Eligible for Approval</option>
                    <option value="Not Yet Eligible">Not Yet Eligible</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="filter-item">
                <label>Scholar Status</label>
                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); }}>
                  <option value="">All Statuses</option>
                  <option value="active">ACTIVE</option>
                  <option value="on-hold">ON-HOLD</option>
                  <option value="terminated">TERMINATED</option>
                  <option value="graduated">GRADUATED</option>
                </select>
              </div>
            )}
            <div className="filter-item filter-item-reset">
              <label>&nbsp;</label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFilterHEI(''); setFilterProgram(''); setFilterYearLevel('');
                  setFilterBarangay(''); setFilterSex(''); setFilterStatus('');
                  setFilterAY(''); setFilterSemester('');
                  setFilterAppStatus(''); setFilterReqStatus(''); setFilterEvalStatus('');
                  setFilterExamStatus(''); setFilterApprovalStatus(''); setFilterEconBackground('');
                  setFilterAge('');
                }}
                title="Clear every filter — show all records"
              >
                <X size={14} /> Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* No report selected state */}
        {!selectedReport && (
          <div className="report-placeholder">
            <div className="report-placeholder-inner">
              <FileText size={56} strokeWidth={1} />
              <h3>Select a Report to Generate</h3>
              <p>Choose a report type from the dropdown above. You can further refine results using the Academic Year, Semester, HEI, and Status filters, then export as Excel or PDF.</p>
              <div className="report-quick-picks">
                <span className="quick-pick-label">Quick picks:</span>
                {[
                  { id: 'master-list-all', label: 'Master List' },
                  { id: 'semester-disbursement', label: 'Disbursement' },
                  { id: 'academic-performance', label: 'Academic' },
                  { id: 'status-summary', label: 'Status Summary' },
                  { id: 'scholars-per-hei-graph', label: 'Per HEI' },
                  { id: 'graduating-scholars', label: 'Graduating' },
                ].map(qp => (
                  <button
                    key={qp.id}
                    className="btn btn-sm btn-chip"
                    onClick={() => handleReportSelect(qp.id)}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Report Display */}
        {selectedReport && reportData && (() => {
          const info = getSelectedReportInfo();
          const Icon = info?.icon || FileText;
          // Excludes synthetic subtotal/TOTAL rows from the visible count —
          // those describe the data, they aren't scholar records themselves.
          const recordCount = reportData.data.filter((r) => r._rowType !== 'total' && r._rowType !== 'subtotal').length;
          return (
            <div className="report-display">
              {/* Report Header Bar */}
              <div className="report-display-header">
                <div className="report-display-title">
                  <Icon size={22} style={{ color: 'var(--primary-color)' }} />
                  <div>
                    <h3>{reportDisplayTitle(info?.name || reportData.name)}</h3>
                    <p>{info?.description}</p>
                  </div>
                </div>
                <div className="report-display-actions">
                  <span className="report-record-count">{recordCount} record{recordCount !== 1 ? 's' : ''}</span>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => exportToExcel(reportData.data, reportFileName(reportData.name), reportData.schoolTotals)}
                    disabled={reportData.data.length === 0}
                  >
                    <FileSpreadsheet size={16} />
                    Excel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => previewPDF(reportData.data, reportDisplayTitle(info?.name || reportData.name), reportFileName(reportData.name), reportData.schoolTotals)}
                    disabled={reportData.data.length === 0}
                  >
                    <Eye size={16} />
                    Preview PDF
                  </button>
                </div>
              </div>

              {/* Year-to-Year Program Comparison chart — only this report
                  carries chartRows; every other report leaves it null. */}
              {reportData.chartRows && reportData.chartRows.length > 0 && (
                <div className="chart-card" style={{ margin: '0 1.5rem 1rem' }}>
                  <h3 className="chart-title">Scholars per Program, by School Year</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={reportData.chartRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="schoolYear" stroke="var(--text-secondary)" />
                        <YAxis allowDecimals={false} stroke="var(--text-secondary)" />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                          }}
                        />
                        <RechartsLegend />
                        {(reportData.chartPrograms || []).map((program, idx) => (
                          <Bar key={program} dataKey={program} name={program} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Report Table */}
              <div className="report-table-wrapper">
                {reportData.data.length > 0 ? (() => {
                  // Grouped reports (Masterlist Hierarchy) carry subtotal rows
                  // interspersed with their data — sorting/paginating them
                  // would scramble the School > Program grouping, so those
                  // render in full, unsorted, exactly as generated. Every
                  // other report keeps the normal search/sort/pagination,
                  // with its single trailing TOTAL row (if any) pinned to
                  // print at the bottom of whichever page is showing.
                  // Exports above always use the full reportData.data untouched.
                  const allRows = reportData.data;
                  const isGrouped = allRows.some((r) => r._rowType === 'subtotal');
                  const trailingTotal = !isGrouped ? allRows.find((r) => r._rowType === 'total') : null;
                  const baseRows = isGrouped ? allRows : allRows.filter((r) => r._rowType !== 'total');

                  const term = reportSearchTerm.trim().toLowerCase();
                  const searchedRows = term
                    ? baseRows.filter((row) =>
                        visibleHeaders(row).some((h) => String(row[h] ?? '').toLowerCase().includes(term))
                      )
                    : baseRows;
                  const sortedRows = (!isGrouped && reportSortConfig.column)
                    ? [...searchedRows].sort((a, b) => {
                        const va = a[reportSortConfig.column];
                        const vb = b[reportSortConfig.column];
                        const na = toComparable(va);
                        const nb = toComparable(vb);
                        const cmp = (na !== null && nb !== null)
                          ? na - nb
                          : String(va ?? '').localeCompare(String(vb ?? ''));
                        return reportSortConfig.direction === 'asc' ? cmp : -cmp;
                      })
                    : searchedRows;
                  const totalReportPages = isGrouped ? 1 : Math.max(1, Math.ceil(sortedRows.length / reportItemsPerPage));
                  const safePage = isGrouped ? 1 : Math.min(reportCurrentPage, totalReportPages);
                  const pageStart = isGrouped ? 0 : (safePage - 1) * reportItemsPerPage;
                  const pagedRows = isGrouped ? sortedRows : sortedRows.slice(pageStart, pageStart + reportItemsPerPage);
                  const displayRows = trailingTotal ? [...pagedRows, trailingTotal] : pagedRows;
                  const headers = visibleHeaders(allRows[0]);
                  const rowClass = (row) =>
                    row._rowType === 'total' ? 'row-report-total'
                    : row._rowType === 'subtotal' ? 'row-report-subtotal'
                    : row._rowType === 'section-header' ? 'row-report-section'
                    : '';

                  return (
                    <>
                      <div className="filters-bar" style={{ marginBottom: '0.75rem' }}>
                        <div className="search-box">
                          <Search size={16} />
                          <input
                            type="text"
                            placeholder="Search this report's results..."
                            value={reportSearchTerm}
                            onChange={(e) => setReportSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: '2.5rem', textAlign: 'center' }}>#</th>
                              {headers.map(header => (
                                <th
                                  key={header}
                                  onClick={isGrouped ? undefined : () => handleReportSort(header)}
                                  style={{ cursor: isGrouped ? 'default' : 'pointer' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    {header}
                                    {!isGrouped && (reportSortConfig.column === header ? (
                                      reportSortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                    ) : (
                                      <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                                    ))}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {displayRows.map((row, idx) => (
                              <tr key={pageStart + idx} className={rowClass(row)}>
                                <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                  {row._rowType ? '' : pageStart + idx + 1}
                                </td>
                                {headers.map((header) => {
                                  const raw = row[header];
                                  const displayVal = displayCellValue(header, raw);
                                  const abbreviated = displayVal !== raw && raw != null && raw !== '';
                                  return (
                                    <td key={header} title={abbreviated ? String(raw) : undefined}>{displayVal}</td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {reportData.schoolTotals && (
                        <div className="school-totals-bar">
                          <div className="school-totals-items">
                            {reportData.schoolTotals.items.length > 0 && (
                              <span className="school-totals-label">School Totals</span>
                            )}
                            {reportData.schoolTotals.items.map((item) => (
                              <div key={item.label} className="school-totals-item">
                                <span className="school-totals-item-label">{item.label}</span>
                                <span className="school-totals-item-count">{item.count}</span>
                              </div>
                            ))}
                          </div>
                          <div className="school-totals-grand">
                            <span className="school-totals-grand-label">{reportData.schoolTotals.grandLabel}</span>
                            <span className="school-totals-grand-count">{reportData.schoolTotals.grandTotal}</span>
                          </div>
                        </div>
                      )}
                      {sortedRows.length === 0 ? (
                        <div className="empty-state">
                          <FileText size={40} />
                          <p>No results match your search.</p>
                        </div>
                      ) : (
                        <div className="pagination-container">
                          <div className="pagination-info">
                            Showing {pageStart + 1} to {Math.min(pageStart + reportItemsPerPage, sortedRows.length)} of {sortedRows.length}
                            {term || reportData.data.length !== sortedRows.length ? ` (of ${reportData.data.length} total)` : ''} record{sortedRows.length !== 1 ? 's' : ''}
                          </div>
                          <div className="pagination-controls">
                            <button
                              className="pagination-btn"
                              onClick={() => setReportCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={safePage === 1}
                            >
                              <ChevronLeft size={18} />
                              Previous
                            </button>
                            <span style={{ padding: '0 1rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                              Page {safePage} of {totalReportPages}
                            </span>
                            <button
                              className="pagination-btn"
                              onClick={() => setReportCurrentPage((p) => Math.min(totalReportPages, p + 1))}
                              disabled={safePage >= totalReportPages}
                            >
                              Next
                              <ChevronRight size={18} />
                            </button>
                          </div>
                          <div className="pagination-select-container">
                            <label>Items per page:</label>
                            <select
                              className="pagination-select"
                              value={reportItemsPerPage}
                              onChange={(e) => { setReportItemsPerPage(Number(e.target.value)); setReportCurrentPage(1); }}
                            >
                              <option value={10}>10</option>
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                            </select>
                          </div>
                        </div>
                      )}
                      <div className="report-table-footer">
                        <span>{reportScopeLabel()}</span>
                      </div>
                    </>
                  );
                })() : (
                  <div className="empty-state">
                    <FileText size={48} />
                    <p>No data available for this report with the current filters.</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Try adjusting the Academic Year, HEI, or Status filters above.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* PDF Preview Modal — shows the actual formatted/paginated document
          before it's downloaded, same "view before download" pattern used
          for submitted requirements in Applications.jsx. */}
      {pdfPreview && (
        <div className="modal-overlay" onClick={closePdfPreview}>
          <div className="modal" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{pdfPreview.title}</h2>
              <button className="modal-close" onClick={closePdfPreview}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {/* Browsers render PDFs natively inside an iframe — no extra
                  library needed. */}
              <iframe
                src={pdfPreview.url}
                title={pdfPreview.title}
                style={{ width: '100%', height: '70vh', border: '1px solid var(--border-color)', borderRadius: '0.5rem', background: '#fff' }}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closePdfPreview}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={downloadPreviewedPdf}>
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .reports-content {
          padding: 1.5rem;
        }

        .filter-card {
          margin-bottom: 1.5rem;
          padding: 1.5rem;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }

        .filter-item-wide {
          grid-column: span 2;
        }

        .filter-item-reset {
          display: flex;
          align-items: flex-end;
        }

        .filter-item-reset .btn {
          width: 100%;
          justify-content: center;
        }

        .btn-chip.active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
        }

        .filter-item label {
          display: block;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .filter-item select,
        .filter-item input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }

        .report-select-main {
          font-weight: 600;
          border-color: var(--primary-color) !important;
          background-color: rgba(45, 149, 150, 0.05) !important;
        }

        /* Custom Report Dropdown */
        .report-dropdown {
          position: relative;
        }

        .report-dropdown-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background-color: var(--bg-secondary);
          color: var(--text-muted);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }

        .report-dropdown-trigger.has-value {
          color: var(--text-primary);
          font-weight: 600;
          border-color: var(--primary);
          background-color: rgba(45, 149, 150, 0.06);
        }

        .report-dropdown-trigger:hover {
          border-color: var(--primary);
        }

        .dropdown-chevron {
          transition: transform 0.2s ease;
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .dropdown-chevron.open {
          transform: rotate(180deg);
        }

        .report-dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 50;
          max-height: 420px;
          overflow-y: auto;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          box-shadow: var(--shadow-lg);
          padding: 0.375rem;
        }

        .report-dropdown-group {
          margin-bottom: 0.25rem;
        }

        .report-dropdown-group-label {
          padding: 0.625rem 0.75rem 0.375rem;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--primary-light);
          pointer-events: none;
          user-select: none;
          border-top: 1px solid var(--border-color);
          margin-top: 0.25rem;
        }

        .report-dropdown-group:first-child .report-dropdown-group-label {
          border-top: none;
          margin-top: 0;
        }

        .report-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border: none;
          border-radius: 0.25rem;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.8125rem;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .report-dropdown-item:hover {
          background: var(--hover-bg);
        }

        .report-dropdown-item.active {
          background: rgba(45, 149, 150, 0.12);
          color: var(--primary-light);
          font-weight: 600;
        }

        .report-dropdown-item.active:hover {
          background: rgba(45, 149, 150, 0.18);
        }

        .report-dropdown-item svg {
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .report-dropdown-item.active svg {
          color: var(--primary-light);
        }

        .placeholder-item {
          color: var(--text-muted);
          font-style: italic;
          font-size: 0.8125rem;
          margin-bottom: 0.25rem;
        }

        .btn-outline {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          transition: all 0.15s;
        }
        .btn-outline:hover {
          background: var(--bg-secondary);
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        /* Placeholder state */
        .report-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }
        .report-placeholder-inner {
          text-align: center;
          max-width: 480px;
          color: var(--text-secondary);
        }
        .report-placeholder-inner svg {
          margin-bottom: 1.25rem;
          opacity: 0.3;
          color: var(--primary-color);
        }
        .report-placeholder-inner h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }
        .report-placeholder-inner p {
          font-size: 0.875rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        .report-quick-picks {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .quick-pick-label {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .btn-chip {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 0.375rem 0.875rem;
          border-radius: 9999px;
          cursor: pointer;
          font-size: 0.8125rem;
          font-weight: 500;
          transition: all 0.15s;
        }
        .btn-chip:hover {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: white;
        }

        /* Report Display */
        .report-display {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .report-display-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          background: rgba(45, 149, 150, 0.03);
          flex-wrap: wrap;
          gap: 1rem;
        }

        .report-display-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .report-display-title h3 {
          margin: 0;
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .report-display-title p {
          margin: 0.125rem 0 0;
          font-size: 0.8125rem;
          color: var(--text-secondary);
        }

        .report-display-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .report-record-count {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--bg-secondary);
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
          margin-right: 0.25rem;
        }

        .report-table-wrapper {
          overflow-x: auto;
        }

        .table-container {
          overflow-x: auto;
        }

        /*
         * Report table design — scoped under .report-table-wrapper (a class
         * only this page renders) rather than written as bare .data-table
         * rules, since .data-table is a shared class styled globally in
         * styles/global.css and used by every other admin table (Scholars,
         * Applications, Attendance, Granting, etc.). This block must never
         * affect those, only the table inside a generated report.
         */
        .report-table-wrapper .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
        }

        .report-table-wrapper .data-table th,
        .report-table-wrapper .data-table td {
          padding: 0.625rem 0.75rem;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
          white-space: nowrap;
        }

        .report-table-wrapper .data-table th {
          /* Same dark navy the PDF's table header uses (autoTable
             headStyles.fillColor ≈ this theme color) so on-screen and
             printed reports match. */
          background: var(--primary-dark);
          font-weight: 700;
          color: #ffffff;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          position: sticky;
          top: 0;
        }

        .report-table-wrapper .data-table tbody tr:nth-child(even):not(.row-report-total):not(.row-report-subtotal):not(.row-report-section) {
          background: var(--bg-secondary);
        }

        /* Grouped-report section-header/subtotal/TOTAL rows — bold + tinted
           so a total is never mistaken for an ordinary data row, on-screen
           or (via didParseCell) in the exported PDF. */
        .report-table-wrapper .data-table tbody tr.row-report-section td {
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.04em;
          color: var(--text-secondary);
          background: var(--bg-secondary);
          border-top: 2px solid var(--border-color);
        }

        .report-table-wrapper .data-table tbody tr.row-report-subtotal td {
          font-weight: 700;
          background: var(--bg-secondary);
        }

        .report-table-wrapper .data-table tbody tr.row-report-total td {
          font-weight: 700;
          background: rgba(45, 149, 150, 0.12);
          border-top: 2px solid var(--primary);
        }

        .report-table-wrapper .data-table tbody tr:hover {
          background: var(--bg-hover);
        }

        .report-table-footer {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          font-size: 0.8125rem;
          color: var(--text-secondary);
          border-top: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        /* SCHOOL TOTALS / GRAND TOTAL summary bar — a dedicated footer band
           below the table (same dark navy as the header) instead of extra
           table rows, for the Masterlist reports. */
        .school-totals-bar {
          display: flex;
          align-items: stretch;
          flex-wrap: wrap;
          background: var(--primary-dark);
          border-top: 1px solid var(--border-color);
        }

        .school-totals-items {
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.25rem;
          padding: 0.5rem 1.25rem;
        }

        .school-totals-label {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255, 255, 255, 0.65);
        }

        .school-totals-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
          min-width: 3rem;
        }

        .school-totals-item-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.75);
        }

        .school-totals-item-count {
          font-size: 0.875rem;
          font-weight: 700;
          color: #ffffff;
        }

        .school-totals-grand {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.1rem;
          padding: 0.5rem 1.5rem;
          background: var(--primary);
        }

        .school-totals-grand-label {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255, 255, 255, 0.85);
        }

        .school-totals-grand-count {
          font-size: 1.0625rem;
          font-weight: 800;
          color: #ffffff;
        }

        @media (max-width: 640px) {
          .school-totals-bar {
            flex-direction: column;
          }
          .school-totals-grand {
            padding: 0.5rem 1rem;
          }
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        .empty-state svg {
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .filter-item-wide {
            grid-column: span 1;
          }
          .report-display-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .report-display-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
