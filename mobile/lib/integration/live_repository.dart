import 'dart:io';

import 'package:intl/intl.dart';

import '../data/repository.dart';
import '../features/story/story_state.dart';
import 'api_client.dart';
import 'reporter_zk.dart';
import 'secret_store.dart';

const _statusLabels = {
  'submitted': 'Submitted',
  'committee_assigned': 'Committee assigned',
  'investigating': 'Under investigation',
  'resolved': 'Resolved',
  'closed': 'Closed',
};

const _outcomeLabels = {
  'substantiated': 'Substantiated',
  'partially_substantiated': 'Partially substantiated',
  'not_substantiated': 'Not substantiated',
  'resolved_informally': 'Resolved informally',
};

const _challengeLabels = {
  'pending_review': 'Submitted · independent review pending',
  'upheld': 'Upheld · member replaced',
  'rejected': 'Reviewed · assignment maintained',
};

const _eventTitles = {
  'complaint_submitted': 'Report recorded',
  'evidence_sealed': 'Evidence sealed',
  'case_classified': 'Case classified',
  'severity_assessed': 'Severity assessed',
  'committee_assigned': 'Committee assigned',
  'challenge_filed': 'Challenge submitted',
  'challenge_decided': 'Challenge decided',
  'member_replaced': 'Committee member replaced',
  'access_revoked': 'Access revoked',
  'witness_quorum_started': 'Witnesses invited',
  'witness_response_recorded': 'Witness response recorded',
  'inbox_message': 'Message exchanged',
  'notice_sent': 'Notice sent',
  'status_changed': 'Status changed',
  'resolution_recorded': 'Resolution recorded',
  'export_generated': 'Evidence package exported',
  'reflection_recorded': 'Feedback received',
};

const _verifyStates = {
  'verified': 'Verified on Polygon',
  'pending_anchor': 'Sealed, waiting for the next Polygon anchor',
  'tampered': 'Verification failed: record was altered',
  'chain_broken': 'Verification failed: an earlier record changed',
  'anchor_mismatch': 'Verification failed: does not match Polygon',
};

/// EmployeeRepository over shared/api-contract.yaml. Drop-in for DemoRepository; see [liveRepositoryProvider].
class LiveRepository implements EmployeeRepository, StoryReportRepository {
  LiveRepository(this._api, this._zk, this._vault);
  final IncognitoApi _api;
  final ReporterZk _zk;
  final CaseVault _vault;
  final _committees = <String, List<Json>>{};

  Future<String> _token(String caseId) async {
    final token = await _vault.token(caseId);
    if (token == null) throw ApiFailure('case_not_found');
    return token;
  }

  Future<Report> _load(String caseId, String token) async {
    final view = await _api.report(caseId, token);
    final messages = await _api.messages(caseId, token);
    final committee = List<Json>.from(view['committee'] as List);
    _committees[caseId] = committee;
    final names = {for (final m in committee) m['member_id']: m['name']};
    final incident = view['incident_date'] as String?;
    final report = Report(
      id: caseId,
      category: view['category'] as String,
      title: view['title'] as String,
      description: view['description'] as String,
      date: DateTime.parse(incident ?? view['created_at'] as String),
      dateIsIncident: incident != null,
      files: [
        for (final e in view['evidence'] as List) (e as Json)['name'] as String,
      ],
      suggestedCategories: List<String>.from(view['categories'] as List),
      committee: [
        for (final m in committee)
          CommitteeMember(
            m['member_id'] as String,
            m['name'] as String,
            m['role'] as String,
          ),
      ],
    );
    report.status = _statusLabels[view['status']] ?? view['status'] as String;
    final resolution = view['resolution'] as Json?;
    if (resolution != null) {
      report.resolutionOutcome =
          _outcomeLabels[resolution['outcome']] ??
          resolution['outcome'] as String;
      report.resolutionActions = List<String>.from(
        resolution['actions'] as List,
      );
    }
    report.reflectionSubmitted = view['reflection_submitted'] as bool? ?? false;
    for (final c in (view['challenges'] as List).cast<Json>()) {
      report.challenges.add(
        Challenge(
          names[c['member_id']] ?? c['member_id'] as String,
          c['reason'] as String,
          '',
          status: _challengeLabels[c['status']] ?? c['status'] as String,
        ),
      );
    }
    report.messages
      ..clear()
      ..addAll([
        for (final m in messages.cast<Json>())
          Note(
            m['sender'] == 'you' ? 'You' : 'Investigation team',
            m['text'] as String,
            DateTime.parse(m['at'] as String).toLocal(),
          ),
      ]);
    return report;
  }

  @override
  Future<List<Report>> reports() async {
    final tokens = await _vault.tokens();
    final out = <Report>[];
    for (final entry in tokens.entries) {
      try {
        out.add(await _load(entry.key, entry.value));
      } on ApiFailure catch (e) {
        if (e.reason != 'case_not_found') rethrow;
      }
    }
    return out.reversed.toList();
  }

  Future<Report> _submit(
    Map<String, Object?> payload,
    Iterable<({String path, String name})> files,
  ) async {
    final created = await _zk.submitReport({
      ...payload,
      'client_nonce': randomNonce(),
    });
    final caseId = created['case_id'] as String,
        token = created['case_token'] as String;
    await _vault.add(caseId, token);
    for (final f in files) {
      if (File(f.path).existsSync()) {
        await _api.uploadEvidence(caseId, token, f.path, f.name);
      }
    }
    return _load(caseId, token);
  }

