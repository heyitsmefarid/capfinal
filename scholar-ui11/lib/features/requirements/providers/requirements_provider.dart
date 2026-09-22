import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/models/requirement_model.dart';
import 'package:iskonnectttt/core/constants/app_constants.dart';
import 'package:iskonnectttt/core/services/scholar_firestore_service.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';

class RequirementsNotifier extends StateNotifier<List<RequirementModel>> {
  RequirementsNotifier() : super(_initializeRequirements());

  static List<RequirementModel> _initializeRequirements() {
    return AppConstants.requiredDocuments.map((doc) {
      return RequirementModel(
        id: doc['id'] as String,
        name: doc['name'] as String,
        description: doc['description'] as String,
        isRequired: doc['required'] as bool,
        status: 'Pending',
      );
    }).toList();
  }

  void uploadDocument({
    required String requirementId,
    required String fileName,
    required int fileSize,
    required String fileType,
  }) {
    state = state.map((req) {
      if (req.id == requirementId) {
        return req.copyWith(
          status: 'Submitted',
          fileName: fileName,
          fileSize: fileSize,
          fileType: fileType,
          submittedAt: DateTime.now(),
        );
      }
      return req;
    }).toList();
  }

  void removeDocument(String requirementId) {
    state = state.map((req) {
      if (req.id == requirementId) {
        return RequirementModel(
          id: req.id,
          name: req.name,
          description: req.description,
          isRequired: req.isRequired,
          status: 'Pending',
        );
      }
      return req;
    }).toList();
  }

  // Simulate verification (in real app, this would come from backend)
  void simulateVerification(String requirementId, {bool approve = true}) {
    state = state.map((req) {
      if (req.id == requirementId && req.isSubmitted) {
        return req.copyWith(
          status: approve ? 'Verified' : 'Rejected',
          verifiedAt: DateTime.now(),
          remarks: approve ? null : 'Document unclear. Please resubmit.',
        );
      }
      return req;
    }).toList();
  }
}

final requirementsProvider =
    StateNotifierProvider<RequirementsNotifier, List<RequirementModel>>((ref) {
      return RequirementsNotifier();
    });

final requirementsSummaryProvider = Provider<RequirementsSummary>((ref) {
  final requirements = ref.watch(requirementsProvider);
  return RequirementsSummary.fromRequirements(requirements);
});

/// Fallback only — used when the admin-managed catalog below
/// (applicationRequirementsCatalogProvider, Settings → Application
/// Requirements) hasn't loaded yet or is empty, so the screen never shows
/// nothing at all. The real, current list of requirements now lives in
/// Firestore and is admin-editable; this is just the safety net matching
/// what those 8 requirements happened to be when this became dynamic.
const List<String> kOfficialRequirementKeys = [
  'applicationForm',
  'idPictures',
  'form137',
  'goodMoral',
  'votersId',
  'barangayResidency',
  'electricBills',
  'cedula',
];

/// Display metadata for each official requirement key.
const Map<String, Map<String, String>> kRequirementDisplayInfo = {
  'applicationForm': {
    'name': 'Duly Accomplished Scholarship Application Form',
    'description': 'Provided by the City Education Department',
  },
  'idPictures': {
    'name': 'Two (2) ID Pictures (2x2)',
    'description': 'Recent 2x2 ID photos with white background',
  },
  'form137': {
    'name': 'Photocopy of Senior High School Form 137',
    'description': 'Previous semester grades or Form 137',
  },
  'goodMoral': {
    'name': 'Photocopy of Certificate of Good Moral Character',
    'description': 'From Guidance Counselor',
  },
  'votersId': {
    'name': "Photocopy of Parent's Voter's ID or Voter's Certification",
    'description': "Voter's ID or voter's certificate of registration",
  },
  'barangayResidency': {
    'name': 'Certificate of Barangay Residency',
    'description': 'With length of stay, issued by your barangay',
  },
  'electricBills': {
    'name': 'Photocopy of Latest Electric Bills',
    'description': 'February and March 2026',
  },
  'cedula': {
    'name': "Photocopy of Both Parents' 2026 Community Tax Certificate (Cedula)",
    'description': 'Current community tax certificate of both parents',
  },
};

