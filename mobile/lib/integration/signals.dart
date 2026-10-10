import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

/// Proof message for a request body. Must match backend/app/chain/signals.py::message_text:
/// "m:" + the first 28 hex chars of sha256(utf8(payload)). Hash the exact string you send; never re-serialize.
String messageText(String payload) =>
    'm:${sha256.convert(utf8.encode(payload)).toString().substring(0, 28)}';

/// Semaphore's text signal encoding (what the SDK does with message/scope strings): UTF-8 bytes right-padded to
/// 32 bytes, read big-endian. Matches backend bytes32_text.
BigInt bytes32Text(String text) {
  final bytes = utf8.encode(text);
  if (bytes.length > 31) {
    throw ArgumentError('signal text must be <= 31 bytes, got ${bytes.length}');
  }
  var value = BigInt.zero;
  for (var i = 0; i < 32; i++) {
    value = (value << 8) | BigInt.from(i < bytes.length ? bytes[i] : 0);
  }
  return value;
}

/// GET /zk/group returns decimal commitments; the Flutter SDK's Group takes 32-byte little-endian elements.
Uint8List commitmentToElement(String decimal) {
  var v = BigInt.parse(decimal);
  final out = Uint8List(32);
  for (var i = 0; i < 32; i++) {
    out[i] = (v & BigInt.from(0xff)).toInt();
    v >>= 8;
  }
  if (v != BigInt.zero) throw ArgumentError('commitment exceeds 32 bytes');
  return out;
}

/// Inverse of [commitmentToElement]; also converts Group.root() to the decimal onchain_root format.
String elementToDecimal(Uint8List element) {
  var v = BigInt.zero;
  for (var i = element.length - 1; i >= 0; i--) {
    v = (v << 8) | BigInt.from(element[i]);
  }
  return v.toString();
}
