import 'dart:typed_data';

import 'package:iskonnectttt/shared/utils/qr_download_stub.dart'
    if (dart.library.html) 'package:iskonnectttt/shared/utils/qr_download_web.dart';

/// Triggers a real browser "Save As" download of [bytes] — web
/// implementation. Reuses the same downloadBytes() helper qr_code_screen.dart
/// already uses for the QR/ID card download, instead of duplicating it.
Future<String?> saveBytes(Uint8List bytes, String fileName) async {
  downloadBytes(bytes, fileName);
  return null;
}