  /// [files] are file paths. (CreateReportScreen currently passes names; pass `f.path ?? f.name` to upload.)
  @override
  Future<Report> submit(
    String category,
    String title,
    String description,
    DateTime date,
    List<String> files,
  ) => _submit({
    'category': category,
    'categories': [category],
    'title': title,
    'description': description,
    'incident_date': DateFormat('yyyy-MM-dd').format(date),
  }, files.map((p) => (path: p, name: p.replaceAll(r'\', '/').split('/').last)));

  @override
  Future<Report> submitStory(StorySubmission submission) => _submit(
    {
      'category': submission.suggestedCategories.isEmpty
          ? 'Uncertain'
          : submission.suggestedCategories.first,
      'categories': submission.suggestedCategories,
      'title': 'Your story',
      'description': submission.narrative,
      'incident_date': null,
    },
    [
      for (final a in submission.attachments)
        if (a.path != null) (path: a.path!, name: a.name),
    ],
  );

  /// Reflect & Reform: anonymous, structured feedback once the case is resolved (no free text).
  Future<void> reflect(
    Report report, {
    required int fairness,
    required bool feltSafe,
    required bool wouldReportAgain,
  }) async {
    await _api.reflect(
      report.id,
      await _token(report.id),
      fairness,
      feltSafe,
      wouldReportAgain,
    );
    report.reflectionSubmitted = true;
  }

  /// Category suggestions from the server's classifier (stateless; nothing stored).
  Future<List<ClassificationSuggestion>> suggest(String narrative) async {
    final out = await _api.classify(narrative);
    return [
      for (final s in (out['suggestions'] as List).cast<Json>())
        ClassificationSuggestion(
          s['category'] as String,
          'Suggested from the words you used (match strength ${((s['score'] as num) * 100).round()}%). '
          'A routing aid for you to accept or ignore, not a finding.',
        ),
    ];
  }

  /// Re-reads a case into [report] in place (new investigator messages, challenge outcomes, committee changes).
  Future<void> refresh(Report report) async {
    final fresh = await _load(report.id, await _token(report.id));
    report.status = fresh.status;
    report.resolutionOutcome = fresh.resolutionOutcome;
    report.resolutionActions = fresh.resolutionActions;
    report.reflectionSubmitted = fresh.reflectionSubmitted;
    report.messages
      ..clear()
      ..addAll(fresh.messages);
    report.challenges
      ..clear()
      ..addAll(fresh.challenges);
    report.committee
      ..clear()
      ..addAll(fresh.committee);
  }

  /// [member] is the committee member's display name (or id) as shown by ChallengeScreen.
  @override
  Future<void> challenge(
    Report report,
    String member,
    String reason,
    String explanation,
  ) async {
    final token = await _token(report.id);
    if (!_committees.containsKey(report.id)) await _load(report.id, token);
    final match = _committees[report.id]!.where(
      (m) => m['name'] == member || m['member_id'] == member,
    );
    if (match.isEmpty) throw ApiFailure('unknown_member');
    await _zk.challenge(report.id, token, {
      'member_id': match.first['member_id'],
      'reason': reason,
      'explanation': explanation,
      'client_nonce': randomNonce(),
    });
    try {
      await refresh(report);
    } catch (_) {
      report.challenges.add(
        Challenge(
          member,
          reason,
          explanation,
          status: _challengeLabels['pending_review']!,
        ),
      );
      report.status = 'Under challenge';
    }
  }

  @override
  Future<void> send(Report report, String text) async {
    final token = await _token(report.id);
    await _api.sendMessage(report.id, token, text);
    try {
      await refresh(report);
    } catch (_) {
      report.messages.add(Note('You', text));
    }
  }

  @override
  Future<List<Invitation>> invitations() async {
    final code = await _vault.witnessCode();
    if (code == null) return [];
    return [
      for (final i in (await _api.invitations(code)).cast<Json>())
        Invitation(i['invitation_id'] as String, i['context'] as String)
          ..response = i['response'] as String?,
    ];
  }

  /// Accepts the UI's labels ("Accepted — demo") or the contract values (accept | decline).
  @override
  Future<void> respond(Invitation invitation, String response) async {
    final code = await _vault.witnessCode();
    if (code == null) throw ApiFailure('missing_witness_code');
    final value = response.toLowerCase().startsWith('accept')
        ? 'accept'
        : 'decline';
    final out = await _api.respond(code, invitation.id, value);
    invitation.response = out['response'] as String;
  }

  @override
  Future<List<AuditEvent>> audit(Report report) async {
    final token = await _token(report.id);
    final verification = await _api.verify(report.id, token);
    final receipts = {
      for (final r in (await _api.receipts(report.id, token)).cast<Json>())
        r['seq']: r,
    };
    return [
      for (final e in (verification['events'] as List).cast<Json>())
        AuditEvent(
          _eventTitles[e['event_type']] ?? e['event_type'] as String,
          _detail(e, receipts[e['seq']]),
          (receipts[e['seq']]?['entry_hash'] as String?) ?? '#${e['seq']}',
          _verifyStates[e['status']] ?? e['status'] as String,
        ),
    ];
  }

  String _detail(Json event, Json? receipt) {
    final at = event['at'] as String? ?? '';
    final tx = receipt?['anchor_tx'] as String?;
    if (tx == null) return 'Sealed $at. Not yet anchored.';
    return 'Sealed $at. Anchored on Polygon Amoy in tx ${tx.substring(0, 10)}…\n${receipt!['explorer_url']}';
  }
}
