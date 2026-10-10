import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Small key-value seam over flutter_secure_storage so the integration layer is testable without platform
/// channels. Holds the ZK identity key, case tokens and witness codes, and nothing else.
abstract interface class SecretStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureSecretStore implements SecretStore {
  SecureSecretStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _s;
  @override
  Future<String?> read(String key) => _s.read(key: key);
  @override
  Future<void> write(String key, String value) => _s.write(key: key, value: value);
  @override
  Future<void> delete(String key) => _s.delete(key: key);
}

class MemorySecretStore implements SecretStore {
  final _m = <String, String>{};
  @override
  Future<String?> read(String key) async => _m[key];
  @override
  Future<void> write(String key, String value) async => _m[key] = value;
  @override
  Future<void> delete(String key) async => _m.remove(key);
}

Uint8List randomBytes(int n) {
  final r = Random.secure();
  return Uint8List.fromList(List.generate(n, (_) => r.nextInt(256)));
}

String randomNonce() => base64UrlEncode(randomBytes(12));

/// The reporter's case tokens (the only credential for a case; shown once by POST /reports) and the
/// optional witness code. Losing these loses access, by design: there is no account to recover.
class CaseVault {
  CaseVault(this._store);
  static const _casesKey = 'incognito.cases.v1';
  static const _witnessKey = 'incognito.witness.v1';
  final SecretStore _store;

  Future<Map<String, String>> tokens() async {
    final raw = await _store.read(_casesKey);
    return raw == null ? {} : Map<String, String>.from(jsonDecode(raw) as Map);
  }

  Future<String?> token(String caseId) async => (await tokens())[caseId];

  Future<void> add(String caseId, String token) async {
    final all = await tokens();
    all[caseId] = token;
    await _store.write(_casesKey, jsonEncode(all));
  }

  Future<String?> witnessCode() => _store.read(_witnessKey);
  Future<void> setWitnessCode(String code) => _store.write(_witnessKey, code);

  Future<void> clear() async {
    await _store.delete(_casesKey);
    await _store.delete(_witnessKey);
  }
}
