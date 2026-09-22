import 'package:flutter/widgets.dart';

/// A locally-picked file's on-disk path never exists on web (browsers don't
/// expose real filesystem paths — see the `filePath: kIsWeb ? null : ...`
/// pattern at every upload site in this app). Callers already gate on
/// filePath being non-null before reaching these, so in practice they're
/// unreachable on web; they exist only so the shared dispatcher compiles for
/// the web target, which cannot import `dart:io` at all.
Widget buildLocalFileImage(String filePath) => const SizedBox.shrink();

Future<String?> openLocalFile(String filePath) async =>
    'File preview is unavailable for this upload.';
