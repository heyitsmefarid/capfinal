import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:open_filex/open_filex.dart';

/// Displays a locally-picked file (by filesystem path) as an image —
/// mobile/desktop implementation.
Widget buildLocalFileImage(String filePath) => Image.file(File(filePath));

/// Opens a locally-picked file with the platform's default handler. Returns
/// an error message to show the user on failure, or null on success.
Future<String?> openLocalFile(String filePath) async {
  final result = await OpenFilex.open(filePath);
  if (result.type != ResultType.done) {
    return 'Unable to open file: ${result.message}';
  }
  return null;
}