/// Live stream of the admin-managed application requirements catalog
/// (Settings → Application Requirements). Watched from the two providers
/// below so an admin's change reaches an already-open app without a restart.
final applicationRequirementsCatalogProvider =
    StreamProvider<List<Map<String, dynamic>>>((ref) {
  return ScholarFirestoreService.applicationRequirementsStream();
});

/// One resolved requirement definition — either from the live catalog, or
/// (fallback) from the hardcoded constants above.
typedef RequirementDef = ({
  String id,
  String name,
  String description,
  bool required,
  List<String>? acceptedFileTypes,
});

/// Resolves the requirements to actually show for this student: the live
/// catalog's active entries, plus any requirement the student already has a
/// submission for even if it's since been deactivated (so an already-
/// submitted document never just disappears from their own view) — falling
/// back to the hardcoded constants only if the catalog is empty/unreachable.
List<RequirementDef> _resolveRequirementDefs(
  List<Map<String, dynamic>> catalog,
  Map<String, dynamic> userRequirements,
) {
  if (catalog.isEmpty) {
    return kOfficialRequirementKeys.map((key) {
      final info = kRequirementDisplayInfo[key] ?? {'name': key, 'description': ''};
      return (
        id: key,
        name: info['name']!,
        description: info['description']!,
        required: true,
        acceptedFileTypes: null,
      );
    }).toList();
  }

  return catalog
      .where((r) => r['active'] != false || userRequirements.containsKey(r['id']))
      .map((r) {
        final rawTypes = r['acceptedFileTypes'];
        final types = rawTypes is List
            ? rawTypes.map((e) => e.toString()).where((e) => e.isNotEmpty).toList()
            : null;
        return (
          id: r['id'] as String,
          name: (r['name'] as String?)?.trim().isNotEmpty == true ? r['name'] as String : r['id'] as String,
          description: r['description'] as String? ?? '',
          required: r['required'] != false,
          acceptedFileTypes: (types != null && types.isNotEmpty) ? types : null,
        );
      })
      .toList();
}

String _normalizeRequirementStatus(dynamic statusValue, dynamic submittedValue) {
  final s = statusValue?.toString().toLowerCase() ?? '';
  if (s == 'verified' || s == 'approved') return 'Verified';
  if (s == 'rejected') return 'Rejected';
  if (s == 'submitted' ||
      s == 'resubmitted' ||
      s == 'under_review' ||
      s == 'underreview' ||
      submittedValue == true) {
    return 'Submitted';
  }
  // A file is attached but the applicant has not pressed Submit yet. Checked
  // after the submitted cases so an already-submitted document can never be
  // dragged back to this state, and reported as its own status rather than
  // 'Pending' so the screen can tell "nothing uploaded" from "uploaded, not
  // yet sent". Summary tallies still count it under `pending`, because it has
  // genuinely not been submitted.
  if (s == 'uploaded') return 'Uploaded';
  return 'Pending';
}

