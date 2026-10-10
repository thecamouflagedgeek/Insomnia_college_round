import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/integration/webview_prover.dart';
import 'package:mobile/integration/zk_prover.dart';
import 'package:mobile/integration/secret_store.dart';
import 'package:mobile/integration/errors.dart';

class FakeProverHost implements ProverHost {
  int starts = 0, calls = 0, closes = 0;
  final requests = <Map<String, dynamic>>[];
  ProverReply reply = const ProverReply(value: '123');
  @override
  Future<void> start() async {
    starts++;
  }

  @override
  Future<ProverReply> call(
    String function,
    Map<String, dynamic> arguments,
  ) async {
    calls++;
    requests.add(arguments);
    return reply;
  }

  @override
  Future<void> dispose() async {
    closes++;
  }
}

void main() {
  test(
    'One lazy host and a stable secure key, base64 encoded only for local JS',
    () async {
      final store = MemorySecretStore(), host = FakeProverHost();
      final prover = WebViewProver(IdentityKey(store), host: host);
      expect(host.starts, 0);
      final commitments = await Future.wait([
        prover.commitment(),
        prover.commitment(),
      ]);
      expect(commitments, ['123', '123']);
      expect(host.starts, 1);
      expect(host.requests[0]['privateKey'], host.requests[1]['privateKey']);
      expect(
        base64Decode(host.requests[0]['privateKey'] as String),
        hasLength(32),
      );
      await prover.dispose();
      expect(host.closes, 1);
      await expectLater(prover.commitment(), throwsA(isA<ProverFailure>()));
    },
  );
  test('Proof preserves member order and text signals, validates decimal wire shape', () async {
    final host = FakeProverHost()
      ..reply = const ProverReply(
        value: {
          'merkle_tree_depth': 16,
          'merkle_tree_root': '456',
          'nullifier': '7',
          'message': '8',
          'scope': '9',
          'points': ['1', '2', '3', '4', '5', '6', '7', '8'],
        },
      );
    final prover = WebViewProver(IdentityKey(MemorySecretStore()), host: host);
    final proof = await prover.prove(
      members: ['22', '11'],
      onchainRoot: '456',
      message: 'm:exact',
      scope: 'cmp:2026-10-11',
    );
    expect(proof['points'], hasLength(8));
    final args = host.requests.single['args'] as Map;
    expect(args['members'], ['22', '11']);
    expect(args['message'], 'm:exact');
    expect(args['scope'], 'cmp:2026-10-11');
    expect(args['depth'], 16);
    await prover.dispose();
  });
  test('Root mismatch maps to existing exception; other errors never reveal details', () async {
    final host = FakeProverHost()
      ..reply = const ProverReply(error: 'Error: GROUP_ROOT_MISMATCH:111:222');
    final prover = WebViewProver(IdentityKey(MemorySecretStore()), host: host);
    await expectLater(
      prover.commitment(),
      throwsA(
        isA<GroupRootMismatch>()
            .having((e) => e.local, 'local', '111')
            .having((e) => e.onchain, 'onchain', '222'),
      ),
    );
    host.reply = const ProverReply(error: 'sensitive native details');
    await expectLater(prover.commitment(), throwsA(isA<ProverFailure>()));
    expect(friendlyError(const ProverFailure()), isNot(contains('sensitive')));
    expect(friendlyError(const ProverFailure()), contains('membership proof'));
    await prover.dispose();
  });
  test('Malformed proof never reaches report transport', () async {
    final host = FakeProverHost()
      ..reply = const ProverReply(
        value: {
          'merkle_tree_depth': 16,
          'merkle_tree_root': '456',
          'nullifier': 7,
          'message': '8',
          'scope': '9',
          'points': [],
        },
      );
    final prover = WebViewProver(IdentityKey(MemorySecretStore()), host: host);
    await expectLater(
      prover.prove(
        members: ['1'],
        onchainRoot: '456',
        message: 'm:test',
        scope: 'scope',
      ),
      throwsA(isA<ProverFailure>()),
    );
    await prover.dispose();
  });
}
