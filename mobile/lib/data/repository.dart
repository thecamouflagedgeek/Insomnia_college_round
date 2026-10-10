import '../features/story/story_state.dart';
import '../integration/live_providers.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class Report {
  Report({
    required this.id,
    required this.category,
    required this.title,
    required this.description,
    required this.date,
    this.files = const [],
    this.suggestedCategories = const [],
    this.dateIsIncident = true,
    List<CommitteeMember>? committee,
  }) : committee = committee ?? List.of(demoCommittee);
  final String id, category, title, description;
  final DateTime date;
  final List<String> files;
  final List<String> suggestedCategories;
  final bool dateIsIncident;
  final List<CommitteeMember> committee;
  String status = 'Committee assigned';
  final List<Challenge> challenges = [];
  final List<Note> messages = [
    Note(
      'Investigation team',
      'Could you share the approximate time of the incident?',
    ),
  ];
}

class CommitteeMember {
  const CommitteeMember(this.id, this.name, this.role);
  final String id, name, role;
}

const demoCommittee = [
  CommitteeMember('demo-a', 'Committee member A', 'Member'),
  CommitteeMember('demo-b', 'Committee member B', 'Member'),
  CommitteeMember('demo-c', 'Committee member C', 'Member'),
];

class Challenge {
  Challenge(
    this.member,
    this.reason,
    this.explanation, {
    this.status = 'Submitted — demo',
  });
  final String member, reason, explanation;
  final String status;
}

class Note {
  Note(this.sender, this.text, [DateTime? date])
    : date = date ?? DateTime.now();
  final String sender, text;
  final DateTime date;
}

class Invitation {
  Invitation(this.id, this.context);
  final String id, context;
  String? response;
}

class AuditEvent {
  const AuditEvent(this.title, this.detail, this.receipt, this.state);
  final String title, detail, receipt, state;
}

abstract interface class EmployeeRepository {
  Future<List<Report>> reports();
  Future<Report> submit(
    String category,
    String title,
    String description,
    DateTime date,
    List<String> files,
  );
  Future<void> challenge(
    Report report,
    String member,
    String reason,
    String explanation,
  );
  Future<void> send(Report report, String text);
  Future<List<Invitation>> invitations();
  Future<void> respond(Invitation invitation, String response);
  Future<List<AuditEvent>> audit(Report report);
}

class DemoRepository implements EmployeeRepository, StoryReportRepository {
  final _reports = <Report>[
    Report(
      id: 'DEMO-1042',
      category: 'Abuse of Authority',
      title: 'Concern about team conduct',
      description: 'A fictional report for exploring the employee experience.',
      date: DateTime(2026, 10, 9),
    ),
  ];
  final _invitations = [
    Invitation(
      'DEMO-W08',
      'You are invited to voluntarily assist with an authorized workplace investigation. Interviews take place outside this app.',
    ),
  ];
  @override
  Future<Report> submitStory(StorySubmission submission) async {
    await _delay();
    final report = Report(
      id: 'DEMO-${1042 + _reports.length}',
      category: submission.suggestedCategories.isEmpty
          ? 'Uncertain'
          : submission.suggestedCategories.join(' · '),
      suggestedCategories: List.of(submission.suggestedCategories),
      title: 'Your story',
      description: submission.narrative,
      date: DateTime.now(),
      dateIsIncident: false,
      files: submission.attachments.map((a) => a.name).toList(),
    );
    report.status = 'Submitted';
    report.messages.clear();
    _reports.insert(0, report);
    return report;
  }

  Future<void> _delay() =>
      Future<void>.delayed(const Duration(milliseconds: 250));
  @override
  Future<List<Report>> reports() async {
    await _delay();
    return List.of(_reports);
  }

  @override
  Future<Report> submit(
    String category,
    String title,
    String description,
    DateTime date,
    List<String> files,
  ) async {
    await _delay();
    final report = Report(
      id: 'DEMO-${1042 + _reports.length}',
      category: category,
      title: title,
      description: description,
      date: date,
      files: List.of(files),
    );
    _reports.insert(0, report);
    return report;
  }

  @override
  Future<void> challenge(
    Report report,
    String member,
    String reason,
    String explanation,
  ) async {
    await _delay();
    report.challenges.add(Challenge(member, reason, explanation));
  }

  @override
  Future<void> send(Report report, String text) async {
    await _delay();
    report.messages.add(Note('You', text));
  }

  @override
  Future<List<Invitation>> invitations() async {
    await _delay();
    return _invitations;
  }

  @override
  Future<void> respond(Invitation invitation, String response) async {
    await _delay();
    invitation.response = response;
  }

  @override
  Future<List<AuditEvent>> audit(Report report) async {
    await _delay();
    return [
      AuditEvent(
        'Report recorded',
        'Local demo record only. No backend acceptance or cryptographic seal.',
        '${report.id}-01',
        'Unavailable',
      ),
      AuditEvent(
        'Committee assigned',
        'Fictional assignment for demonstrating a challenge.',
        '${report.id}-02',
        'Unavailable',
      ),
      for (final c in report.challenges)
        AuditEvent(
          'Challenge submitted',
          '${c.member}: ${c.status}. Independent decision pending.',
          '${report.id}-C',
          'Pending verification',
        ),
      const AuditEvent(
        'Altered-record example',
        'Illustrative failed-verification state. This is not a blockchain verification result.',
        'DEMO-FAILED',
        'Demo: verification failed',
      ),
    ];
  }
}

/// Proposed route transport only. Payload schemas/authentication require the shared contract.
/// Deliberately not wired to the UI until that contract is approved.
class ApiService {
  ApiService(String baseUrl)
    : client = Dio(
        BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
        ),
      );
  final Dio client;
  Future<Response<dynamic>> report(String id) =>
      client.get('/reports/${Uri.encodeComponent(id)}');
  Future<Response<dynamic>> messages(String id) =>
      client.get('/reports/${Uri.encodeComponent(id)}/messages');
  Future<Response<dynamic>> audit(String id) =>
      client.get('/reports/${Uri.encodeComponent(id)}/audit');
  void setCredential(String credential) {
    client.options.headers['Authorization'] = 'Bearer $credential';
  }

  void clearCredential() => client.options.headers.remove('Authorization');
}

final repositoryProvider = Provider<EmployeeRepository>(
  (ref) => demoEnabled ? DemoRepository() : ref.watch(liveRepositoryProvider),
);
final reportsProvider = FutureProvider(
  (ref) => ref.watch(repositoryProvider).reports(),
);
final invitationsProvider = FutureProvider(
  (ref) => ref.watch(repositoryProvider).invitations(),
);
final auditProvider = FutureProvider.family<List<AuditEvent>, Report>(
  (ref, report) => ref.watch(repositoryProvider).audit(report),
);
final sessionProvider = NotifierProvider<Session, bool>(Session.new);

class Session extends Notifier<bool> {
  @override
  bool build() => false;
  void enterDemo() => state = true;
  void enter() => state = true;
  void clear() => state = false;
}

bool get demoEnabled =>
    (const String.fromEnvironment('APP_MODE', defaultValue: '')).isNotEmpty
    ? const String.fromEnvironment('APP_MODE') == 'demo'
    : (dotenv.isInitialized ? dotenv.env['APP_MODE'] ?? 'demo' : 'demo') ==
          'demo';

/// Demo wording keeps the labelled-demo copy (and its tests); live wording describes what really happens.
String modeText(String demo, String live) => demoEnabled ? demo : live;
