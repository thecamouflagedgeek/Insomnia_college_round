import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:intl/intl.dart';
import 'package:flutter/services.dart';

import '../data/repository.dart';
import '../widgets/components.dart';
import '../core/theme.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});
  @override
  Widget build(BuildContext context) => PageShell(
    title: 'A safer way\nto speak up.',
    back: false,
    children: [
      const SizedBox(height: 28),
      Center(
        child: Container(
          width: 190,
          height: 190,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFFDCC7FA), Color(0xFFF3E0F1)],
            ),
            boxShadow: [
              BoxShadow(color: purple.withValues(alpha: .1), blurRadius: 55),
            ],
          ),
          child: const Icon(
            Icons.shield_outlined,
            size: 82,
            color: Colors.white,
          ),
        ),
      ),
      const SizedBox(height: 44),
      Text(
        'Your voice matters.\nYour privacy matters more.',
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 18),
      const Text(
        'A thoughtful space to raise concerns, stay informed, and ask for a fair investigation.',
      ),
      const SizedBox(height: 32),
      ActionButton('Get started', () => context.go('/verify')),
      const Text(
        'Your identity stays protected.\nYour complaint stays accountable.',
      ),
    ],
  );
}

class VerificationScreen extends ConsumerWidget {
  const VerificationScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageShell(
    title: 'Belong.\nWithout being exposed.',
    children: [
      const HintCard(
        'Anonymous membership verification is integration pending. An organization login is not an anonymous membership proof.',
      ),
      const SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.verified_user_outlined, color: purple, size: 36),
            SizedBox(height: 18),
            Text('Waiting for the verification contract'),
            SizedBox(height: 8),
            Text(
              'The backend and ZKP teams must provide the enrollment mechanism, credential format, expiry, and authorization rules.',
            ),
          ],
        ),
      ),
      if (demoEnabled)
        ActionButton('Explore the labelled demo', () {
          ref.read(sessionProvider.notifier).enterDemo();
          context.go('/biometric');
        }),
      const Text(
        'Demo mode does not verify membership or create an anonymous credential.',
      ),
    ],
  );
}

class BiometricScreen extends StatefulWidget {
  const BiometricScreen({super.key});
  @override
  State<BiometricScreen> createState() => _BiometricScreenState();
}

