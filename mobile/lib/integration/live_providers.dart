import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';
import 'live_repository.dart';
import 'reporter_zk.dart';
import 'secret_store.dart';
import 'zk_prover.dart';

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

/// OfflineProver works against the stub's CHAIN_MODE=offline. For CHAIN_MODE=live, override with
/// SemaphoreProver (mobile/integration/semaphore_prover.dart.example).
final zkProverProvider = Provider<ZkProver>(
  (ref) => OfflineProver(ref.watch(identityKeyProvider)),
);

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
