import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/story/story_state.dart';
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
/// Live category suggestions for a narrative; cached per text so selections keep their identity.
final liveSuggestionsProvider = FutureProvider.family((
  ref,
  String narrative,
) async {
  final repo = ref.watch(liveRepositoryProvider);
  final suggestions = await repo.suggest(narrative);
  return suggestions.isEmpty ? demoSuggestions : suggestions;
});

final liveRepositoryProvider = Provider(
  (ref) => LiveRepository(
    ref.watch(incognitoApiProvider),
    ref.watch(reporterZkProvider),
    ref.watch(caseVaultProvider),
  ),
);
