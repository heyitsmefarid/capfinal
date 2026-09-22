import 'package:iskonnectttt/core/models/event_model.dart';

import 'event_reminder_service_native.dart'
    if (dart.library.html) 'event_reminder_service_web.dart' as impl;

/// Reminds a scholar about an event the morning before it happens.
///
/// On native platforms this is a true OS-scheduled notification that fires
/// even if the app is closed. On web there is no equivalent without a
/// service worker + push backend, so the reminder instead fires once its
/// time has arrived while the app is open (on data refresh, and on a
/// periodic re-check) — see event_reminder_service_web.dart for the exact
/// scoping, which mirrors AnnouncementNotificationService's same
/// foreground/backgrounded-but-alive caveat.
class EventReminderService {
  static Future<void> init() => impl.initEventReminders();

  static Future<void> scheduleReminders(List<EventModel> upcomingEvents) {
    return impl.scheduleEventReminders(upcomingEvents);
  }
}
