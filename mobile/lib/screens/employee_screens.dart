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
import '../integration/errors.dart';
import '../integration/live_providers.dart';
import '../integration/live_repository.dart';

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

class VerificationScreen extends ConsumerStatefulWidget {
  const VerificationScreen({super.key});
  @override
  ConsumerState<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends ConsumerState<VerificationScreen> {
  final code = TextEditingController();
  bool busy = false;
  bool? enrolled;

  @override
  void initState() {
    super.initState();
    if (!demoEnabled) {
      ref
          .read(reporterZkProvider)
          .isEnrolled()
          .then((v) => mounted ? setState(() => enrolled = v) : null)
          .catchError((_) => null);
    }
  }

  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  void enter() {
    ref.read(sessionProvider.notifier).enter();
    context.go('/biometric');
  }

  Future<void> verify() async {
    if (code.text.trim().isEmpty) return;
    setState(() => busy = true);
    try {
      await ref.read(reporterZkProvider).enroll(code.text.trim());
      if (mounted) enter();
    } catch (e) {
      if (mounted) feedback(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (demoEnabled) {
      return PageShell(
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
    return PageShell(
      title: 'Belong.\nWithout being exposed.',
      children: [
        HintCard(
          chainText(
            'Your phone creates a private key that never leaves it. Only a one-way commitment joins the employee group on Polygon, so reports prove you are an employee without revealing which one.',
            'Your phone creates a private key that never leaves it. Only a one-way commitment joins the employee group. This test backend keeps the group offline and does not check proofs cryptographically.',
          ),
        ),
        if (enrolled == true) ...[
          const SoftCard(
            child: Row(
              children: [
                Icon(Icons.verified_user, color: purple, size: 36),
                SizedBox(width: 16),
                Expanded(
                  child: Text('This phone is already a verified member.'),
                ),
              ],
            ),
          ),
          ActionButton('Continue', enter),
        ] else ...[
          TextField(
            controller: code,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'Invite code from HR',
              hintText: 'One-time code',
            ),
          ),
          const SizedBox(height: 16),
          ActionButton('Verify membership', verify, busy: busy),
          Text(
            chainText(
              'HR knows a code was used, not which reports you file. Verification is recorded on Polygon and can take a few seconds.',
              'HR knows a code was used, not which reports you file. On this test backend nothing is recorded on Polygon.',
            ),
          ),
        ],
      ],
    );
  }
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
                        Text(
                          modeText('${report.status} · Demo', report.status),
                        ),
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
            Text(
              modeText(
                'Status: ${report.status} — demo',
                'Status: ${report.status}',
              ),
            ),
            Text(
              modeText(
                '${report.files.length} evidence selections · not uploaded',
                '${report.files.length} evidence files · uploaded and sealed',
              ),
            ),
          ],
        ),
      ),
      SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.people_alt_outlined, color: purple),
                const SizedBox(width: 8),
                Text(
                  'Assigned Committee',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: report.status == 'Under challenge'
                        ? const Color(0xFFEA580C)
                        : (report.committee.isNotEmpty ? const Color(0xFF6B21A8) : Colors.grey.shade400),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    report.status,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (report.committee.isEmpty)
              const Text(
                'No committee assigned yet. Review board formation pending.',
                style: TextStyle(color: Colors.grey),
              )
            else
              for (final m in report.committee) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6.0),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const CircleAvatar(
                        radius: 14,
                        backgroundColor: Color(0xFFF3E8FF),
                        child: Icon(Icons.person, size: 16, color: purple),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text(m.role, style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
                            if (report.challenges.any((c) => c.member == m.name))
                              Padding(
                                padding: const EdgeInsets.only(top: 4.0),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF7ED),
                                    border: Border.all(color: const Color(0xFFEA580C)),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.access_time, size: 12, color: Color(0xFFEA580C)),
                                      SizedBox(width: 4),
                                      Text(
                                        'Under challenge',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFFEA580C),
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (m != report.committee.last) const Divider(height: 12),
              ],
          ],
        ),
      ),
      HintCard(
        modeText(
          'This case is local demo data. Backend acceptance, authorized actions, and evidence sealing are not available.',
          'Your case token stays on this phone. It is the only way to open this case; there is no account to recover it.',
        ),
      ),
      if (!demoEnabled && report.resolutionOutcome != null)
        _OutcomeCard(report),
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
      if (!demoEnabled && report.evidence.isNotEmpty)
        ActionButton(
          'Your evidence (${report.evidence.length})',
          () => context.push('/case/${report.id}/evidence', extra: report),
        ),
    ],
  );
}

