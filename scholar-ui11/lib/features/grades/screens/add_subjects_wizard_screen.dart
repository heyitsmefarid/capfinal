import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:iskonnectttt/core/models/grade_model.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/utils/validators.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:iskonnectttt/shared/widgets/custom_app_bar.dart';
import 'package:iskonnectttt/shared/widgets/custom_button.dart';
import 'package:iskonnectttt/shared/widgets/custom_text_field.dart';
import 'package:iskonnectttt/shared/widgets/dialog_helper.dart';
import 'package:uuid/uuid.dart';

/// Opened automatically right after a COR upload succeeds. Lets the scholar
/// add every subject on that COR one after another — fill the form, tap
/// "Add & Next" to save it and clear the form for the next one, tap "Done"
/// when finished. The academic year/semester are locked to the COR just
/// submitted, matching how the rest of the grades flow auto-assigns period.
class AddSubjectsWizardScreen extends ConsumerStatefulWidget {
  final String academicYear;
  final String semester;

  const AddSubjectsWizardScreen({
    super.key,
    required this.academicYear,
    required this.semester,
  });

  @override
  ConsumerState<AddSubjectsWizardScreen> createState() =>
      _AddSubjectsWizardScreenState();
}

class _AddSubjectsWizardScreenState
    extends ConsumerState<AddSubjectsWizardScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectCodeController = TextEditingController();
  final _subjectNameController = TextEditingController();
  final _codeFocusNode = FocusNode();
  int _selectedUnits = 3;
  final List<String> _addedLabels = [];

  final List<int> _units = [1, 2, 3, 4, 5, 6];

  @override
  void dispose() {
    _subjectCodeController.dispose();
    _subjectNameController.dispose();
    _codeFocusNode.dispose();
    super.dispose();
  }

  bool get _hasPendingInput =>
      _subjectCodeController.text.trim().isNotEmpty ||
      _subjectNameController.text.trim().isNotEmpty;

  void _saveCurrentSubject() {
    final code = _subjectCodeController.text.trim().toUpperCase();
    final name = _subjectNameController.text.trim();

    ref.read(gradesProvider.notifier).addGrade(
          GradeModel(
            id: const Uuid().v4(),
            subjectCode: code,
            subjectName: name,
            semester: widget.semester,
            academicYear: widget.academicYear,
            units: _selectedUnits,
            grade: null,
            remarks: null,
          ),
        );

    setState(() {
      _addedLabels.add(code);
      _subjectCodeController.clear();
      _subjectNameController.clear();
      _selectedUnits = 3;
    });
  }

  void _handleAddAndNext() {
    if (!_formKey.currentState!.validate()) return;
    final code = _subjectCodeController.text.trim().toUpperCase();
    _saveCurrentSubject();
    _codeFocusNode.requestFocus();
    DialogHelper.showSnackBar(
      context: context,
      message: '$code added — enter the next subject.',
      isSuccess: true,
      duration: const Duration(seconds: 2),
    );
  }

  void _handleDone() {
    // Only force validation when the student actually left something typed;
    // an untouched blank form just finishes the wizard.
    if (_hasPendingInput) {
      if (!_formKey.currentState!.validate()) return;
      _saveCurrentSubject();
    }
    _finish();
  }

  void _handleSkip() {
    _finish();
  }

  void _finish() {
    if (!mounted) return;
    context.go('/grades');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(
        title: 'Add Your Subjects',
        onBackPressed: _finish,
        actions: [
          TextButton(
            onPressed: _handleSkip,
            child: const Text('Skip'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.infoLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.info.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.info_outline,
                      color: AppColors.info,
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'COR uploaded! Add each subject you\'re enrolled in for '
                        '${widget.semester}, A.Y. ${widget.academicYear} — tap '
                        '"Add & Next" after each one.',
                        style: const TextStyle(fontSize: 12, color: AppColors.info),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              if (_addedLabels.isNotEmpty) ...[
                Text(
                  '${_addedLabels.length} subject${_addedLabels.length == 1 ? '' : 's'} added',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _addedLabels
                      .map(
                        (label) => Chip(
                          label: Text(label, style: const TextStyle(fontSize: 12)),
                          backgroundColor: AppColors.success.withValues(alpha: 0.1),
                          side: BorderSide(
                            color: AppColors.success.withValues(alpha: 0.3),
                          ),
                          visualDensity: VisualDensity.compact,
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 24),
              ],

              const Text(
                'Subject Information',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _subjectCodeController,
                focusNode: _codeFocusNode,
                label: 'Course Code',
                hint: 'e.g., IT 101',
                prefixIcon: Icons.code,
                validator: Validators.required,
              ),
              const SizedBox(height: 16),
              CustomTextField(
                controller: _subjectNameController,
                label: 'Course Name',
                hint: 'e.g., Introduction to Computing',
                prefixIcon: Icons.book,
                validator: Validators.required,
              ),
              const SizedBox(height: 16),
              CustomDropdown<int>(
                label: 'Units',
                value: _selectedUnits,
                items: _units
                    .map(
                      (u) => DropdownMenuItem(
                        value: u,
                        child: Text('$u ${u == 1 ? 'unit' : 'units'}'),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  setState(() => _selectedUnits = value ?? _selectedUnits);
                },
              ),
              const SizedBox(height: 32),

              GradientButton(
                text: 'Add & Next',
                onPressed: _handleAddAndNext,
                icon: Icons.add_rounded,
                width: double.infinity,
              ),
              const SizedBox(height: 12),
              CustomButton(
                text: 'Done',
                onPressed: _handleDone,
                isOutlined: true,
                width: double.infinity,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