class _BiometricScreenState extends State<BiometricScreen> {
  bool busy = false;
  Future<void> enable() async {
    setState(() => busy = true);
    try {
      final auth = LocalAuthentication();
      if (!await auth.canCheckBiometrics || !await auth.isDeviceSupported()) {
        if (mounted) {
          feedback(
            context,
            'Biometrics are unavailable. You can continue without them.',
          );
        }
        return;
      }
      if (await auth.authenticate(
        localizedReason: 'Protect local access to INCOGNITO',
        options: const AuthenticationOptions(biometricOnly: true),
      )) {
        await const FlutterSecureStorage().write(
          key: 'biometric_enabled',
          value: 'true',
        );
        if (mounted) context.go('/home');
      }
    } catch (_) {
      if (mounted) {
        feedback(
          context,
          'Device authentication is unavailable. Try again or skip.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PageShell(
    title: 'A little extra\npeace of mind.',
    children: [
      const SoftCard(
        child: Column(
          children: [
            Icon(Icons.fingerprint, size: 80, color: purple),
            SizedBox(height: 24),
            Text('Optional biometric unlock'),
            SizedBox(height: 12),
            Text(
              'Protect access on this device. Your biometric data stays with your device; it is not a membership proof.',
            ),
          ],
        ),
      ),
      ActionButton('Enable biometric unlock', enable, busy: busy),
      ActionButton('Continue without biometrics', () => context.go('/home')),
    ],
  );
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context) => PageShell(
    title: 'Your voice.\nYour space.',
    tab: 0,
    back: false,
    children: [
      const Text('Hello there. Speak freely. Stay informed.'),
      const SizedBox(height: 28),
      SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.edit_note_rounded, size: 36, color: purple),
            const SizedBox(height: 20),
            Text(
              'Space to understand',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text('Your concerns deserve to be heard.'),
            const SizedBox(height: 24),
            ActionButton('Tell Your Story', () => context.push('/story')),
            const Text('Understand privately before deciding to report.'),
            const SizedBox(height: 12),
            ActionButton('Create report', () => context.push('/create')),
          ],
        ),
      ),
      LayoutBuilder(
        builder: (context, constraints) => Wrap(
          spacing: 16,
          children: [
            for (final action in [
              (Icons.folder_outlined, 'My reports', '/reports'),
              (Icons.chat_bubble_outline, 'Investigation inbox', '/inbox'),
              (
                Icons.people_outline,
                'Committee challenge',
                '/reports?purpose=challenge',
              ),
              (Icons.history_rounded, 'Silent audit', '/reports?purpose=audit'),
            ])
              SizedBox(
                width: constraints.maxWidth < 290
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 16) / 2,
                child: SoftCard(
                  onTap: () => context.push(action.$3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFFF2ECFB),
                        ),
                        child: Icon(action.$1, color: purple),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        action.$2,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
      const Text('A fair process starts with being heard.'),
    ],
  );
}

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key, this.purpose});
  final String? purpose;
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageShell(
    title: purpose == 'challenge'
        ? 'Choose a case\nto challenge.'
        : purpose == 'audit'
        ? 'Follow the record.'
        : 'Your reports.',
    tab: 1,
    children: [
      ActionButton('Create a report', () => context.push('/create')),
      ref
          .watch(reportsProvider)
          .when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, s) => ActionButton(
              'Could not load reports · Retry',
              () => ref.invalidate(reportsProvider),
            ),
            data: (reports) => Column(
              children: [
                if (reports.isEmpty)
                  const HintCard(
                    'No reports yet. You can start whenever you are ready.',
                  ),
                for (final report in reports)
                  SoftCard(
                    onTap: () => context.push(
                      '/case/${report.id}${purpose == null ? '' : '/$purpose'}',
                      extra: report,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          report.id,
                          style: const TextStyle(
                            color: purple,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          report.category,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 12),
                        Text('${report.status} · Demo'),
                        Text(
                          '${report.dateIsIncident ? 'Incident' : 'Submitted'}: ${DateFormat.yMMMd().format(report.date)}',
                        ),
                        const SizedBox(height: 12),
                        const Row(
                          children: [
                            Text('View case'),
                            Spacer(),
                            Icon(Icons.arrow_forward_rounded, color: purple),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
    ],
  );
}

class DetailsScreen extends StatelessWidget {
  const DetailsScreen(this.report, {super.key});
  final Report report;
  @override
  Widget build(BuildContext context) => PageShell(
    title: 'A voice,\nwith a reference.',
    children: [
      SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(report.id, style: const TextStyle(color: purple)),
            const SizedBox(height: 12),
            Text(report.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Text(report.category),
            Text(report.description),
            const SizedBox(height: 16),
            Text(
              '${report.dateIsIncident ? 'Incident date' : 'Submission date'}: ${DateFormat.yMMMd().format(report.date)}',
            ),
            Text('Status: ${report.status} — demo'),
            Text('${report.files.length} evidence selections · not uploaded'),
          ],
        ),
      ),
      const HintCard(
        'This case is local demo data. Backend acceptance, authorized actions, and evidence sealing are not available.',
      ),
      ActionButton(
        'Investigation inbox',
        () => context.push('/case/${report.id}/chat', extra: report),
      ),
      ActionButton(
        'Challenge committee',
        () => context.push('/case/${report.id}/challenge', extra: report),
      ),
      ActionButton(
        'View Silent Audit',
        () => context.push('/case/${report.id}/audit', extra: report),
      ),
    ],
  );
}

class ChallengeScreen extends ConsumerStatefulWidget {
  const ChallengeScreen(this.report, {super.key});
  final Report report;
  @override
  ConsumerState<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends ConsumerState<ChallengeScreen> {
  String member = 'Committee member A', reason = 'Professional relationship';
  final explanation = TextEditingController();
  final form = GlobalKey<FormState>();
  bool busy = false;
  @override
  void dispose() {
    explanation.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      await ref
          .read(repositoryProvider)
          .challenge(widget.report, member, reason, explanation.text.trim());
      if (mounted) {
        feedback(
          context,
          'Demo challenge recorded. Independent review remains pending.',
        );
        setState(() {});
      }
    } catch (_) {
      if (mounted) {
        feedback(
          context,
          'Challenge could not be submitted. Please try again.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PageShell(
    title: 'Fairness deserves\na second look.',
    children: [
      Text(widget.report.id),
      const SizedBox(height: 20),
      const HintCard(
        'Fictional committee assignment. A challenge requests an independent review; it does not reassign a member.',
      ),
      Form(
        key: form,
        child: Column(
          children: [
            SoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Who concerns you?',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  for (final name in [
                    'Committee member A',
                    'Committee member B',
                    'Committee member C',
                  ])
                    ListTile(
                      title: Text(name),
                      leading: Icon(
                        member == name
                            ? Icons.radio_button_checked
                            : Icons.radio_button_off,
                        color: purple,
                      ),
                      onTap: () => setState(() => member = name),
                    ),
                ],
              ),
            ),
            DropdownButtonFormField<String>(
              initialValue: reason,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Potential conflict',
              ),
              items: [
                for (final r in [
                  'Professional relationship',
                  'Personal relationship',
                  'Prior involvement',
                  'Other',
                ])
                  DropdownMenuItem(value: r, child: Text(r)),
              ],
              onChanged: (v) => setState(() => reason = v!),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: explanation,
              minLines: 4,
              maxLines: 8,
              decoration: const InputDecoration(
                labelText: 'Explain your concern',
              ),
              validator: (v) => (v?.trim().length ?? 0) < 15
                  ? 'Please give at least 15 characters of context.'
                  : null,
            ),
            const SizedBox(height: 20),
            ActionButton('Submit demo challenge', submit, busy: busy),
          ],
        ),
      ),
      for (final challenge in widget.report.challenges)
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(challenge.member),
              Text(challenge.reason),
              Text(challenge.status, style: const TextStyle(color: purple)),
              const Text(
                'Independent outcome: pending. No reassignment received.',
              ),
            ],
          ),
        ),
    ],
  );
}

