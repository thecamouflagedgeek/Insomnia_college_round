import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme.dart';
import '../data/repository.dart';
import '../integration/errors.dart';
import '../widgets/components.dart';

/// The reporter's own uploaded evidence, as the backend stores it: the same cleaned copy staff see.
class EvidenceScreen extends StatelessWidget {
  const EvidenceScreen(this.report, {super.key});
  final Report report;

  @override
  Widget build(BuildContext context) => PageShell(
    title: 'Your evidence.',
    children: [
      Text(report.id),
      const SizedBox(height: 16),
      HintCard(
        modeText(
          'Demo evidence selections are not uploaded, so there is nothing stored to show.',
          'These are the copies stored with your case, exactly as staff see them. Photos had location, device, '
              'author and time details removed when you uploaded them. What is visible in a file can still identify you.',
        ),
      ),
      if (demoEnabled || report.evidence.isEmpty)
        HintCard(
          demoEnabled
              ? 'No uploaded files in demo mode.'
              : 'No evidence was uploaded for this case.',
        )
      else
        for (final item in report.evidence) _EvidenceTile(report, item),
    ],
  );
}

class _EvidenceTile extends ConsumerWidget {
  const _EvidenceTile(this.report, this.item);
  final Report report;
  final EvidenceRef item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final file = ref.watch(evidenceFileProvider((report, item)));
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                item.isImage
                    ? Icons.image_outlined
                    : Icons.description_outlined,
                color: purple,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.name,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                _size(item.size),
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
          ),
          const SizedBox(height: 12),
          file.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => Text(
              'Could not load this file: ${friendlyError(e)}',
              style: const TextStyle(color: Color(0xFFB3261E)),
            ),
            data: (bytes) => _Preview(item, bytes),
          ),
          const SizedBox(height: 12),
          Text(
            item.metadataRemoved
                ? 'Identifying metadata removed · sealed in the Silent Audit'
                : 'Sealed in the Silent Audit · metadata in this file type is not removed yet',
            style: TextStyle(
              fontSize: 12,
              color: item.metadataRemoved
                  ? const Color(0xFF0B7569)
                  : const Color(0xFF9C3D14),
            ),
          ),
          const SizedBox(height: 4),
          SelectableText(
            'SHA-256 ${item.sha256.substring(0, 16)}…${item.sha256.substring(item.sha256.length - 8)}',
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 11,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  static String _size(int bytes) => bytes < 1024 * 1024
      ? '${(bytes / 1024).toStringAsFixed(1)} KB'
      : '${(bytes / 1048576).toStringAsFixed(1)} MB';
}

class _Preview extends StatelessWidget {
  const _Preview(this.item, this.bytes);
  final EvidenceRef item;
  final Uint8List bytes;

  @override
  Widget build(BuildContext context) {
    if (item.isImage) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image.memory(
          bytes,
          fit: BoxFit.contain,
          width: double.infinity,
          errorBuilder: (_, _, _) =>
              const Text('This image could not be displayed.'),
        ),
      );
    }
    if (item.isText) {
      final text = utf8.decode(bytes, allowMalformed: true);
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF6F4FC),
          borderRadius: BorderRadius.circular(12),
        ),
        child: SelectableText(
          text.length > 4000 ? '${text.substring(0, 4000)}…' : text,
          style: const TextStyle(fontSize: 13),
        ),
      );
    }
    return Text('${item.mime} · preview is not available in the app yet.');
  }
}