/// Reflect & Reform: the outcome and the organisation's reform actions, then anonymous structured feedback.
class _OutcomeCard extends ConsumerStatefulWidget {
  const _OutcomeCard(this.report);
  final Report report;
  @override
  ConsumerState<_OutcomeCard> createState() => _OutcomeCardState();
}

class _OutcomeCardState extends ConsumerState<_OutcomeCard> {
  double fairness = 3;
  bool feltSafe = true, again = true, busy = false;

  Future<void> send() async {
    setState(() => busy = true);
    try {
      final repo = ref.read(repositoryProvider);
      if (repo is LiveRepository) {
        await repo.reflect(
          widget.report,
          fairness: fairness.round(),
          feltSafe: feltSafe,
          wouldReportAgain: again,
        );
      }
      if (mounted) {
        feedback(
          context,
          'Thank you. Your feedback is anonymous and only counted in totals.',
        );
      }
    } catch (e) {
      if (mounted) feedback(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Outcome: ${r.resolutionOutcome}',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (r.resolutionActions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'What the organisation committed to: ${r.resolutionActions.join(' · ')}',
            ),
          ],
          const SizedBox(height: 16),
          if (r.reflectionSubmitted)
            const Text('You shared feedback on this case. Thank you.')
          else ...[
            const Text(
              'How was this handled? Your answers are anonymous and only shown to HR in totals.',
            ),
            const SizedBox(height: 8),
            Text('Fairness of the process: ${fairness.round()} / 5'),
            Slider(
              value: fairness,
              min: 1,
              max: 5,
              divisions: 4,
              onChanged: (v) => setState(() => fairness = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('I felt safe reporting'),
              value: feltSafe,
              onChanged: (v) => setState(() => feltSafe = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('I would report again'),
              value: again,
              onChanged: (v) => setState(() => again = v),
            ),
            ActionButton('Share feedback', send, busy: busy),
          ],
        ],
      ),
    );
  }
}

