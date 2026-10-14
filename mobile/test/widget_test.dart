import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/app.dart';
import 'package:mobile/data/repository.dart';

void main() {
  testWidgets('Welcome introduces verification without claiming success', (
    tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: IncognitoApp()));
    expect(find.text('A safer way\nto speak up.'), findsOneWidget);
    await tester.ensureVisible(find.text('Get started'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(find.text('Explore the labelled demo'), findsOneWidget);
    expect(find.textContaining('integration pending'), findsOneWidget);
  });
  test('Demo challenge cannot approve or reassign a committee', () async {
    final repository = DemoRepository();
    // A demo case with a seated committee and no challenge yet.
    final report = (await repository.reports()).firstWhere(
      (r) => r.challenges.isEmpty && r.status == 'Committee assigned',
    );
    final committee = report.committee.map((m) => m.id).toList();
    // Demo mode mirrors challenges to the seeded backend case. flutter_test answers every HTTP request
    // with 400, so here the sync fails and the app must say so rather than claim it was sent.
    await expectLater(
      repository.challenge(
        report,
        committee.first,
        'Prior involvement',
        'A contextual explanation',
      ),
      throwsA(isA<SyncWarningException>()),
    );
    final filed = report.challenges.single.status.toLowerCase();
    expect(filed, contains('not synced'));
    expect(filed, isNot(anyOf(contains('approved'), contains('upheld'))));
    expect(report.status, 'Under challenge');
    expect(report.committee.map((m) => m.id).toList(), committee);
    final audit = await repository.audit(report);
    expect(audit.any((event) => event.state == 'Verified'), isFalse);
  });
  test('Demo submission and messages retain no identity field', () async {
    final repository = DemoRepository();
    final report = await repository.submit(
      'Other',
      'Example concern',
      'A fictional description',
      DateTime(2026),
      [],
    );
    // Short demo numbers never collide with backend ids (INC- plus 8 hex characters).
    expect(report.id, matches(RegExp(r'^INC-\d{4}$')));
    await expectLater(
      repository.send(report, 'More context'),
      throwsA(isA<SyncWarningException>()),
    );
    expect(report.messages.last.sender, startsWith('You'));
    final invitation = (await repository.invitations()).first;
    await repository.respond(invitation, 'Declined — demo');
    expect(invitation.response, 'Declined — demo');
  });
}
