import '../features/story/story_state.dart';
import '../integration/live_providers.dart';

import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'dart:convert';

class Report {
  Report({
    required this.id,
    required this.category,
    required this.title,
    required this.description,
    required this.date,
    this.files = const [],
    this.evidence = const [],
    this.suggestedCategories = const [],
    this.dateIsIncident = true,
    List<CommitteeMember>? committee,
  }) : committee = committee ?? List.of(demoCommittee);
  final String id, category, title, description;
  final DateTime date;
  final List<String> files;
  /// Uploaded evidence as the backend stores it (live mode only; demo selections are never uploaded).
  final List<EvidenceRef> evidence;
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

class EvidenceRef {
  const EvidenceRef(this.id, this.name, this.mime, this.size, this.sha256);
  final String id, name, mime, sha256;
  final int size;
  bool get isImage => mime == 'image/jpeg' || mime == 'image/png' || mime == 'image/webp' || mime == 'image/gif';
  bool get isText => mime.startsWith('text/');
  /// The backend removes identifying metadata from these types before storing them.
  bool get metadataRemoved => mime == 'image/jpeg' || mime == 'image/png' || mime == 'image/webp';
}

class CommitteeMember {
  const CommitteeMember(this.id, this.name, this.role);
  final String id, name, role;
}

class DemoUser {
  const DemoUser({
    required this.id,
    required this.name,
    required this.role,
    required this.title,
    required this.department,
    this.email = '',
  });
  final String id, name, role, title, department, email;
}

const demoUsers = [
  DemoUser(
    id: 'emp_jordan',
    name: 'Jordan Taylor',
    role: 'employee_reporter',
    title: 'Senior Systems Architect',
    department: 'Core Infrastructure',
    email: 'j.taylor@incognito.org',
  ),
  DemoUser(
    id: 'emp_ananya',
    name: 'Ananya Sharma',
    role: 'employee_reporter',
    title: 'Staff Product Manager',
    department: 'Product Growth',
    email: 'a.sharma@incognito.org',
  ),
  DemoUser(
    id: 'usr_marcus',
    name: 'Marcus Vance',
    role: 'committee_member',
    title: 'VP of Engineering Operations',
    department: 'Engineering Operations',
    email: 'm.vance@incognito.org',
  ),
  DemoUser(
    id: 'usr_david',
    name: 'David Kim',
    role: 'committee_member',
    title: 'Associate General Counsel (Labor)',
    department: 'Legal Counsel',
    email: 'd.kim@incognito.org',
  ),
  DemoUser(
    id: 'usr_priya',
    name: 'Priya Sundaram',
    role: 'committee_member',
    title: 'Senior Director of People Relations',
    department: 'People Relations',
    email: 'p.sundaram@incognito.org',
  ),
  DemoUser(
    id: 'usr_maya',
    name: 'Dr. Maya Lin',
    role: 'committee_member',
    title: 'Presiding Officer (Internal Committee)',
    department: 'People Operations',
    email: 'm.lin@incognito.org',
  ),
  DemoUser(
    id: 'usr_tariq',
    name: 'Tariq Mansoor',
    role: 'committee_member',
    title: 'Chief Compliance & Integrity Officer',
    department: 'Ethics & Compliance',
    email: 't.mansoor@incognito.org',
  ),
  DemoUser(
    id: 'usr_kenneth',
    name: 'Kenneth Cole',
    role: 'committee_member',
    title: 'Director of Workplace Conflict Resolution',
    department: 'People & Culture',
    email: 'k.cole@incognito.org',
  ),
  DemoUser(
    id: 'usr_sandra',
    name: 'Sandra Bullock-Lee',
    role: 'committee_member',
    title: 'Senior Investigator (People Relations)',
    department: 'Ethics Unit',
    email: 's.lee@incognito.org',
  ),
  DemoUser(
    id: 'usr_rachel',
    name: 'Rachel Adams',
    role: 'committee_member',
    title: 'Global Head of Diversity & Inclusion',
    department: 'D&I Directorate',
    email: 'r.adams@incognito.org',
  ),
  DemoUser(
    id: 'usr_carlos',
    name: 'Carlos Mendoza',
    role: 'committee_member',
    title: 'Lead Compensation & Equity Analyst',
    department: 'Total Rewards',
    email: 'c.mendoza@incognito.org',
  ),
  DemoUser(
    id: 'usr_aris',
    name: 'Dr. Aris Thorne',
    role: 'independent_reviewer',
    title: 'Independent Ombudsperson & Challenge Adjudicator',
    department: 'External Oversight Panel',
    email: 'a.thorne@ombuds-independent.org',
  ),
  DemoUser(
    id: 'usr_elena',
    name: 'Elena Rostova',
    role: 'assigned_investigator',
    title: 'Lead Workplace Misconduct Investigator',
    department: 'Independent Ethics Unit',
    email: 'e.rostova@incognito.org',
  ),
  DemoUser(
    id: 'usr_sarah',
    name: 'Sarah Jenkins',
    role: 'hr_reviewer',
    title: 'Senior HR Operations & Compliance Lead',
    department: 'People & Culture',
    email: 's.jenkins@incognito.org',
  ),
];

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
  CommitteeMember('usr_rachel', 'Rachel Adams', 'Global Head of Diversity & Inclusion'),
  CommitteeMember('usr_carlos', 'Carlos Mendoza', 'Lead Compensation & Equity Analyst'),
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
  /// The stored copy of one of this case's evidence files (what staff see).
  Future<Uint8List> evidenceFile(Report report, EvidenceRef item);
}

