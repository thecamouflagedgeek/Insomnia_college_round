// Device-only fictional journey against an explicitly selected local fork.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/data/repository.dart';
import 'package:mobile/integration/api_client.dart';
import 'package:mobile/integration/live_providers.dart';
import 'package:mobile/integration/secret_store.dart';
import 'package:mobile/integration/webview_prover.dart';
import 'package:mobile/integration/zk_prover.dart';

class TestSecrets implements SecretStore {
  final _secure = SecureSecretStore();
  final _prefix = 'incognito.fork-test.${randomNonce()}.';
  final _keys = <String>{};
  @override
  Future<String?> read(String key) => _secure.read(_prefix + key);
  @override
  Future<void> write(String key, String value) async {
    _keys.add(key);
    await _secure.write(_prefix + key, value);
  }

  @override
  Future<void> delete(String key) => _secure.delete(_prefix + key);
  Future<void> clear() async {
    for (final key in _keys) {
      await delete(key);
    }
  }
}

class TimedProver implements ZkProver {
  TimedProver(this.inner);
  final WebViewProver inner;
  final milliseconds = <int>[];
  @override
  Future<String> commitment() => inner.commitment();
  @override
  Future<Map<String, dynamic>> prove({
    required List<String> members,
    required String onchainRoot,
    required String message,
    required String scope,
  }) async {
    final timer = Stopwatch()..start();
    final result = await inner.prove(
      members: members,
      onchainRoot: onchainRoot,
      message: message,
      scope: scope,
    );
    milliseconds.add(timer.elapsedMilliseconds);
    return result;
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'phone: native proof, enrollment, report, challenge and verified audit',
    (tester) async {
      expect(
        const bool.fromEnvironment('FORK_DEVICE_TEST'),
        isTrue,
        reason:
            'Run only with FORK_DEVICE_TEST=true against the isolated fork.',
      );
      final secrets = TestSecrets();
      final prover = TimedProver(WebViewProver(IdentityKey(secrets)));
      final container = ProviderContainer(
        overrides: [
          secretStoreProvider.overrideWithValue(secrets),
          zkProverProvider.overrideWithValue(prover),
        ],
      );
      try {
        final api = container.read(incognitoApiProvider);
        final group = await api.group();
        expect(
          group['group_id'],
          isNot(23),
          reason: 'Never use production group 23.',
        );
        container.read(routerProvider).go('/verify');
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: const IncognitoApp(),
          ),
        );
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField), 'DEMO-INVITE');
        await tester.scrollUntilVisible(
          find.text('Verify membership'),
          200,
          scrollable: find
              .descendant(
                of: find.byType(ListView).first,
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.tap(find.text('Verify membership'));
        for (var i = 0; i < 90 && !container.read(sessionProvider); i++) {
          await tester.pump(const Duration(seconds: 1));
        }
        expect(container.read(sessionProvider), isTrue);
        final repo = container.read(liveRepositoryProvider);
        final report = await repo.submit(
          'Bullying',
          'Fictional Samsung fork test',
          'Fictional test: repeated shouting during team meetings.',
          DateTime(2026, 10, 11),
          [],
        );
        expect(report.committee, isNotEmpty);
        await repo.challenge(
          report,
          report.committee.first.name,
          'Professional relationship',
          'Fictional test: prior involvement creates a potential conflict.',
        );
        var verified = false;
        for (var i = 0; i < 30; i++) {
          final events = await repo.audit(report);
          verified =
              events.isNotEmpty &&
              events.every((event) => event.state == 'Verified on Polygon');
          if (verified) break;
          await Future<void>.delayed(const Duration(seconds: 1));
        }
        expect(verified, isTrue);
        container
            .read(routerProvider)
            .go('/case/${report.id}/audit', extra: report);
        await tester.pumpAndSettle();
        for (
          var i = 0;
          i < 30 && find.text('Verified on Polygon').evaluate().isEmpty;
          i++
        ) {
          await tester.pump(const Duration(seconds: 1));
        }
        expect(find.text('Verified on Polygon'), findsWidgets);
        // Timing metadata only. Never print keys, payloads, tokens or proofs.
        debugPrint('DEVICE_PROOF_TIMING_MS=${prover.milliseconds.join(',')}');
      } on ApiFailure catch (error) {
        fail('Device fork API failed: ${error.reason}');
      } finally {
        await prover.inner.dispose();
        container.dispose();
        await secrets.clear();
      }
    },
    timeout: const Timeout(Duration(minutes: 10)),
  );
}
