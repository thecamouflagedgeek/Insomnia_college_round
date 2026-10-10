import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

import 'secret_store.dart';
import 'signals.dart';

/// The phone's Semaphore identity and proof generation. Two implementations:
/// - [OfflineProver] (here): no cryptography; for the stub's CHAIN_MODE=offline and widget tests.
/// - SemaphoreProver (mobile/integration/semaphore_prover.dart.example): the Semaphore Flutter SDK, for
///   CHAIN_MODE=live. Copy it into lib/integration once the `semaphore` package builds on your machine.
abstract interface class ZkProver {
  /// Decimal identity commitment; the only identity-derived value that ever leaves the phone (at enrolment).
  Future<String> commitment();

  /// Semaphore proof JSON as the SDK exports it (decimal strings, Solidity-packed points). [members] in
  /// GET /zk/group order; [onchainRoot] is checked against the locally built group root before proving.
  Future<Map<String, dynamic>> prove({
    required List<String> members,
    required String onchainRoot,
    required String message,
    required String scope,
  });
}

class GroupRootMismatch implements Exception {
  GroupRootMismatch(this.local, this.onchain);
  final String local, onchain;
  @override
  String toString() => 'Group root mismatch: local $local, on-chain $onchain';
}

/// Stores the identity private key (32 random bytes) in secure storage; created on first use.
class IdentityKey {
  IdentityKey(this._store);
  static const _key = 'incognito.zk.identity.v1';
  final SecretStore _store;

  Future<Uint8List> load() async {
    final existing = await _store.read(_key);
    if (existing != null) return base64Decode(existing);
    final fresh = randomBytes(32);
    await _store.write(_key, base64Encode(fresh));
    return fresh;
  }
}

/// Stand-in prover: a deterministic fake commitment and a proof that carries the correctly encoded
/// message/scope and a per-(identity, scope) nullifier, so the offline stub enforces the same binding and
/// replay rules as the real chain. Points are zeros; only CHAIN_MODE=offline accepts these.
class OfflineProver implements ZkProver {
  OfflineProver(this._key);
  final IdentityKey _key;

  BigInt _hash(List<int> bytes) =>
      BigInt.parse(sha256.convert(bytes).toString(), radix: 16) >> 8;

  @override
  Future<String> commitment() async =>
      _hash([...await _key.load(), 1]).toString();

  @override
  Future<Map<String, dynamic>> prove({
    required List<String> members,
    required String onchainRoot,
    required String message,
    required String scope,
  }) async {
    final secret = await _key.load();
    return {
      'merkle_tree_depth': 16,
      'merkle_tree_root': onchainRoot,
      'nullifier': _hash([...secret, ...utf8.encode(scope)]).toString(),
      'message': bytes32Text(message).toString(),
      'scope': bytes32Text(scope).toString(),
      'points': List.filled(8, '0'),
    };
  }
}