class SyncWarningException implements Exception {
  const SyncWarningException(this.message);
  final String message;
  @override
  String toString() => message;
}

class DemoRepository implements EmployeeRepository, StoryReportRepository {
  DemoRepository() {
    const envBase = String.fromEnvironment('API_BASE_URL', defaultValue: '');
    final base = envBase.isNotEmpty
        ? envBase
        : ((dotenv.isInitialized ? dotenv.env['API_BASE_URL'] : null) ?? 'http://10.0.2.2:8000');
    _api = ApiService(base);
  }
  late final ApiService _api;

  final _reports = <Report>[
    Report(
      id: 'INC-892',
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
      id: 'INC-741',
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
      id: 'INC-650',
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
      id: 'INC-512',
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
      id: 'INC-${1042 + _reports.length}',
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
      id: 'INC-${1042 + _reports.length}',
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

    final token = 'tok_${report.id.toLowerCase().replaceAll('-', '')}_demo';
    _api.setCredential(token);
    final memberId = report.committee.firstWhere(
      (m) => m.name == member || m.id == member,
      orElse: () => CommitteeMember(member, member, ''),
    ).id;

    bool synced = false;
    String? syncError;
    try {
      final res = await _api.client.post(
        '/reports/${Uri.encodeComponent(report.id)}/challenge',
        data: {
          'payload': jsonEncode({
            'member_id': memberId,
            'reason': reason,
            'explanation': explanation,
            'client_nonce': 'nonce_mobile_sync',
          }),
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        synced = true;
      } else {
        syncError = 'HTTP ${res.statusCode}';
      }
    } catch (e) {
      syncError = e.toString();
    }

    // Upsert local challenge to avoid duplicate entries when retrying
    final existingIdx = report.challenges.indexWhere((c) => c.member == member);
    final ch = Challenge(
      member,
      reason,
      explanation,
      status: synced
          ? 'Under challenge — pending review'
          : 'Local demo only — backend not synced',
    );
    if (existingIdx >= 0) {
      report.challenges[existingIdx] = ch;
    } else {
      report.challenges.add(ch);
    }
    report.status = 'Under challenge';

    if (!synced) {
      throw SyncWarningException(
        'Saved to local demo session, but backend synchronization failed ($syncError). Not synced to web dashboard.',
      );
    }
  }

  @override
  Future<void> send(Report report, String text) async {
    await _delay();
    final token = 'tok_${report.id.toLowerCase().replaceAll('-', '')}_demo';
    _api.setCredential(token);

    bool synced = false;
    String? syncError;
    try {
      final res = await _api.client.post(
        '/reports/${Uri.encodeComponent(report.id)}/messages',
        data: {'text': text},
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        synced = true;
      } else {
        syncError = 'HTTP ${res.statusCode}';
      }
    } catch (e) {
      syncError = e.toString();
    }

    report.messages.add(Note(synced ? 'You' : 'You (offline — not synced)', text));

    if (!synced) {
      throw SyncWarningException(
        'Saved to local demo session, but backend synchronization failed ($syncError). Not synced to web dashboard.',
      );
    }
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
  Future<Uint8List> evidenceFile(Report report, EvidenceRef item) async =>
      throw StateError('Demo evidence selections are never uploaded.');

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
final evidenceFileProvider = FutureProvider.autoDispose.family<Uint8List, (Report, EvidenceRef)>(
  (ref, arg) => ref.watch(repositoryProvider).evidenceFile(arg.$1, arg.$2),
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

/// Builds made with ZK_PROVER=offline talk to the offline backend (CHAIN_MODE=offline): nothing reaches Polygon and
/// proofs are not checked cryptographically, so live wording must not claim either.
const bool offlineChain = String.fromEnvironment('ZK_PROVER', defaultValue: 'webview') == 'offline';

/// Live wording for a real Polygon backend vs the offline test backend.
String chainText(String polygon, String offline) => offlineChain ? offline : polygon;

/// Demo wording keeps the labelled-demo copy (and its tests); live wording describes what really happens.
String modeText(String demo, String live) => demoEnabled ? demo : live;
