import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/core/models/student_model.dart';

// A scholar created by the admin's migration import: the users doc carries
// street and barangay but no houseNo/city/province, a suffix, a date-only
// birth date, and the panel normalizes yearLevel to a number.
Map<String, dynamic> _importedDoc({
  String houseNo = '',
  String street = '7 Rizal Avenue',
  String barangay = 'Ibaba West',
  String city = '',
  String province = '',
}) =>
    {
      'id': 'uid-123',
      'uid': 'uid-123',
      'firstName': 'Jomar',
      'middleName': 'Cruz',
      'lastName': 'Delos Santos',
      'suffix': 'Jr.',
      'dateOfBirth': '2006-08-25',
      'gender': 'Male',
      'houseNo': houseNo,
      'street': street,
      'barangay': barangay,
      'city': city,
      'province': province,
      'contactNumber': '09182223332',
      'email': 'test.migration.y2@example.com',
      'schoolName': 'ACLC College of Calapan',
      'academicProgram': 'BS in Computer Engineering',
      'academicYear': '2024-2025',
      'yearLevel': 2,
      'semester': '1st Semester',
      'semestersCompleted': 3,
      'totalScholarshipSemesters': 8,
      'studentType': 'scholar',
      'applicationStatus': 'approved',
      'scholarshipStatus': 'Active',
      'mustChangePassword': true,
    };

void main() {
  group('imported scholar profile', () {
    test('parses every personal field the migration sheet supplies', () {
      final s = StudentModel.fromJson(_importedDoc());

      expect(s.fullName, 'Jomar Cruz Delos Santos Jr.');
      expect(s.gender, 'Male');
      expect(s.contactNumber, '09182223332');
      expect(s.dateOfBirth, DateTime(2006, 8, 25));
      expect(s.yearLevel, '2');
      expect(s.semestersCompleted, 3);
      expect(s.schoolName, 'ACLC College of Calapan');
      expect(s.academicProgram, 'BS in Computer Engineering');
    });
  });

  group('fullAddress', () {
    test('skips the blank house number, city and province an import leaves', () {
      expect(StudentModel.fromJson(_importedDoc()).fullAddress,
          '7 Rizal Avenue, Brgy. Ibaba West');
    });

    test('does not double the prefix when the barangay already carries one', () {
      expect(
        StudentModel.fromJson(_importedDoc(barangay: 'Barangay Ibaba West')).fullAddress,
        '7 Rizal Avenue, Barangay Ibaba West',
      );
      expect(
        StudentModel.fromJson(_importedDoc(barangay: 'Brgy. Ibaba West')).fullAddress,
        '7 Rizal Avenue, Brgy. Ibaba West',
      );
    });

    test('keeps the full form for a complete record', () {
      expect(
        StudentModel.fromJson(_importedDoc(
          houseNo: '12',
          city: 'Calapan',
          province: 'Oriental Mindoro',
        )).fullAddress,
        '12 7 Rizal Avenue, Brgy. Ibaba West, Calapan, Oriental Mindoro',
      );
    });
  });
}
