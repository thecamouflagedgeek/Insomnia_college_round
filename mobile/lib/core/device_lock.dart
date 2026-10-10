import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Gates the rendered workspace after backgrounding; biometric data is never read.
class DeviceLock extends StatefulWidget {
  const DeviceLock({super.key, required this.child, required this.onClear});
  final Widget child;
  final VoidCallback onClear;
  @override
  State<DeviceLock> createState() => _DeviceLockState();
}

class _DeviceLockState extends State<DeviceLock> with WidgetsBindingObserver {
  bool locked = false, busy = false;
  String? message;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused && !busy) check();
  }

  Future<void> check() async {
    try {
      final enabled = await const FlutterSecureStorage().read(
        key: 'biometric_enabled',
      );
      if (mounted && enabled == 'true') setState(() => locked = true);
    } catch (_) {
      if (mounted) {
        setState(() {
          locked = true;
          message = 'Local protection could not be checked.';
        });
      }
    }
  }

  Future<void> unlock() async {
    setState(() {
      busy = true;
      message = null;
    });
    try {
      final accepted = await LocalAuthentication().authenticate(
        localizedReason: 'Unlock your INCOGNITO workspace',
        options: const AuthenticationOptions(biometricOnly: true),
      );
      if (mounted && accepted) setState(() => locked = false);
    } catch (_) {
      if (mounted) {
        setState(
          () => message =
              'Authentication unavailable. Retry or clear this local session.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => locked
      ? Material(
          color: const Color(0xFFF4F3FC),
          child: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.fingerprint,
                      size: 72,
                      color: Color(0xFF8E4DDF),
                    ),
                    const SizedBox(height: 24),
                    const Text('Your workspace is locked.'),
                    if (message != null) Text(message!),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: busy ? null : unlock,
                      child: Text(busy ? 'Unlocking…' : 'Unlock'),
                    ),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () async {
                              await const FlutterSecureStorage().delete(
                                key: 'biometric_enabled',
                              );
                              widget.onClear();
                              if (mounted) setState(() => locked = false);
                            },
                      child: const Text('Clear session and start again'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        )
      : widget.child;
}