/// Reads the scholar's real requirement submission/verification status from
/// their Firestore user document (the same `requirements` map the admin reviews)
/// so the dashboard Overview reflects actual data instead of local placeholders.
final firestoreRequirementsSummaryProvider =
    FutureProvider<RequirementsSummary>((ref) async {
  // Re-run when the logged-in student changes, or the catalog updates.
  ref.watch(currentStudentProvider);
  final catalog = ref.watch(applicationRequirementsCatalogProvider)
      .maybeWhen(data: (list) => list, orElse: () => const <Map<String, dynamic>>[]);

  RequirementsSummary emptySummary(int total) => RequirementsSummary(
        total: total,
        pending: total,
        submitted: 0,
        verified: 0,
        rejected: 0,
      );

  final studentId = await ScholarFirestoreService.currentStudentId();
  final map0 = <String, dynamic>{};
  if (studentId == null) {
    return emptySummary(_resolveRequirementDefs(catalog, map0).length);
  }

  final doc = await ScholarFirestoreService.fetchStudentDoc(studentId);
  final raw = doc?['requirements'];
  final map = raw is Map ? Map<String, dynamic>.from(raw) : map0;
  final defs = _resolveRequirementDefs(catalog, map);
  if (raw is! Map) return emptySummary(defs.length);

  int verified = 0, submitted = 0, rejected = 0, pending = 0;

  for (final def in defs) {
    final entry = map[def.id];
    String status;
    if (entry is Map) {
      final e = Map<String, dynamic>.from(entry);
      status = _normalizeRequirementStatus(e['status'], e['submitted']);
    } else if (entry == true) {
      status = 'Submitted';
    } else if (entry is String) {
      status = _normalizeRequirementStatus(entry, null);
    } else {
      status = 'Pending';
    }

    switch (status) {
      case 'Verified':
        verified++;
        break;
      case 'Submitted':
        submitted++;
        break;
      case 'Rejected':
        rejected++;
        break;
      default:
        pending++;
    }
  }

  return RequirementsSummary(
    total: defs.length,
    pending: pending,
    submitted: submitted,
    verified: verified,
    rejected: rejected,
  );
});

/// Reads each official requirement's status from the student's Firestore user
/// document and returns a typed list the Requirements screen can display.
final firestoreRequirementsListProvider =
    FutureProvider<List<RequirementModel>>((ref) async {
  ref.watch(currentStudentProvider);
  final catalog = ref.watch(applicationRequirementsCatalogProvider)
      .maybeWhen(data: (list) => list, orElse: () => const <Map<String, dynamic>>[]);

  List<RequirementModel> buildList(Map<String, dynamic> rawMap) {
    final defs = _resolveRequirementDefs(catalog, rawMap);
    return defs.map((def) {
      final entry = rawMap[def.id];
      String status;
      String? remarks;
      String? fileName;
      String? fileUrl;
      int? fileSize;
      DateTime? submittedAt;

      if (entry is Map) {
        final e = Map<String, dynamic>.from(entry);
        status = _normalizeRequirementStatus(e['status'], e['submitted']);
        remarks =
            e['reviewNotes']?.toString() ?? e['notes']?.toString();
        fileName = e['fileName']?.toString();
        fileUrl = e['fileUrl']?.toString();
        final rawSize = e['fileSize'];
        fileSize = rawSize is num ? rawSize.toInt() : null;
        final rawSubmittedAt = e['submittedAt'];
        if (rawSubmittedAt != null) {
          submittedAt = ScholarFirestoreService.parseDateTime(rawSubmittedAt);
        }
      } else if (entry == true) {
        status = 'Submitted';
      } else if (entry is String) {
        status = _normalizeRequirementStatus(entry, null);
      } else {
        status = 'Pending';
      }

      return RequirementModel(
        id: def.id,
        name: def.name,
        description: def.description,
        isRequired: def.required,
        status: status,
        remarks: remarks,
        fileName: (fileName != null && fileName.isNotEmpty) ? fileName : null,
        fileUrl: (fileUrl != null && fileUrl.isNotEmpty) ? fileUrl : null,
        fileSize: fileSize,
        submittedAt: submittedAt,
        acceptedFileTypes: def.acceptedFileTypes,
      );
    }).toList();
  }

  final studentId = await ScholarFirestoreService.currentStudentId();
  if (studentId == null) return buildList({});

  final doc = await ScholarFirestoreService.fetchStudentDoc(studentId);
  final raw = doc?['requirements'];
  final map =
      raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
  return buildList(map);
});
