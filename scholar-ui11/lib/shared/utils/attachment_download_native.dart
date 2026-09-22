import 'dart:io';
import 'dart:typed_data';

import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

/// Saves [bytes] to the app's documents directory and opens it — mobile/
/// desktop implementation. Returns an error message to show the user on
/// failure, or null on success.
Future<String?> saveBytes(Uint8List bytes, String fileName) async {
  final dir = await getApplicationDocumentsDirectory();
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes);

  final result = await OpenFilex.open(file.path);
  if (result.type != ResultType.done) {
    return 'Saved, but could not open it: ${result.message}';
  }
  return null;
}
