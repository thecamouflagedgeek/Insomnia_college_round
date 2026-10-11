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
  // Reflect & Reform (live mode): outcome and reform actions once HR resolves the case.
  String? resolutionOutcome;
  List<String> resolutionActions = const [];
  bool reflectionSubmitted = false;
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
  CommitteeMember('usr_marcus', 'Marcus Vance', 'VP of Engineering Operations'),
  CommitteeMember('usr_david', 'David Kim', 'Associate General Counsel (Labor)'),
  CommitteeMember('usr_priya', 'Priya Sundaram', 'Senior Director of People Relations'),
];

const demoEligibleCommitteePool = [
  CommitteeMember('usr_marcus', 'Marcus Vance', 'VP of Engineering Operations'),
  CommitteeMember('usr_david', 'David Kim', 'Associate General Counsel (Labor)'),
  CommitteeMember('usr_priya', 'Priya Sundaram', 'Senior Director of People Relations'),
  CommitteeMember('usr_maya', 'Dr. Maya Lin', 'Presiding Officer (Internal Committee)'),
  CommitteeMember('usr_tariq', 'Tariq Mansoor', 'Chief Compliance & Integrity Officer'),
  CommitteeMember('usr_kenneth', 'Kenneth Cole', 'Director of Workplace Conflict Resolution'),
  CommitteeMember('usr_sandra', 'Sandra Bullock-Lee', 'Senior Investigator (People Relations)'),
];

class Challenge {
  Challenge(
    this.member,
    this.reason,
    this.explanation, {
    this.status = 'Under challenge — pending review',
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
      id: 'DEMO-892',
      category: 'Abuse of Authority',
      title: 'Repeated Retaliation and Rating Downgrade Post-Safety Disclosure',
      description:
          'Reporting manager systematically stripped project responsibilities, scheduled punitive isolation reviews, and threatened sponsorship following safety audit disclosure.',
      date: DateTime(2026, 10, 9),
      committee: [
        const CommitteeMember('usr_marcus', 'Marcus Vance', 'VP of Engineering Operations'),
        const CommitteeMember('usr_david', 'David Kim', 'Associate General Counsel (Labor)'),
        const CommitteeMember('usr_priya', 'Priya Sundaram', 'Senior Director of People Relations'),
      ],
    )
      ..status = 'Under challenge'
      ..challenges.add(
        Challenge(
          'Marcus Vance',
          'Professional relationship',
          'Direct supervisory hierarchy creates conflict of interest regarding Q3 rating evaluation override.',
          status: 'Under challenge — pending independent review',
        ),
      ),
    Report(
      id: 'DEMO-741',
      category: 'Sexual Harassment',
      title: 'Persistent Inappropriate Advances and Promotion Coercion',
      description:
          'Senior director repeatedly made unsolicited advances during off-site symposium and linked executive sponsorship for upcoming promotion committee.',
      date: DateTime(2026, 10, 5),
      committee: [
        const CommitteeMember('usr_david', 'David Kim', 'Associate General Counsel (Labor)'),
        const CommitteeMember('usr_maya', 'Dr. Maya Lin', 'Presiding Officer (Internal Committee)'),
        const CommitteeMember('usr_priya', 'Priya Sundaram', 'Senior Director of People Relations'),
      ],
    )..status = 'Investigating',
    Report(
      id: 'DEMO-650',
      category: 'Discrimination',
      title: 'Systemic Exclusion in Compensation Bands and Promotion Velocity',
      description:
          'Documentation showing minority engineers systematically clustered in lower compensation tier bands despite equivalent tenure and superior peer reviews.',
      date: DateTime(2026, 10, 2),
      committee: [
        const CommitteeMember('usr_kenneth', 'Kenneth Cole', 'Director of Workplace Conflict Resolution'),
        const CommitteeMember('usr_sandra', 'Sandra Bullock-Lee', 'Senior Investigator (People Relations)'),
        const CommitteeMember('usr_tariq', 'Tariq Mansoor', 'Chief Compliance & Integrity Officer'),
      ],
    )..status = 'Committee assigned',
    Report(
      id: 'DEMO-512',
      category: 'Whistleblowing & Bribery',
      title: 'Vendor Procurement Kickback and Subcontracting Manipulation',
      description:
          'Internal audit logs indicate unapproved vendor contract amendments signed under non-standard terms with associated secondary shell entities.',
      date: DateTime(2026, 9, 28),
      committee: [
        const CommitteeMember('usr_tariq', 'Tariq Mansoor', 'Chief Compliance & Integrity Officer'),
        const CommitteeMember('usr_david', 'David Kim', 'Associate General Counsel (Labor)'),
        const CommitteeMember('usr_priya', 'Priya Sundaram', 'Senior Director of People Relations'),
      ],
    )..status = 'Submitted',
  ];
  final _invitations = [
    Invitation(
      'DEMO-W08',
      'You are invited to voluntarily assist with an authorized workplace investigation. Interviews take place outside this app.',
    ),
    Invitation(
      'DEMO-W09',
      'Voluntary witness corroboration request for incident review INC-741. Participation is anonymous and protected.',
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
