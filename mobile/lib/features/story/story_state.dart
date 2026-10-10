import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repository.dart';

class StoryAttachment {
  const StoryAttachment(this.name, this.size, this.path);
  final String name;
  final int size;
  final String? path;
}

class ClassificationSuggestion {
  const ClassificationSuggestion(this.category, this.explanation);
  final String category, explanation;
}

/// Fixed UI examples, independent of the narrative. No NLP or network processing.
const demoSuggestions = [
  ClassificationSuggestion(
    'Harassment',
    'Unwelcome conduct can raise a harassment concern. Context matters; this example does not establish what happened.',
  ),
  ClassificationSuggestion(
    'Bullying',
    'Repeated intimidating or undermining conduct can raise a bullying concern. A difficult interaction alone may not provide enough context.',
  ),
  ClassificationSuggestion(
    'Discrimination',
    'Different treatment linked to a personal characteristic can raise a discrimination concern. More context may be needed.',
  ),
  ClassificationSuggestion(
    'Abuse of Authority',
    'Misuse of workplace power can be a concern. The circumstances and impact may help clarify it.',
  ),
];

class StoryDraft {
  const StoryDraft({
    this.narrative = '',
    this.suggestions = const [],
    this.attachments = const [],
    this.understanding = false,
  });
  final String narrative;
  final List<ClassificationSuggestion> suggestions;
  final List<StoryAttachment> attachments;
  final bool understanding;
  StoryDraft copyWith({
    String? narrative,
    List<ClassificationSuggestion>? suggestions,
    List<StoryAttachment>? attachments,
    bool? understanding,
  }) => StoryDraft(
    narrative: narrative ?? this.narrative,
    suggestions: suggestions ?? this.suggestions,
    attachments: attachments ?? this.attachments,
    understanding: understanding ?? this.understanding,
  );
}

class StorySubmission {
  StorySubmission(StoryDraft draft)
    : narrative = draft.narrative,
      suggestedCategories = List.unmodifiable(
        draft.suggestions.map((s) => s.category),
      ),
      attachments = List.unmodifiable(draft.attachments);
  final String narrative;
  final List<String> suggestedCategories;
  final List<StoryAttachment> attachments;
}

/// This is an application boundary, not an agreed production request schema.
abstract interface class StoryReportRepository {
  Future<Report> submitStory(StorySubmission submission);
}

final storyProvider = NotifierProvider<StorySession, StoryDraft>(
  StorySession.new,
);

class StorySession extends Notifier<StoryDraft> {
  bool _submitting = false;
  @override
  StoryDraft build() {
    ref.listen(sessionProvider, (_, next) {
      if (!next) discard();
    });
    return const StoryDraft();
  }

  void write(String text) {
    if (!_submitting) {
      state = state.copyWith(
        narrative: text,
        suggestions: const [],
        understanding: false,
      );
    }
  }

  void understand() {
    if (!_submitting && state.narrative.trim().isNotEmpty) {
      state = state.copyWith(understanding: true);
    }
  }

  void toggle(ClassificationSuggestion suggestion) {
    if (_submitting) return;
    final selected = [...state.suggestions];
    if (selected.contains(suggestion)) {
      selected.remove(suggestion);
    } else {
      selected.add(suggestion);
    }
    state = state.copyWith(suggestions: List.unmodifiable(selected));
  }

  void addAttachment(StoryAttachment attachment) {
    if (!_submitting) {
      state = state.copyWith(
        attachments: List.unmodifiable([...state.attachments, attachment]),
      );
    }
  }

  void removeAttachment(StoryAttachment attachment) {
    if (!_submitting) {
      state = state.copyWith(
        attachments: List.unmodifiable(
          state.attachments.where((a) => a != attachment),
        ),
      );
    }
  }

  void discard() {
    state = const StoryDraft();
  }

  Future<Report> submit({required bool explicitlyConfirmed}) async {
    if (!explicitlyConfirmed || state.narrative.trim().isEmpty || _submitting) {
      throw StateError('Explicit confirmation and a narrative are required.');
    }
    final repository = ref.read(repositoryProvider);
    if (repository is! StoryReportRepository) {
      throw StateError(
        'The report submission contract is integration pending.',
      );
    }
    final snapshot = StorySubmission(state);
    _submitting = true;
    try {
      final report = await (repository as StoryReportRepository).submitStory(
        snapshot,
      );
      state = const StoryDraft();
      ref.invalidate(reportsProvider);
      return report;
    } finally {
      _submitting = false;
    }
  }
}

