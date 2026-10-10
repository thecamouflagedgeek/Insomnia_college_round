import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/data/repository.dart';
import 'package:mobile/features/story/story_state.dart';

class FailingStoryRepository extends DemoRepository {
  @override
  Future<Report> submitStory(StorySubmission submission) async =>
      throw StateError('Unavailable');
}

void main() {
  test(
    'Understanding and discard do not create reports or alter formal data',
    () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final repository = container.read(repositoryProvider);
      final before = await repository.reports();
      final messages = before.first.messages.length;
      final challenges = before.first.challenges.length;
      final session = container.read(storyProvider.notifier);
      session.write('  My exact experience.\nI am still uncertain.  ');
      session.understand();
      session.toggle(demoSuggestions.first);
      session.toggle(demoSuggestions[1]);
      session.addAttachment(
        const StoryAttachment('context.pdf', 100, '/local/context.pdf'),
      );
      expect(container.read(storyProvider).suggestions.length, 2);
      expect((await repository.reports()).length, before.length);
      expect(before.first.messages.length, messages);
      expect(before.first.challenges.length, challenges);
      session.discard();
      final cleared = container.read(storyProvider);
      expect(cleared.narrative, isEmpty);
      expect(cleared.suggestions, isEmpty);
      expect(cleared.attachments, isEmpty);
      expect(cleared.understanding, isFalse);
      expect((await repository.reports()).length, before.length);
    },
  );
  test('Explicit submission preserves exact text and multiple categories, then clears', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final session = container.read(storyProvider.notifier);
    const exact = '  Original words\nwith whitespace.  ';
    session.write(exact);
    session.understand();
    session.toggle(demoSuggestions[0]);
    session.toggle(demoSuggestions[1]);
    session.addAttachment(
      const StoryAttachment('note.pdf', 50, '/private/note.pdf'),
    );
    await expectLater(
      session.submit(explicitlyConfirmed: false),
      throwsStateError,
    );
    expect((await container.read(repositoryProvider).reports()).length, 1);
    final report = await session.submit(explicitlyConfirmed: true);
    expect(report.description, exact);
    expect(report.suggestedCategories, ['Harassment', 'Bullying']);
    expect(report.files, ['note.pdf']);
    expect(report.status, 'Submitted');
    expect(report.dateIsIncident, isFalse);
    expect(container.read(storyProvider).narrative, isEmpty);
  });
  test(
    'Failure retains temporary story; fresh app container starts empty',
    () async {
      final container = ProviderContainer(
        overrides: [
          repositoryProvider.overrideWithValue(FailingStoryRepository()),
        ],
      );
      addTearDown(container.dispose);
      final session = container.read(storyProvider.notifier);
      session.write('A private narrative');
      await expectLater(
        session.submit(explicitlyConfirmed: true),
        throwsStateError,
      );
      expect(container.read(storyProvider).narrative, 'A private narrative');
      final fresh = ProviderContainer();
      addTearDown(fresh.dispose);
      expect(fresh.read(storyProvider).narrative, isEmpty);
    },
  );
  test('Clearing employee session discards private story', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(sessionProvider.notifier).enterDemo();
    container.read(storyProvider.notifier).write('Private context');
    container.read(sessionProvider.notifier).clear();
    expect(container.read(storyProvider).narrative, isEmpty);
  });
  testWidgets(
    'Review never submits without confirmation; confirmed report begins workflow',
    (tester) async {
      tester.view.physicalSize = const Size(360, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.read(sessionProvider.notifier).enterDemo();
      container.read(routerProvider).go('/story');
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const IncognitoApp(),
        ),
      );
      await tester.pumpAndSettle();
      Future<void> tapText(String label) async {
        if (find.text(label).evaluate().isEmpty) {
          await tester.scrollUntilVisible(
            find.text(label),
            200,
            scrollable: find.byType(Scrollable).first,
          );
        }
        await tester.ensureVisible(find.text(label));
        await tester.pumpAndSettle();
        await tester.tap(find.text(label));
        await tester.pumpAndSettle();
      }

      const exact = '  These are my own words.\nNot yet a report.  ';
      await tester.enterText(find.byKey(const Key('story-narrative')), exact);
      tester.testTextInput.hide();
      await tester.pumpAndSettle();
      await tapText('Continue Understanding');
      await tapText('Proceed to Report');
      expect(
        (tester.widget<SelectableText>(
          find.byKey(const Key('story-exact-review')),
        )).data,
        exact,
      );
      expect(
        (await tester.runAsync(
          () => container.read(repositoryProvider).reports(),
        ))!.length,
        1,
      );
      await tapText('Confirm and submit demo report');
      expect(
        (await tester.runAsync(
          () => container.read(repositoryProvider).reports(),
        ))!.length,
        1,
      );
      await tester.ensureVisible(find.byKey(const Key('story-confirm')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('story-confirm')));
      await tester.pumpAndSettle();
      await tapText('Confirm and submit demo report');
      final reports = (await tester.runAsync(
        () => container.read(repositoryProvider).reports(),
      ))!;
      expect(reports.length, 2);
      expect(reports.first.description, exact);
      expect(container.read(storyProvider).narrative, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Leaving story via back clears the temporary draft', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    container.read(sessionProvider.notifier).enterDemo();
    container.read(routerProvider).go('/home');
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const IncognitoApp(),
      ),
    );
    await tester.pumpAndSettle();
    container.read(routerProvider).push('/story');
    await tester.pumpAndSettle();
    container.read(storyProvider.notifier).write('Temporary words');
    container.read(routerProvider).pop();
    await tester.pumpAndSettle();
    expect(container.read(storyProvider).narrative, isEmpty);
  });
}
