import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../data/repository.dart';
import '../widgets/components.dart';
import '../core/theme.dart';
import '../integration/errors.dart';

class EvidenceSelection {
  EvidenceSelection(this.name, this.size, this.path, this.image);
  final String name;
  final int size;
  final String? path;
  final bool image;
}

class CreateReportScreen extends ConsumerStatefulWidget {
  const CreateReportScreen({super.key});
  @override
  ConsumerState<CreateReportScreen> createState() => _CreateReportScreenState();
}

class _CreateReportScreenState extends ConsumerState<CreateReportScreen> {
  int step = 0;
  String? category;
  DateTime date = DateTime.now();
  bool busy = false;
  final title = TextEditingController(), description = TextEditingController();
  final form = GlobalKey<FormState>();
  final files = <EvidenceSelection>[];
  @override
  void dispose() {
    title.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> pick(bool image) async {
    try {
      if (image) {
        final selected = await ImagePicker().pickImage(
          source: ImageSource.gallery,
        );
        if (selected != null) {
          final size = await selected.length();
          add(EvidenceSelection(selected.name, size, selected.path, true));
        }
      } else {
        final selected = await FilePicker.platform.pickFiles(
          type: FileType.custom,
          allowedExtensions: ['pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg'],
          withData: false,
        );
        if (selected != null) {
          final file = selected.files.single;
          add(
            EvidenceSelection(
              file.name,
              file.size,
              file.path,
              ['png', 'jpg', 'jpeg'].contains(file.extension?.toLowerCase()),
            ),
          );
        }
      }
    } catch (_) {
      if (mounted) {
        feedback(context, 'File selection unavailable. Please try again.');
      }
    }
  }

  void add(EvidenceSelection file) {
    if (!mounted) return;
    if (file.size > 20 * 1024 * 1024) {
      feedback(context, 'Please select a file smaller than 20 MB.');
      return;
    }
    if (files.length >= 5) {
      feedback(context, 'Select up to five files for this demo.');
      return;
    }
    setState(() => files.add(file));
  }

  Future<void> submit() async {
    setState(() => busy = true);
    try {
      final report = await ref
          .read(repositoryProvider)
          .submit(
            category!,
            title.text.trim(),
            description.text.trim(),
            date,
            files
                .map((f) => demoEnabled ? f.name : (f.path ?? f.name))
                .toList(),
          );
      ref.invalidate(reportsProvider);
      if (mounted) context.pushReplacement('/success', extra: report);
    } catch (e) {
      if (mounted) {
        feedback(
          context,
          friendlyError(
            e,
            fallback: 'Submission failed. Your draft remains here.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PageShell(
    title: [
      'What happened?',
      'In your own words.',
      'Supporting context.',
      'Take a moment\nto review.',
    ][step],
    children: [
      Text(
        'STEP ${step + 1} OF 4',
        style: const TextStyle(color: purple, letterSpacing: 2, fontSize: 11),
      ),
      const SizedBox(height: 12),
      ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: LinearProgressIndicator(
          value: (step + 1) / 4,
          minHeight: 6,
          backgroundColor: const Color(0xFFE8DDFB),
        ),
      ),
      const SizedBox(height: 24),
      if (step == 0) ...[
        const Text(
          'Choose the category that feels closest. This is your selection, not an automated finding.',
        ),
        const SizedBox(height: 20),
        for (final c in [
          'Harassment',
          'Bullying',
          'Discrimination',
          'Bribery',
          'Whistleblowing',
          'Abuse of Authority',
          'Other',
        ])
          SoftCard(
            onTap: () => setState(() => category = c),
            child: Row(
              children: [
                Expanded(child: Text(c)),
                Icon(
                  category == c ? Icons.check_circle : Icons.circle_outlined,
                  color: category == c ? purple : const Color(0xFFDCC7FA),
                ),
              ],
            ),
          ),
      ],
      if (step == 1) ...[
        const HintCard(
          'Highly identifying details may affect practical anonymity. Share only the context needed to understand your concern.',
        ),
        Form(
          key: form,
          child: Column(
            children: [
              TextFormField(
                controller: title,
                maxLength: 120,
                decoration: const InputDecoration(labelText: 'Incident title'),
                validator: (v) => (v?.trim().length ?? 0) < 5
                    ? 'Please enter at least five characters.'
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: description,
                minLines: 6,
                maxLines: 12,
                maxLength: 10000,
                decoration: const InputDecoration(
                  labelText: 'What would you like us to know?',
                ),
                validator: (v) => (v?.trim().length ?? 0) < 20
                    ? 'Please add at least 20 characters of context.'
                    : null,
              ),
              SoftCard(
                onTap: () async {
                  final selected = await showDatePicker(
                    context: context,
                    initialDate: date,
                    firstDate: DateTime(2000),
                    lastDate: DateTime.now(),
                  );
                  if (selected != null && mounted) {
                    setState(() => date = selected);
                  }
                },
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, color: purple),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Approximate date\n${DateFormat.yMMMd().format(date)}',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
      if (step == 2) ...[
        HintCard(
          modeText(
            'Evidence is optional. Demo selections are not uploaded, sealed, or placed in public storage. Upload progress and retries require the agreed upload contract.',
            chainText(
              'Evidence is optional. Files upload after your report is accepted and are sealed with a hash anchored on Polygon. Remove names or faces you do not need to share.',
              'Evidence is optional. Files upload after your report is accepted and are sealed with a hash in the audit log (offline test chain, not Polygon). Remove names or faces you do not need to share.',
            ),
          ),
        ),
        ActionButton('Choose an image', () => pick(true)),
        ActionButton('Choose a document', () => pick(false)),
        for (final file in files)
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.attach_file, color: purple),
                    const SizedBox(width: 8),
                    Expanded(child: Text(file.name)),
                    IconButton(
                      tooltip: 'Remove file',
                      onPressed: () => setState(() => files.remove(file)),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                Text('${(file.size / 1024).ceil()} KB · selected locally'),
                if (file.image && file.path != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.file(
                        File(file.path!),
                        height: 160,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (c, e, s) =>
                            const Text('Preview unavailable'),
                      ),
                    ),
                  ),
                if (!file.image)
                  const Text('Document preview unavailable in this build.'),
              ],
            ),
          ),
      ],
      if (step == 3) ...[
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(category!, style: const TextStyle(color: purple)),
              const SizedBox(height: 16),
              Text(title.text, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              Text(description.text),
              const SizedBox(height: 16),
              Text(DateFormat.yMMMd().format(date)),
              for (final f in files) Text(f.name),
            ],
          ),
        ),
        HintCard(
          modeText(
            'This creates a local demo case only. There is no backend acceptance, upload, or cryptographic seal. Demo data disappears when the session is cleared or the app closes.',
            chainText(
              'Your phone proves you are an employee without saying which one, and the proof is checked on Polygon. This takes a few seconds. One report per day.',
              'Test backend: the proof is not checked cryptographically and nothing goes on-chain. One report per day.',
            ),
          ),
        ),
      ],
      if (step > 0)
        TextButton(
          onPressed: busy ? null : () => setState(() => step--),
          child: const Text('Previous step'),
        ),
      ActionButton(
        step == 3
            ? modeText('Create local demo report', 'Submit anonymously')
            : 'Continue',
        step == 0 && category == null
            ? null
            : () {
                if (step == 1 && !form.currentState!.validate()) return;
                if (step == 3) {
                  submit();
                } else {
                  setState(() => step++);
                }
              },
        busy: busy,
      ),
    ],
  );
}

class SuccessScreen extends StatelessWidget {
  const SuccessScreen(this.report, {super.key});
  final Report report;
  @override
  Widget build(BuildContext context) => PageShell(
    title: 'Your concern\nhas a place.',
    children: [
      SoftCard(
        child: Column(
          children: [
            const Icon(Icons.check_circle_outline, color: purple, size: 64),
            const SizedBox(height: 24),
            Text(report.id, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Text(
              modeText(
                'Local demo report created.\nBackend acceptance: unavailable.\nEvidence seal: unavailable.',
                chainText(
                  'Report accepted and sealed on Polygon.\nKeep this phone: it holds the only key to this case.',
                  'Report accepted and sealed in the audit log (offline test chain).\nKeep this phone: it holds the only key to this case.',
                ),
              ),
            ),
          ],
        ),
      ),
      ActionButton(
        modeText('View your demo case', 'View your case'),
        () => context.go('/case/${report.id}', extra: report),
      ),
      ActionButton('Back to home', () => context.go('/home')),
    ],
  );
}
