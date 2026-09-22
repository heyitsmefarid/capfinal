// ignore_for_file: deprecated_member_use
import 'dart:async';
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

import 'package:shared_preferences/shared_preferences.dart';
import 'package:iskonnectttt/core/models/event_model.dart';

/// Web equivalent of event_reminder_service_native.dart.
///
/// The browser has no OS-level "fire this later, even if the tab is closed"
/// primitive without a service worker + push backend (Firebase Cloud
/// Messaging) — that's real new infrastructure, out of scope for reusing the
/// existing app. Instead, this mirrors the same honest scoping already used
/// for announcements (see announcement_notifications_web.dart): a reminder
/// fires as a real browser Notification once its reminder time has arrived,
/// but only while the app is open (on every upcoming-events refresh, plus a
/// periodic re-check so a reminder that becomes due while the tab is just
/// sitting open still fires without needing new Firestore activity).
///
/// Permission is never requested on page load — only lazily, the moment a
/// reminder is actually due and about to be shown, matching the "don't
/// prompt immediately on load" requirement.
const _notifiedIdsKey = 'event_reminder_notified_ids_web';
const _recheckInterval = Duration(minutes: 30);

List<EventModel> _lastUpcoming = const [];
Timer? _recheckTimer;

Future<void> initEventReminders() async {
  // No permission request here — see _checkDueReminders. Just start the
  // periodic re-check loop so a reminder crossing into its due window while
  // the tab is idle still gets caught.
  _recheckTimer ??= Timer.periodic(_recheckInterval, (_) {
    _checkDueReminders(_lastUpcoming);
  });
}

Future<void> scheduleEventReminders(List<EventModel> upcomingEvents) async {
  _lastUpcoming = upcomingEvents;
  await _checkDueReminders(upcomingEvents);
}

Future<void> _checkDueReminders(List<EventModel> upcomingEvents) async {
  if (upcomingEvents.isEmpty || !html.Notification.supported) return;

  final now = DateTime.now();
  final due = <EventModel>[];
  for (final event in upcomingEvents) {
    final eventDay = DateTime(event.date.year, event.date.month, event.date.day);
    final reminderTime =
        eventDay.subtract(const Duration(days: 1)).add(const Duration(hours: 8));
    if (!now.isBefore(reminderTime) && now.isBefore(eventDay)) {
      due.add(event);
    }
  }
  if (due.isEmpty) return;

  final prefs = await SharedPreferences.getInstance();
  final notified = (prefs.getStringList(_notifiedIdsKey) ?? const <String>[]).toSet();
  final stillDue = due.where((e) => !notified.contains(e.id)).toList();
  if (stillDue.isEmpty) return;

  // Contextual permission request: only asked right when there's a real
  // reminder to show, never eagerly at startup.
  if (html.Notification.permission == 'default') {
    await html.Notification.requestPermission();
  }
  if (html.Notification.permission != 'granted') return;

  for (final event in stillDue) {
    html.Notification(
      'Upcoming Event',
      body: '${event.name} is tomorrow (${_formatDate(event.date)}).',
    );
    notified.add(event.id);
  }
  await prefs.setStringList(_notifiedIdsKey, notified.toList());
}

String _formatDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}
