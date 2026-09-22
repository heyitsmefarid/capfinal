import 'package:iskonnectttt/core/models/announcement_model.dart';

import 'announcement_notifications_native.dart'
    if (dart.library.html) 'announcement_notifications_web.dart' as impl;

/// Notifies about a new announcement while the app is running (foreground or
/// backgrounded-but-alive). This is NOT true push (Firebase Cloud Messaging)
/// — there is no server-side trigger to wake a fully-closed app, so a
/// scholar who has quit the app won't be notified until they reopen it. On
/// native platforms this shows a local OS notification; on web it shows a
/// browser notification if the user has granted permission.
class AnnouncementNotificationService {
  static Future<void> init() => impl.initAnnouncementNotifications();

  /// Shows an arbitrary notification through the same channel and icon, so a
  /// push that arrives while the app is open looks like every other one.
  static Future<void> show({
    required int id,
    required String title,
    required String body,
  }) {
    return impl.showAnnouncementNotification(id: id, title: title, body: body);
  }

  static Future<void> notify(AnnouncementModel announcement) {
    return impl.showAnnouncementNotification(
      id: announcement.id.hashCode & 0x7fffffff,
      title: announcement.isImportant
          ? '📢 ${announcement.title}'
          : announcement.title,
      body: announcement.description,
    );
  }
}