class ChallengeScreen extends ConsumerStatefulWidget {
  const ChallengeScreen(this.report, {super.key});
  final Report report;
  @override
  ConsumerState<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends ConsumerState<ChallengeScreen> {
  late String member = widget.report.committee.isEmpty
      ? ''
      : widget.report.committee.first.name;
  String reason = 'Professional relationship';
  final explanation = TextEditingController();
  final form = GlobalKey<FormState>();
  bool busy = false;
  @override
  void dispose() {
    explanation.dispose();
    super.dispose();
  }

  Future<void> _reviewAndSubmit() async {
    if (!form.currentState!.validate()) return;
    if (member.isEmpty) {
      feedback(context, 'Please select a committee member to challenge.');
      return;
    }
    if (widget.report.challenges.any((c) => c.member == member && !c.status.contains('not synced'))) {
      feedback(context, '$member is already under challenge on this case.');
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Review Committee Challenge'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Case: ${widget.report.id}', style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('Challenged Member: $member', style: const TextStyle(color: purple, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('Conflict Category: $reason'),
              const SizedBox(height: 8),
              const Text('Explanation:', style: TextStyle(fontWeight: FontWeight.w600)),
              Text(explanation.text.trim()),
              const SizedBox(height: 12),
              const Text(
                'A challenge requests an independent review; your identity remains anonymous to the named member.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: purple),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm & Submit'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await submit();
    }
  }

  Future<void> submit() async {
    setState(() => busy = true);
    try {
      await ref
          .read(repositoryProvider)
          .challenge(widget.report, member, reason, explanation.text.trim());
      widget.report.status = 'Under challenge';
      ref.invalidate(reportsProvider);
      if (mounted) {
        feedback(
          context,
          modeText(
            'Demo challenge recorded. Independent review remains pending.',
            chainText(
              'Challenge recorded on Polygon. An independent reviewer will decide.',
              'Challenge recorded in the audit log. An independent reviewer will decide.',
            ),
          ),
        );
        explanation.clear();
        setState(() {});
      }
    } catch (e) {
      if (mounted) {
        if (e is SyncWarningException) {
          feedback(context, e.message);
        } else {
          feedback(
            context,
            friendlyError(
              e,
              fallback: 'Challenge could not be submitted. Please try again.',
            ),
          );
        }
        setState(() {});
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final alreadyChallenged = widget.report.challenges.any((c) => c.member == member && !c.status.contains('not synced'));
    return PageShell(
      title: 'Fairness deserves\na second look.',
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 6,
          children: [
            Text(widget.report.id, style: const TextStyle(fontWeight: FontWeight.bold, color: purple)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: widget.report.status == 'Under challenge' ? const Color(0xFFEA580C) : const Color(0xFF6B21A8),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                widget.report.status,
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(widget.report.title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 16),
        HintCard(
          modeText(
            'A challenge is anonymous and requests an independent ombudsperson review. If upheld, the member is replaced and loses access.',
            'A challenge is anonymous and goes to an independent reviewer, not to the member you name. If it is upheld, the member is replaced and loses access to your case.',
          ),
        ),
        Form(
          key: form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SoftCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Who concerns you?',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    if (widget.report.committee.isEmpty)
                      const Text('No committee members assigned to this case yet.')
                    else
                      for (final m in widget.report.committee)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(m.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(m.role),
                          leading: Icon(
                            member == m.name
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            color: purple,
                          ),
                          trailing: widget.report.challenges.any((c) => c.member == m.name)
                              ? Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF7ED),
                                    border: Border.all(color: const Color(0xFFEA580C)),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text(
                                    'Challenged',
                                    style: TextStyle(color: Color(0xFFEA580C), fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                )
                              : null,
                          onTap: () => setState(() => member = m.name),
                        ),
                  ],
                ),
              ),
              if (alreadyChallenged)
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    border: Border.all(color: const Color(0xFFEA580C)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: Color(0xFFEA580C)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '$member has already been challenged on this case. Independent review is pending.',
                          style: const TextStyle(color: Color(0xFF9A3412), fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: reason,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Potential conflict category',
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
                onChanged: alreadyChallenged ? null : (v) => setState(() => reason = v!),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: explanation,
                enabled: !alreadyChallenged,
                minLines: 4,
                maxLines: 8,
                decoration: const InputDecoration(
                  labelText: 'Explain your concern (minimum 15 characters)',
                  hintText: 'Detail why this member cannot remain neutral on this case...',
                ),
                validator: (v) => (v?.trim().length ?? 0) < 15
                    ? 'Please give at least 15 characters of context.'
                    : null,
              ),
              const SizedBox(height: 20),
              ActionButton(
                alreadyChallenged ? 'Already Challenged' : modeText('Review & Submit Challenge', 'Review & Submit Challenge'),
                alreadyChallenged ? () {} : _reviewAndSubmit,
                busy: busy,
              ),
            ],
          ),
        ),
        if (widget.report.challenges.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(
            'Submitted Challenges',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          for (final challenge in widget.report.challenges)
            SoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.shield_outlined, color: Color(0xFFEA580C), size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(challenge.member, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEA580C),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'Under challenge',
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Conflict Reason: ${challenge.reason}', style: const TextStyle(fontWeight: FontWeight.w500)),
                  if (challenge.explanation.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(challenge.explanation, style: TextStyle(fontSize: 13, color: Colors.grey.shade800)),
                  ],
                  const SizedBox(height: 8),
                  const Text(
                    'Independent review outcome: Pending adjudication by Ombudsperson.',
                    style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }
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
      if (!demoEnabled) const _WitnessCodeEntry(),
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

/// An investigator hands a witness a one-time code out of band; entering it here lists their invitations.
class _WitnessCodeEntry extends ConsumerStatefulWidget {
  const _WitnessCodeEntry();
  @override
  ConsumerState<_WitnessCodeEntry> createState() => _WitnessCodeEntryState();
}

class _WitnessCodeEntryState extends ConsumerState<_WitnessCodeEntry> {
  final code = TextEditingController();
  @override
  void dispose() {
    code.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (code.text.trim().isEmpty) return;
    await ref.read(caseVaultProvider).setWitnessCode(code.text.trim());
    code.clear();
    ref.invalidate(invitationsProvider);
    if (mounted) feedback(context, 'Witness code saved on this phone.');
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      TextField(
        controller: code,
        autocorrect: false,
        decoration: const InputDecoration(
          labelText: 'Witness code',
          hintText: 'Given to you by the investigator',
        ),
      ),
      const SizedBox(height: 12),
      ActionButton('Show my invitations', save),
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
    } catch (e) {
      if (mounted) {
        if (e is SyncWarningException) {
          feedback(context, e.message);
        } else {
          feedback(
            context,
            friendlyError(
              e,
              fallback:
                  'Message could not be sent. Your draft remains available.',
            ),
          );
        }
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
      HintCard(
        modeText(
          'Demo conversation. Messages stay in memory and are not sent to an investigator. No end-to-end encryption claim.',
          'The investigation team sees "Anonymous Reporter", never your identity. Each message is sealed into the Silent Audit.',
        ),
      ),
      if (!demoEnabled)
        ActionButton('Check for replies', () async {
          final repo = ref.read(repositoryProvider);
          try {
            if (repo is LiveRepository) await repo.refresh(widget.report);
            if (mounted) setState(() {});
          } catch (e) {
            if (context.mounted) feedback(context, friendlyError(e));
          }
        }),
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
      ActionButton(modeText('Send demo reply', 'Send reply'), send, busy: busy),
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
    } catch (e) {
      if (mounted) {
        feedback(
          context,
          friendlyError(
            e,
            fallback: 'Response could not be recorded. Please retry.',
          ),
        );
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
          modeText('Accept demo invitation', 'Accept invitation'),
          () => respond(modeText('Accepted — demo', 'accept')),
          busy: busy,
        ),
        ActionButton(
          modeText('Decline demo invitation', 'Decline invitation'),
          () => respond(modeText('Declined — demo', 'decline')),
          busy: busy,
        ),
      ] else
        HintCard(
          modeText(
            'Response recorded locally: ${widget.invitation.response}',
            'Response recorded: ${widget.invitation.response}. Thank you.',
          ),
        ),
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
      HintCard(
        modeText(
          'Demo timeline. Integrity does not establish truth. Anchoring can make changes detectable; it cannot prevent all suppression.',
          chainText(
            'Every step is sealed and anchored on Polygon, so any later edit is detectable. Integrity does not establish truth.',
            'Every step is sealed and hash-chained; this test backend anchors to an offline chain, not Polygon. Integrity does not establish truth.',
          ),
        ),
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
                                modeText(
                                  'Demo receipt identifier copied.',
                                  'Receipt copied.',
                                ),
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
      HintCard(
        modeText(
          'Notifications and anonymous credential recovery are integration pending. No personal profile or analytics is collected by this demo.',
          'Clearing forgets your case tokens on this phone; those cases cannot be reopened here. Your membership stays, so you can still report.',
        ),
      ),
      ActionButton(
        modeText('Clear local demo session', 'Forget my cases on this phone'),
        () async {
          await const FlutterSecureStorage().delete(key: 'biometric_enabled');
          if (!demoEnabled) await ref.read(caseVaultProvider).clear();
          ref.invalidate(repositoryProvider);
          ref.invalidate(reportsProvider);
          ref.invalidate(invitationsProvider);
          ref.read(sessionProvider.notifier).clear();
          if (context.mounted) context.go('/');
        },
      ),
    ],
  );
}
