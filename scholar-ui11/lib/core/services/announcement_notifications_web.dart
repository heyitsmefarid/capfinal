// ignore_for_file: deprecated_member_use
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

/// init() intentionally does NOT request permission — a browser permission
/// prompt firing the moment the page loads (before the scholar has even
/// logged in) is poor UX. Permission is instead requested contextually, the
/// first time there's an actual announcement to show (see
/// showAnnouncementNotification below).
Future<void> initAnnouncementNotifications() async {}

Future<void> showAnnouncementNotification({
  required int id,
  required String title,
  required String body,
}) async {
  if (!html.Notification.supported) return;
  if (html.Notification.permission == 'default') {
    await html.Notification.requestPermission();
  }
  if (html.Notification.permission != 'granted') return;
  html.Notification(title, body: body);
}
