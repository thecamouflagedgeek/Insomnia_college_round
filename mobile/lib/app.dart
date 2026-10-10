import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/theme.dart';
import 'core/device_lock.dart';
import 'data/repository.dart';
import 'screens/employee_screens.dart';
import 'screens/create_report.dart';
import 'features/story/story_screens.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final public = state.uri.path == '/' || state.uri.path == '/verify';
      if (!ref.read(sessionProvider) && !public) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (c, s) => const WelcomeScreen()),
      GoRoute(path: '/verify', builder: (c, s) => const VerificationScreen()),
      GoRoute(path: '/biometric', builder: (c, s) => const BiometricScreen()),
      GoRoute(path: '/home', builder: (c, s) => const HomeScreen()),
      GoRoute(
        path: '/reports',
        builder: (c, s) =>
            ReportsScreen(purpose: s.uri.queryParameters['purpose']),
      ),
      GoRoute(path: '/inbox', builder: (c, s) => const InboxScreen()),
      GoRoute(path: '/settings', builder: (c, s) => const SettingsScreen()),
      GoRoute(path: '/create', builder: (c, s) => const CreateReportScreen()),
      GoRoute(path: '/story', builder: (c, s) => const TellYourStoryScreen()),
      GoRoute(
        path: '/story/review',
        builder: (c, s) => const StoryReviewScreen(),
      ),
      GoRoute(
        path: '/success',
        builder: (c, s) => s.extra is Report
            ? SuccessScreen(s.extra! as Report)
            : const ReportsScreen(),
      ),
      GoRoute(
        path: '/witness',
        builder: (c, s) => s.extra is Invitation
            ? WitnessScreen(s.extra! as Invitation)
            : const InboxScreen(),
      ),
      for (final section in ['', '/challenge', '/chat', '/audit'])
        GoRoute(
          path: '/case/:id$section',
          builder: (c, s) {
            final report = s.extra;
            if (report is! Report) return const ReportsScreen();
            return switch (section) {
              '/challenge' => ChallengeScreen(report),
              '/chat' => ChatScreen(report),
              '/audit' => AuditScreen(report),
              _ => DetailsScreen(report),
            };
          },
        ),
    ],
  );
  ref.listen(sessionProvider, (_, next) => router.refresh());
  ref.onDispose(router.dispose);
  return router;
});

class IncognitoApp extends ConsumerWidget {
  const IncognitoApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'INCOGNITO',
    debugShowCheckedModeBanner: false,
    theme: appTheme(),
    builder: (context, child) => DeviceLock(
      onClear: () {
        ref.invalidate(repositoryProvider);
        ref.invalidate(reportsProvider);
        ref.invalidate(invitationsProvider);
        ref.read(sessionProvider.notifier).clear();
      },
      child: child!,
    ),
    routerConfig: ref.watch(routerProvider),
  );
}
