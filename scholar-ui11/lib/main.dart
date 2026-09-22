import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/core/constants/firebase_config.dart';
import 'package:iskonnectttt/core/services/announcement_notification_service.dart';
import 'package:iskonnectttt/core/services/push_notification_service.dart';
import 'package:iskonnectttt/core/services/event_reminder_service.dart';
import 'package:iskonnectttt/core/theme/app_theme.dart';
import 'package:iskonnectttt/core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await FirebaseConfig.initialize();

  // Notification init must never block app boot — a browser without
  // Notification support, a denied/unavailable permission, or a plugin
  // hiccup on a less-common platform should degrade to "no notifications",
  // not a blank screen. Mirrors the same defensive style already used in
  // FirebaseConfig._ensureSignedIn().
  try {
    await EventReminderService.init();
  } catch (_) {}
  try {
    await AnnouncementNotificationService.init();
  } catch (_) {}
  try {
    await PushNotificationService.init();
  } catch (_) {}

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(const ProviderScope(child: IskonnectApp()));
}

class IskonnectApp extends ConsumerWidget {
  const IskonnectApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Iskonnect',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      routerConfig: router,
    );
  }
}
