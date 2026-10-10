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
    final report = (await repository.reports()).first;
    await repository.challenge(
      report,
      'Member A',
      'Prior involvement',
      'A contextual explanation',
    );
    expect(report.challenges.single.status, 'Submitted — demo');
    expect(report.status, 'Committee assigned');
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
    expect(report.id, startsWith('DEMO-'));
    await repository.send(report, 'More context');
    expect(report.messages.last.sender, 'You');
    final invitation = (await repository.invitations()).first;
    await repository.respond(invitation, 'Declined — demo');
    expect(invitation.response, 'Declined — demo');
  });
}
