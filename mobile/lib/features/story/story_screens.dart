import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/repository.dart';
import '../../widgets/components.dart';
import '../../core/theme.dart';
import '../../integration/errors.dart';
import '../../integration/live_providers.dart';
import 'story_state.dart';

class TellYourStoryScreen extends ConsumerStatefulWidget {
  const TellYourStoryScreen({super.key});
  @override
  ConsumerState<TellYourStoryScreen> createState() =>
      _TellYourStoryScreenState();
}

class _TellYourStoryScreenState extends ConsumerState<TellYourStoryScreen> {
  late final TextEditingController narrative;
  @override
  void initState() {
    super.initState();
    narrative = TextEditingController(text: ref.read(storyProvider).narrative);
  }

  @override
  void dispose() {
    narrative.clear();
    narrative.dispose();
    super.dispose();
  }

  void discard() {
    ref.read(storyProvider.notifier).discard();
    narrative.clear();
    context.go('/home');
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(storyProvider);
    final session = ref.read(storyProvider.notifier);
    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) session.discard();
      },
      child: PageShell(
        title: 'Tell your story.\nAt your own pace.',
        children: [
          const HintCard(
            'This is a private, temporary space—not a report. Your words stay in app memory. Nothing is sent to HR, uploaded, or recorded in Silent Audit.',
          ),
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Start wherever feels right.',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                const Text(
                  'You do not need a category, date, or legal language.',
                ),
                const SizedBox(height: 20),
                TextField(
                  key: const Key('story-narrative'),
                  controller: narrative,
                  onChanged: session.write,
                  minLines: 7,
                  maxLines: 16,
                  decoration: const InputDecoration(
                    hintText: 'What has your experience been like?',
                    labelText: 'Your words',
                  ),
                ),
              ],
            ),
          ),
          ActionButton(
            'Continue Understanding',
            draft.narrative.trim().isEmpty ? null : session.understand,
          ),
          if (draft.understanding) ...[
            HintCard(
              modeText(
                'Demonstration guidance only. These are fixed examples, not classifications inferred from your words. No model or external AI service reads your narrative. More than one concern may be relevant—or none may be clear.',
                'These suggestions come from keyword matching on the INCOGNITO server. Your words are not stored or logged, and nothing is reported until you confirm. More than one concern may be relevant—or none may be clear.',
              ),
            ),
            Text(
              'Possible ways to understand a concern',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            for (final suggestion
                in demoEnabled
                    ? demoSuggestions
                    : ref
                              .watch(liveSuggestionsProvider(draft.narrative))
                              .value ??
                          const <ClassificationSuggestion>[])
              SoftCard(
                onTap: () => session.toggle(suggestion),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            suggestion.category,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: ink,
                            ),
                          ),
                        ),
                        Icon(
                          draft.suggestions.contains(suggestion)
                              ? Icons.check_circle_outline
                              : Icons.add_circle_outline,
                          color: purple,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(suggestion.explanation),
                  ],
                ),
              ),
            const HintCard(
              'Uncertainty is welcome. Leave examples unselected if they do not fit. These possibilities are not findings or determinations of guilt.',
            ),
            const SoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Only if it helps',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  SizedBox(height: 12),
                  Text(
                    'Did this happen once, or over time?\nWas workplace authority involved?\nHow did it affect your ability to work?',
                  ),
                  SizedBox(height: 12),
                  Text(
                    'You can add context in your own words above. These questions are optional; avoid names or details you do not need to share.',
                  ),
                ],
              ),
            ),
            ActionButton(
              'Proceed to Report',
              () => context.push('/story/review'),
            ),
          ],
          TextButton(
            onPressed: discard,
            child: const Text('Discard Privately'),
          ),
          const Text(
            'Leaving this workspace clears your story. It is not saved across app restarts. Drafts cannot be recovered.',
          ),
        ],
      ),
    );
  }
}

class StoryReviewScreen extends ConsumerStatefulWidget {
  const StoryReviewScreen({super.key});
  @override
  ConsumerState<StoryReviewScreen> createState() => _StoryReviewScreenState();
}

