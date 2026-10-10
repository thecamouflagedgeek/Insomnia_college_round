import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';
import 'live_repository.dart';
import 'reporter_zk.dart';
import 'secret_store.dart';
import 'zk_prover.dart';
import 'webview_prover.dart';

/// `--dart-define=API_BASE_URL=http://<dev machine>:8000` (default: the Android emulator's host loopback).
const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000',
);

final secretStoreProvider = Provider<SecretStore>((ref) => SecureSecretStore());
final caseVaultProvider = Provider(
  (ref) => CaseVault(ref.watch(secretStoreProvider)),
);
final identityKeyProvider = Provider(
  (ref) => IdentityKey(ref.watch(secretStoreProvider)),
);
final incognitoApiProvider = Provider((ref) => IncognitoApi(apiBaseUrl));

/// Real local WebView proving by default. ZK_PROVER=offline is for the offline stub only.
final zkProverProvider = Provider<ZkProver>((ref) {
  final key = ref.watch(identityKeyProvider);
  if (const String.fromEnvironment('ZK_PROVER', defaultValue: 'webview') !=
      'webview') {
    return OfflineProver(key);
  }
  final prover = WebViewProver(key);
  ref.onDispose(() => unawaited(prover.dispose()));
  return prover;
});

final reporterZkProvider = Provider(
  (ref) =>
      ReporterZk(ref.watch(incognitoApiProvider), ref.watch(zkProverProvider)),
);

/// Swap into data/repository.dart:
/// ```dart
/// final repositoryProvider = Provider<EmployeeRepository>(
///   (ref) => demoEnabled ? DemoRepository() : ref.watch(liveRepositoryProvider));
/// ```
final liveRepositoryProvider = Provider(
  (ref) => LiveRepository(
    ref.watch(incognitoApiProvider),
    ref.watch(reporterZkProvider),
    ref.watch(caseVaultProvider),
  ),
);
