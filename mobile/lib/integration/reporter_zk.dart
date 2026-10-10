import 'dart:convert';

import 'api_client.dart';
import 'signals.dart';
import 'zk_prover.dart';

class NotEnrolled implements Exception {
  @override
  String toString() => 'This phone is not enrolled yet.';
}

/// The ZK half of the reporter journey: enrol once, then attach a membership proof to each report and
/// challenge. Payloads are serialized exactly once and the proof is bound to that string.
class ReporterZk {
  ReporterZk(this._api, this._prover);
  final IncognitoApi _api;
  final ZkProver _prover;

  /// One-time enrolment with an HR-issued code. Re-enrolling the same phone is treated as success.
  Future<void> enroll(String enrollCode) async {
    try {
      await _api.enroll(await _prover.commitment(), enrollCode);
    } on ApiFailure catch (e) {
      if (e.reason != 'already_enrolled') rethrow;
    }
  }

  Future<bool> isEnrolled() async {
    final members = List<String>.from((await _api.group())['members'] as List);
    return members.contains(await _prover.commitment());
  }

  Future<Json> _proof(String payload, String scopeArgument) async {
    final group = await _api.group();
    final members = List<String>.from(group['members'] as List);
    if (!members.contains(await _prover.commitment())) throw NotEnrolled();
    return _prover.prove(
      members: members,
      onchainRoot: group['onchain_root'] as String,
      message: messageText(payload),
      scope: scopeArgument,
    );
  }

  /// POST /reports. Returns {case_id, case_token, status, proof_tx, explorer_url}.
  Future<Json> submitReport(Map<String, Object?> report) async {
    final payload = jsonEncode(report);
    final scope = (await _api.complaintScope())['sdk_argument'] as String;
    return _api.submitReport(payload, await _proof(payload, scope));
  }

  /// POST /reports/{id}/challenge with a proof scoped to (case, member): one challenge per member per case.
  Future<Json> challenge(
    String caseId,
    String caseToken,
    Map<String, Object?> challenge,
  ) async {
    final payload = jsonEncode(challenge);
    final scope =
        (await _api.challengeScope(
              caseId,
              challenge['member_id']! as String,
            ))['sdk_argument']
            as String;
    return _api.challenge(
      caseId,
      caseToken,
      payload,
      await _proof(payload, scope),
    );
  }
}