class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageShell(
    title: 'A conversation.\nA way forward.',
    tab: 2,
    children: [
      ActionButton('Refresh inbox', () {
        ref.invalidate(reportsProvider);
        ref.invalidate(invitationsProvider);
      }),
      Text('Investigations', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 16),
      ref
          .watch(reportsProvider)
          .when(
            loading: () => const CircularProgressIndicator(),
            error: (e, s) =>
                const HintCard('Inbox unavailable. Refresh to retry.'),
            data: (reports) => Column(
              children: [
                for (final r in reports)
                  SoftCard(
                    onTap: () => context.push('/case/${r.id}/chat', extra: r),
                    child: Row(
                      children: [
                        const Icon(Icons.chat_bubble_outline, color: purple),
                        const SizedBox(width: 16),
                        Expanded(child: Text('${r.id}\nInvestigation channel')),
                        const Icon(Icons.chevron_right),
                      ],
                    ),
                  ),
              ],
            ),
          ),
      Text(
        'Witness invitations',
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 16),
      ref
          .watch(invitationsProvider)
          .when(
            loading: () => const CircularProgressIndicator(),
            error: (e, s) =>
                const HintCard('Invitations unavailable. Refresh to retry.'),
            data: (invitations) => Column(
              children: [
                for (final invite in invitations)
                  SoftCard(
                    onTap: () => context.push('/witness', extra: invite),
                    child: Text(
                      '${invite.id}\n${invite.response ?? 'Participation is your choice'}',
                    ),
                  ),
              ],
            ),
          ),
    ],
  );
}

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen(this.report, {super.key});
  final Report report;
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final text = TextEditingController();
  bool busy = false;
  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  Future<void> send() async {
    if (text.text.trim().isEmpty) return;
    setState(() => busy = true);
    try {
      await ref.read(repositoryProvider).send(widget.report, text.text.trim());
      text.clear();
    } catch (_) {
      if (mounted) {
        feedback(
          context,
          'Message could not be sent. Your draft remains available.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PageShell(
    title: 'Room to be heard.',
    children: [
      Text(widget.report.id),
      const SizedBox(height: 16),
      const HintCard(
        'Demo conversation. Messages stay in memory and are not sent to an investigator. No end-to-end encryption claim.',
      ),
      for (final note in widget.report.messages)
        Align(
          alignment: note.sender == 'You'
              ? Alignment.centerRight
              : Alignment.centerLeft,
          child: Container(
            constraints: const BoxConstraints(maxWidth: 320),
            margin: const EdgeInsets.only(bottom: 18),
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: note.sender == 'You'
                  ? const Color(0xFFE8DDFB)
                  : Colors.white,
              borderRadius: BorderRadius.circular(26),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  note.sender,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: purple,
                  ),
                ),
                const SizedBox(height: 8),
                Text(note.text),
                const SizedBox(height: 8),
                Text(
                  DateFormat.jm().format(note.date),
                  style: const TextStyle(fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      TextField(
        controller: text,
        minLines: 1,
        maxLines: 5,
        maxLength: 4000,
        decoration: const InputDecoration(
          labelText: 'Your reply',
          hintText: 'Share only what is needed',
        ),
      ),
      ActionButton('Send demo reply', send, busy: busy),
    ],
  );
}

class WitnessScreen extends ConsumerStatefulWidget {
  const WitnessScreen(this.invitation, {super.key});
  final Invitation invitation;
  @override
  ConsumerState<WitnessScreen> createState() => _WitnessScreenState();
}

class _WitnessScreenState extends ConsumerState<WitnessScreen> {
  bool busy = false;
  Future<void> respond(String value) async {
    setState(() => busy = true);
    try {
      await ref.read(repositoryProvider).respond(widget.invitation, value);
      ref.invalidate(invitationsProvider);
    } catch (_) {
      if (mounted) {
        feedback(context, 'Response could not be recorded. Please retry.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PageShell(
    title: 'Your choice\nto take part.',
    children: [
      SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.people_outline, color: purple, size: 40),
            const SizedBox(height: 20),
            Text(widget.invitation.id),
            const SizedBox(height: 12),
            Text(widget.invitation.context),
          ],
        ),
      ),
      const HintCard(
        'Participation is voluntary. Please keep case information confidential. No statements or interviews are collected in this app.',
      ),
      if (widget.invitation.response == null) ...[
        ActionButton(
          'Accept demo invitation',
          () => respond('Accepted — demo'),
          busy: busy,
        ),
        ActionButton(
          'Decline demo invitation',
          () => respond('Declined — demo'),
          busy: busy,
        ),
      ] else
        HintCard('Response recorded locally: ${widget.invitation.response}'),
    ],
  );
}

class AuditScreen extends ConsumerWidget {
  const AuditScreen(this.report, {super.key});
  final Report report;
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageShell(
    title: 'A record you\ncan follow.',
    children: [
      Text(report.id),
      const SizedBox(height: 16),
      const HintCard(
        'Demo timeline. Integrity does not establish truth. Anchoring can make changes detectable; it cannot prevent all suppression.',
      ),
      ActionButton(
        'Refresh timeline',
        () => ref.invalidate(auditProvider(report)),
      ),
      ref
          .watch(auditProvider(report))
          .when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, s) =>
                const HintCard('Audit unavailable. Refresh to retry.'),
            data: (events) => Column(
              children: [
                for (final event in events)
                  SoftCard(
                    child: ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      leading: Icon(
                        event.state.contains('failed')
                            ? Icons.error_outline
                            : Icons.radio_button_checked,
                        color: event.state.contains('failed')
                            ? Colors.deepOrange
                            : purple,
                      ),
                      title: Text(event.title),
                      subtitle: Text(event.state),
                      children: [
                        Text(event.detail),
                        const SizedBox(height: 12),
                        Text('Receipt: ${event.receipt}'),
                        TextButton.icon(
                          onPressed: () async {
                            await Clipboard.setData(
                              ClipboardData(text: event.receipt),
                            );
                            if (context.mounted) {
                              feedback(
                                context,
                                'Demo receipt identifier copied.',
                              );
                            }
                          },
                          icon: const Icon(Icons.copy_outlined),
                          label: const Text('Copy receipt'),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
    ],
  );
}

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageShell(
    title: 'Privacy,\nwith perspective.',
    tab: 3,
    children: [
      const HintCard(
        'Report details, evidence metadata, network information, and small-group context may identify someone. Absolute anonymity or protection from retaliation cannot be guaranteed.',
      ),
      const SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'About INCOGNITO',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            SizedBox(height: 12),
            Text(
              'Verified anonymity. Fair investigation. Institutional accountability.',
            ),
            SizedBox(height: 12),
            Text(
              'Formal legal proceedings may require identity disclosure. Device biometrics protect local access only.',
            ),
          ],
        ),
      ),
      ActionButton('Set up biometric unlock', () => context.push('/biometric')),
      ActionButton('Disable biometric unlock', () async {
        await const FlutterSecureStorage().delete(key: 'biometric_enabled');
        if (context.mounted) feedback(context, 'Biometric preference removed.');
      }),
      const HintCard(
        'Notifications and anonymous credential recovery are integration pending. No personal profile or analytics is collected by this demo.',
      ),
      ActionButton('Clear local demo session', () async {
        await const FlutterSecureStorage().delete(key: 'biometric_enabled');
        ref.invalidate(repositoryProvider);
        ref.invalidate(reportsProvider);
        ref.invalidate(invitationsProvider);
        ref.read(sessionProvider.notifier).clear();
        if (context.mounted) context.go('/');
      }),
    ],
  );
}

