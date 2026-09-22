import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/grades/providers/grades_provider.dart';
import 'package:iskonnectttt/features/grades/screens/add_subjects_wizard_screen.dart';

Future<void> _pumpWizard(WidgetTester tester) {
  return tester.pumpWidget(
    const ProviderScope(
      child: MaterialApp(
        home: AddSubjectsWizardScreen(
          academicYear: '2025-2026',
          semester: '1st Semester',
        ),
      ),
    ),
  );
}

void main() {
  testWidgets(
    'Add & Next saves the subject, clears the form, and grows the counter',
    (tester) async {
      await _pumpWizard(tester);
      await tester.pumpAndSettle();

      final textFields = find.byType(TextFormField);
      expect(textFields, findsNWidgets(2)); // subject code, subject name

      await tester.enterText(textFields.at(0), 'IT101');
      await tester.enterText(textFields.at(1), 'Introduction to Computing');
      await tester.tap(find.text('Add & Next'));
      await tester.pumpAndSettle();

      // Saved into the shared grades list under the wizard's locked period.
      final container = ProviderScope.containerOf(
        tester.element(find.byType(AddSubjectsWizardScreen)),
      );
      final grades = container.read(gradesProvider);
      expect(grades, hasLength(1));
      expect(grades.single.subjectCode, 'IT101');
      expect(grades.single.academicYear, '2025-2026');
      expect(grades.single.semester, '1st Semester');

      // Form cleared and ready for the next subject (IT101 now only shows up
      // once, as the "added" chip — not lingering in the text field).
      expect(find.text('IT101'), findsOneWidget);
      expect((tester.widget(textFields.at(0)) as TextFormField).controller!.text, '');

      // Counter + chip reflect the addition.
      expect(find.text('1 subject added'), findsOneWidget);

      // A second entry keeps accumulating rather than replacing. The added
      // chip pushed the button down, so scroll to it first.
      await tester.enterText(textFields.at(0), 'IT102');
      await tester.enterText(textFields.at(1), 'Computer Programming');
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add & Next'));
      await tester.pumpAndSettle();

      expect(container.read(gradesProvider), hasLength(2));
      expect(find.text('2 subjects added'), findsOneWidget);
    },
  );

  testWidgets('Add & Next is blocked when the fields are empty', (tester) async {
    await _pumpWizard(tester);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add & Next'));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(AddSubjectsWizardScreen)),
    );
    expect(container.read(gradesProvider), isEmpty);
    expect(find.text('This field is required'), findsWidgets);
  });
}
