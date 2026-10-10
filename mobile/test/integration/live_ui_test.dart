// Live-mode screens with a fake API (widget tests cannot use the network).
//   flutter test test/integration/live_ui_test.dart --dart-define=APP_MODE=live
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/data/repository.dart';
import 'package:mobile/integration/api_client.dart';
import 'package:mobile/integration/live_providers.dart';
import 'package:mobile/integration/secret_store.dart';
import 'package:mobile/integration/zk_prover.dart';
import 'package:mobile/features/story/story_state.dart';
import 'package:mobile/screens/employee_screens.dart';

class FakeApi extends IncognitoApi {
  FakeApi() : super('http://fake');
  final members = <String>[];
  final codes = <String>[];
  int classificationRequests = 0;

  @override
  Future<Json> classify(String text) async {
    classificationRequests++;
    throw StateError('Private understanding must not contact classification.');
  }

  @override
  Future<Json> enroll(String commitment, String enrollCode) async {
    if (enrollCode != 'GOOD-CODE') throw ApiFailure('bad_enroll_code', 403);
    codes.add(enrollCode);
    members.add(commitment);
    return {'index': members.length - 1, 'root': '1', 'tx_hash': '0x1'};
  }

  @override
  Future<Json> group() async => {
    'group_id': 23,
    'depth': 16,
    'members': members,
    'root': '1',
    'onchain_root': '1',
  };
}

void main() {
  final skip = demoEnabled ? 'run with --dart-define=APP_MODE=live' : false;

  Future<(ProviderContainer, FakeApi)> pumpApp(
    WidgetTester tester,
    String location,
  ) async {
    final api = FakeApi();
    final container = ProviderContainer(
      overrides: [
        secretStoreProvider.overrideWithValue(MemorySecretStore()),
        zkProverProvider.overrideWith(
          (ref) => OfflineProver(ref.watch(identityKeyProvider)),
        ),
        incognitoApiProvider.overrideWithValue(api),
      ],
    );
    addTearDown(container.dispose);
    container.read(routerProvider).go(location);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const IncognitoApp(),
      ),
    );
    await tester.pumpAndSettle();
    return (container, api);
  }

  testWidgets('enrolment with an HR invite code', (tester) async {
    final (container, api) = await pumpApp(tester, '/verify');
    expect(find.text('Verify membership'), findsOneWidget);
    expect(find.text('Explore the labelled demo'), findsNothing);

    await tester.enterText(find.byType(TextField), 'WRONG');
    await tester.tap(find.text('Verify membership'));
    await tester.pumpAndSettle();
    expect(
      find.text('That invite code was not accepted. Check it with HR.'),
      findsOneWidget,
    );
    expect(container.read(sessionProvider), isFalse);

    await tester.enterText(find.byType(TextField), 'GOOD-CODE');
    await tester.tap(find.text('Verify membership'));
    await tester.pumpAndSettle();
    expect(api.members, hasLength(1));
    expect(container.read(sessionProvider), isTrue);
    expect(find.byType(BiometricScreen), findsOneWidget);
  }, skip: skip != false);

  testWidgets(
    'private understanding never sends a narrative to classification',
    (tester) async {
      final (container, api) = await pumpApp(tester, '/verify');
      container.read(sessionProvider.notifier).enter();
      container.read(routerProvider).go('/story');
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('story-narrative')),
        'A private workplace experience.',
      );
      await tester.scrollUntilVisible(
        find.text('Continue Understanding'),
        240,
        scrollable: find
            .descendant(
              of: find.byType(ListView).first,
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(find.text('Continue Understanding'));
      await tester.pumpAndSettle();
      expect(container.read(storyProvider).understanding, isTrue);
      expect(api.classificationRequests, 0);
      await tester.scrollUntilVisible(
        find.text('Discard Privately'),
        240,
        scrollable: find
            .descendant(
              of: find.byType(ListView).first,
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(find.text('Discard Privately'));
      await tester.pumpAndSettle();
      expect(container.read(storyProvider).narrative, isEmpty);
      expect(api.classificationRequests, 0);
    },
    skip: skip != false,
  );

  testWidgets('challenge screen lists the case committee from the API', (
    tester,
  ) async {
    final report = Report(
      id: 'INC-TEST',
      category: 'Bullying',
      title: 't',
      description: 'd',
      date: DateTime(2026, 10, 9),
      committee: const [
        CommitteeMember(
          'usr_marcus',
          'Marcus Vance',
          'VP of Engineering Operations',
        ),
        CommitteeMember(
          'usr_david',
          'David Kim',
          'Associate General Counsel (Labor)',
        ),
      ],
    );
    final (container, _) = await pumpApp(tester, '/verify');
    container.read(sessionProvider.notifier).enter();
    container
        .read(routerProvider)
        .go('/case/INC-TEST/challenge', extra: report);
    await tester.pumpAndSettle();
    expect(find.text('Marcus Vance'), findsOneWidget);
    expect(find.text('David Kim'), findsOneWidget);
    expect(find.text('Committee member A'), findsNothing);
    expect(find.text('Submit challenge'), findsOneWidget);
  }, skip: skip != false);
}
