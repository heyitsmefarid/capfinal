import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'attachment_download_native.dart'
    if (dart.library.html) 'attachment_download_web.dart' as impl;

/// Fetches [url] and either triggers a real browser "Save As" download (web)
/// or saves it to the app's documents directory and opens it (mobile/desktop)
/// — instead of just handing the URL to the OS via `launchUrl`, which mostly
/// opens/displays the file rather than actually downloading it.
///
/// The platform-specific save/open logic lives behind a conditional import
/// (attachment_download_native.dart / attachment_download_web.dart) because
/// the native path needs `dart:io`, which does not exist on the web compile
/// target — importing it unconditionally here would break `flutter build web`
/// outright, not just misbehave at runtime.
Future<void> downloadAttachment(
  BuildContext context, {
  required String url,
  required String fileName,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  messenger.showSnackBar(
    const SnackBar(content: Text('Downloading...'), duration: Duration(seconds: 2)),
  );
  try {
    final response =
        await http.get(Uri.parse(url)).timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      throw Exception('Server returned ${response.statusCode}');
    }
    final safeName = fileName.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');

    final error = await impl.saveBytes(response.bodyBytes, safeName);
    if (error != null && context.mounted) {
      messenger.showSnackBar(SnackBar(content: Text(error)));
    }
  } catch (e) {
    if (context.mounted) {
      messenger.showSnackBar(SnackBar(content: Text('Download failed: $e')));
    }
  }
}
