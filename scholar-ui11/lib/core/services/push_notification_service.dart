import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'announcement_notification_service.dart';
import 'scholar_firestore_service.dart';

/// True push, as opposed to [AnnouncementNotificationService]'s local
/// notifications: Firebase holds the message and wakes the app even when the
/// scholar has closed it. A phone that is switched off receives nothing until
/// it comes back online — FCM queues the message rather than dropping it.
///
/// The sending half lives in `backend/functions/local-form-server.js`
/// (`/sendPush`), because the project is on the Spark plan and Cloud Functions
/// can't be deployed.
class PushNotificationService {
  const PushNotificationService._();

  /// Web push would additionally need a VAPID key and a service worker, so it
  /// is deliberately skipped for now — the Android app is the target.
  static bool get _supported => !kIsWeb;

  /// Asks for permission and routes messages that arrive while the app is
  /// open through the same local-notification path the app already uses, so a
  /// foreground push looks like every other notification.
  static Future<void> init() async {
    if (!_supported) return;
    try {
      await FirebaseMessaging.instance.requestPermission();
      FirebaseMessaging.onMessage.listen((message) async {
        final notification = message.notification;
        if (notification == null) return;
        await AnnouncementNotificationService.show(
          id: message.messageId.hashCode & 0x7fffffff,
          title: notification.title ?? 'Iskonnect',
          body: notification.body ?? '',
        );
      });
    } catch (_) {
      // Never let notification setup block sign-in or app start.
    }
  }

  /// Records this device against the scholar so the office can reach them.
  /// Safe to call on every login: the token is a map key, so re-registering
  /// the same device just rewrites the same entry.
  static Future<void> registerDevice(String studentId) async {
    if (!_supported || studentId.isEmpty) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _saveToken(studentId, token);
      FirebaseMessaging.instance.onTokenRefresh.listen((refreshed) {
        _saveToken(studentId, refreshed);
      });
    } catch (_) {
      // A scholar who declines the permission simply gets no push.
    }
  }

  /// Drops this device from the scholar's record. Without this a shared phone
  /// would keep receiving the previous scholar's notifications after logout.
  static Future<void> unregisterDevice(String studentId) async {
    if (!_supported || studentId.isEmpty) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await ScholarFirestoreService.saveStudentFields(studentId, {
          'fcmTokens': {token: FieldValue.delete()},
        });
      }
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {
      // Best-effort — a failed cleanup must not block logging out.
    }
  }

  static Future<void> _saveToken(String studentId, String token) async {
    await ScholarFirestoreService.saveStudentFields(studentId, {
      'fcmTokens': {
        token: {
          'platform': defaultTargetPlatform.name,
          'updatedAt': DateTime.now().toUtc().toIso8601String(),
        },
      },
    });
  }
}
