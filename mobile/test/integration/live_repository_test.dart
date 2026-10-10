// Full reporter journey through LiveRepository against a running stub in CHAIN_MODE=offline:
//   cd backend && CHAIN_MODE=offline STUB_ADMIN_KEY=adm ../.venv/bin/uvicorn app.stub.main:app --port 8010
//   cd mobile && flutter test test/integration --dart-define=INCOGNITO_STUB_URL=http://127.0.0.1:8010
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/integration/api_client.dart';
import 'package:mobile/integration/live_repository.dart';
import 'package:mobile/integration/reporter_zk.dart';
import 'package:mobile/integration/secret_store.dart';
import 'package:mobile/integration/zk_prover.dart';

const stubUrl = String.fromEnvironment('INCOGNITO_STUB_URL');

void main() {
  late IncognitoApi api;
  late ReporterZk zk;
  late CaseVault vault;
  late LiveRepository repo;

  setUp(() {
    final store = MemorySecretStore();
    api = IncognitoApi(stubUrl);
    zk = ReporterZk(api, OfflineProver(IdentityKey(store)));
    vault = CaseVault(store);
    repo = LiveRepository(api, zk, vault);
  });

  test(
    'enrol, report with evidence, inbox, challenge, witness, audit',
    () async {
      expect(
        () => zk.submitReport({'category': 'Bullying'}),
        throwsA(isA<NotEnrolled>()),
      );
      await expectLater(zk.enroll('wrong-code'), throwsA(isA<ApiFailure>()));
      await zk.enroll('DEMO-INVITE');
      await zk.enroll('DEMO-INVITE'); // idempotent
      expect(await zk.isEnrolled(), isTrue);

      final file = File(
        '${Directory.systemTemp.createTempSync().path}/note.txt',
      )..writeAsStringSync('evidence');
      final report = await repo.submit(
        'Bullying',
        'Stand-ups',
        'Repeated shouting, run ${DateTime.now().microsecondsSinceEpoch}.',
        DateTime(2026, 10, 9),
        [file.path],
      );
      expect(report.id, startsWith('INC-'));
      expect(report.status, 'Committee assigned');
      expect(report.files, ['note.txt']);
      expect(report.messages, isEmpty);
      expect(report.committee.map((m) => m.name), [
        'Marcus Vance',
        'David Kim',
      ]);

      // One complaint per identity per UTC day: the daily scope's nullifier is already used.
      await expectLater(
        repo.submit(
          'Bullying',
          'Again',
          'Second report.',
          DateTime(2026, 10, 9),
          [],
        ),
        throwsA(isA<ApiFailure>().having((e) => e.reason, 'reason', 'replay')),
      );

      await repo.send(report, 'It happens every Monday.');
      await repo.challenge(
        report,
        'David Kim',
        'Prior involvement',
        'They reviewed my last complaint.',
      );
      await expectLater(
        repo.challenge(
          report,
          'David Kim',
          'Other',
          'Trying the same member twice.',
        ),
        throwsA(isA<ApiFailure>().having((e) => e.reason, 'reason', 'replay')),
      );

      final listed = await repo.reports();
      expect(listed.single.id, report.id);
      expect(listed.single.challenges.single.member, 'David Kim');
      expect(
        listed.single.challenges.single.status,
        'Submitted · independent review pending',
      );
      expect(listed.single.messages.single.text, 'It happens every Monday.');

      final hr = Dio(
        BaseOptions(
          baseUrl: stubUrl,
          headers: {'X-Stub-Admin': 'adm', 'X-Staff-Id': 'usr_elena'},
        ),
      );
      await hr.post(
        '/hr/cases/${report.id}/messages',
        data: {'text': 'Which day did it start?'},
      );
      await repo.refresh(report);
      expect(report.messages.map((m) => m.sender), [
        'You',
        'Investigation team',
      ]);
      expect(report.messages.last.text, 'Which day did it start?');

      final admin = Dio(
        BaseOptions(baseUrl: stubUrl, headers: {'X-Stub-Admin': 'adm'}),
      );
      final invite = await admin.post(
        '/_stub/witness-invitations',
        data: {'case_id': report.id, 'context': 'Team meeting on 9 Oct'},
      );
      expect(await repo.invitations(), isEmpty);
      await vault.setWitnessCode(invite.data['witness_code'] as String);
      final invitations = await repo.invitations();
      await repo.respond(invitations.single, 'Accepted — demo');
      expect(invitations.single.response, 'accept');

      // A case cannot be resolved while a challenge is pending: the independent reviewer rules first.
      final reviewer = Dio(
        BaseOptions(
          baseUrl: stubUrl,
          headers: {'X-Stub-Admin': 'adm', 'X-Staff-Id': 'usr_aris'},
        ),
      );
      final pending = ((await reviewer.get('/hr/challenges')).data as List)
          .where((c) => c['complaintId'] == report.id)
          .toList();
      await reviewer.post(
        '/hr/challenges/${pending.single['id']}/decide',
        data: {
          'decision': 'reject',
          'rationale': 'No reporting line between them.',
        },
      );

      // Reflect & Reform: HR resolves, the reporter sees the outcome and gives anonymous feedback once.
      await hr.post(
        '/hr/cases/${report.id}/resolve',
        data: {
          'outcome': 'substantiated',
          'summary': 'Witnesses corroborate the reported pattern.',
          'actions': ['Manager coaching'],
        },
      );
      await repo.refresh(report);
      expect(report.resolutionOutcome, 'Substantiated');
      expect(report.resolutionActions, ['Manager coaching']);
      await repo.reflect(
        report,
        fairness: 4,
        feltSafe: true,
        wouldReportAgain: true,
      );
      expect(report.reflectionSubmitted, isTrue);
      await expectLater(
        repo.reflect(
          report,
          fairness: 1,
          feltSafe: false,
          wouldReportAgain: false,
        ),
        throwsA(isA<ApiFailure>()),
      );

      final suggestions = await repo.suggest(
        'I faced retaliation after reporting my manager',
      );
      expect(suggestions.map((s) => s.category), contains('Retaliation'));

      var audit = await repo.audit(report);
      for (
        var i = 0;
        i < 20 && audit.any((e) => e.state != 'Verified on Polygon');
        i++
      ) {
        await Future<void>.delayed(const Duration(milliseconds: 500));
        audit = await repo.audit(report);
      }
      expect(audit.map((e) => e.state).toSet(), {'Verified on Polygon'});
      expect(audit.first.title, 'Report recorded');
      expect(
        audit.map((e) => e.title),
        containsAll([
          'Evidence sealed',
          'Challenge submitted',
          'Message exchanged',
          'Severity assessed',
          'Resolution recorded',
        ]),
      );
    },
    skip: stubUrl.isEmpty ? 'set --dart-define=INCOGNITO_STUB_URL' : false,
  );
}