class _StoryReviewScreenState extends ConsumerState<StoryReviewScreen> {
  bool confirmed = false, busy = false;
  String? error;
  Future<void> selectAttachment() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'txt', 'docx', 'jpg', 'jpeg', 'png'],
        withData: false,
      );
      if (!mounted || result == null) return;
      final file = result.files.single;
      final draft = ref.read(storyProvider);
      if (file.size > 20 * 1024 * 1024 || draft.attachments.length >= 5) {
        feedback(context, 'Choose up to five files, each under 20 MB.');
        return;
      }
      ref
          .read(storyProvider.notifier)
          .addAttachment(StoryAttachment(file.name, file.size, file.path));
      setState(() => confirmed = false);
    } catch (_) {
      if (mounted) {
        feedback(context, 'File selection unavailable. Nothing was uploaded.');
      }
    }
  }

  Future<void> submit() async {
    if (!confirmed || busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final report = await ref
          .read(storyProvider.notifier)
          .submit(explicitlyConfirmed: confirmed);
      if (mounted) context.go('/success', extra: report);
    } catch (e) {
      if (mounted) {
        setState(
          () => error = friendlyError(
            e,
            fallback: 'Submission did not complete. Your temporary story remains here. No success has been confirmed; retry only when ready.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(storyProvider);
    if (draft.narrative.trim().isEmpty && !busy) {
      return PageShell(
        title: 'Your private space\nis clear.',
        children: [
          const HintCard('There is no story ready to submit.'),
          ActionButton('Tell Your Story', () => context.go('/story')),
        ],
      );
    }
    return PopScope(
      canPop: !busy,
      child: PageShell(
        title: 'Your words.\nYour decision.',
        children: [
          const HintCard(
            'Review exactly what you are choosing to share. Opening this review has not created a case. Only explicit confirmation followed by successful submission starts the formal workflow.',
          ),
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Exact narrative',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                SelectableText(
                  draft.narrative,
                  key: const Key('story-exact-review'),
                ),
              ],
            ),
          ),
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Suggested categories · demo examples',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                if (draft.suggestions.isEmpty)
                  const Text('Uncertain / no category selected'),
                for (final suggestion in draft.suggestions)
                  Text(suggestion.category),
                const SizedBox(height: 12),
                const Text(
                  'These are possibilities you selected, not a finding.',
                ),
              ],
            ),
          ),
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Attachments selected for this report',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                if (draft.attachments.isEmpty) const Text('None'),
                for (final file in draft.attachments)
                  Row(
                    children: [
                      Expanded(
                        child: Text('${file.name} · ${file.size} bytes'),
                      ),
                      IconButton(
                        tooltip: 'Remove attachment',
                        onPressed: busy
                            ? null
                            : () {
                                ref
                                    .read(storyProvider.notifier)
                                    .removeAttachment(file);
                                setState(() => confirmed = false);
                              },
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                TextButton.icon(
                  onPressed: busy ? null : selectAttachment,
                  icon: const Icon(Icons.attach_file),
                  label: const Text('Select an attachment'),
                ),
              ],
            ),
          ),
          const HintCard(
            'Demo submission stores the exact narrative, suggested categories and attachment names in a local case. File contents are not uploaded. Live POST /reports and evidence submission remain pending an agreed contract. No HR-visible record is created by this demo.',
          ),
          CheckboxListTile(
            key: const Key('story-confirm'),
            value: confirmed,
            onChanged: busy
                ? null
                : (v) => setState(() => confirmed = v ?? false),
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'I explicitly choose to submit the reviewed story as a demo report.',
            ),
          ),
          if (error != null) HintCard(error!),
          ActionButton(
            'Confirm and submit demo report',
            confirmed && draft.narrative.trim().isNotEmpty ? submit : null,
            busy: busy,
          ),
          ActionButton(
            'Continue Understanding',
            busy
                ? null
                : () {
                    setState(() => confirmed = false);
                    context.pop();
                  },
          ),
          TextButton(
            onPressed: busy
                ? null
                : () {
                    ref.read(storyProvider.notifier).discard();
                    context.go('/home');
                  },
            child: const Text('Discard Privately'),
          ),
        ],
      ),
    );
  }
}
