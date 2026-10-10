import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/data/repository.dart';
import 'package:mobile/screens/create_report.dart';
import 'package:mobile/screens/employee_screens.dart';

void main() {
  testWidgets('Small phone completes a guided demo report', (tester) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(sessionProvider.notifier).enterDemo();
    container.read(routerProvider).go('/home');
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const IncognitoApp(),
      ),
    );
    await tester.pumpAndSettle();
    Future<void> tap(String label) async {
      if (find.text(label).evaluate().isEmpty) {
        await tester.scrollUntilVisible(
          find.text(label),
          200,
          scrollable: find.byType(Scrollable).first,
        );
      }
      await tester.ensureVisible(find.text(label));
      await tester.pumpAndSettle();
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
    }

    await tap('Create report');
    await tap('Harassment');
    await tap('Continue');
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'A fictional incident',
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'This is a fictional concern with sufficient context for the guided demo.',
    );
    tester.testTextInput.hide();
    await tester.pumpAndSettle();
    await tap('Continue');
    await tap('Continue');
    await tap('Create local demo report');
    expect(find.byType(SuccessScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Employee screens handle small phone and enlarged text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repo = DemoRepository();
    final report = (await tester.runAsync(() => repo.reports()))!.first;
    for (final screen in [
      const HomeScreen(),
      DetailsScreen(report),
      ChallengeScreen(report),
      ChatScreen(report),
      AuditScreen(report),
      WitnessScreen((await tester.runAsync(() => repo.invitations()))!.first),
      const SettingsScreen(),
    ]) {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (c, s) => MediaQuery(
              data: const MediaQueryData(
                size: Size(360, 740),
                textScaler: TextScaler.linear(1.5),
              ),
              child: screen,
            ),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(child: MaterialApp.router(routerConfig: router)),
      );
      await tester.pumpAndSettle();
      expect(
        tester.takeException(),
        isNull,
        reason: '${screen.runtimeType} must not overflow',
      );
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });
}
