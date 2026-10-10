import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'zk_prover.dart';

/// Safe failure category only: never surface JavaScript arguments or native exception details.
class ProverFailure implements Exception {
  const ProverFailure();
  @override
  String toString() => 'The local membership prover could not finish.';
}

class ProverReply {
  const ProverReply({this.value, this.error});
  final dynamic value;
  final String? error;
}

/// Platform seam: tests inject this without starting a WebView.
abstract interface class ProverHost {
  Future<void> start();
  Future<ProverReply> call(String function, Map<String, dynamic> arguments);
  Future<void> dispose();
}

class HeadlessProverHost implements ProverHost {
  HeadlessInAppWebView? _view;
  InAppWebViewController? _controller;
  @override
  Future<void> start() async {
    // Plugin event logs can include JavaScript return values (including proofs).
    PlatformInAppWebViewController.debugLoggingSettings.enabled = false;
    final html = await rootBundle.loadString('assets/prover/prover.html');
    final loaded = Completer<void>();
    _view = HeadlessInAppWebView(
      initialData: InAppWebViewInitialData(
        data: html,
        baseUrl: WebUri('https://incognito.invalid/'),
      ),
      initialSettings: InAppWebViewSettings(
        javaScriptEnabled: true,
        isInspectable: false,
      ),
      onWebViewCreated: (controller) => _controller = controller,
      onLoadStop: (controller, url) {
        if (!loaded.isCompleted) loaded.complete();
      },
      onReceivedError: (controller, request, error) {
        if (request.isForMainFrame == true && !loaded.isCompleted) {
          loaded.completeError(const ProverFailure());
        }
      },
      // Do not forward JavaScript console messages into native logs.
      onConsoleMessage: (controller, message) {},
    );
    await _view!.run();
    await loaded.future.timeout(const Duration(seconds: 30));
  }

  @override
  Future<ProverReply> call(
    String function,
    Map<String, dynamic> arguments,
  ) async {
    final controller = _controller;
    if (controller == null) throw const ProverFailure();
    final body = switch (function) {
      'commitment' => 'return await window.incognito.commitment(privateKey);',
      'prove' => 'return await window.incognito.prove(args);',
      _ => throw const ProverFailure(),
    };
    // Arguments use the native serializer, never string interpolation of private material.
    final result = await controller.callAsyncJavaScript(
      functionBody: body,
      arguments: arguments,
    );
    return ProverReply(
      value: result?.value,
      error: result == null ? 'PROVER_FAILURE:empty' : result.error?.toString(),
    );
  }

  @override
  Future<void> dispose() async {
    final view = _view;
    _view = null;
    _controller = null;
    await view?.dispose();
  }
}

/// One lazily loaded headless WebView per provider/app session. Operations are serialized,
/// including key creation, and the identity secret never reaches the backend.
class WebViewProver implements ZkProver {
  WebViewProver(this._key, {ProverHost? host})
    : _host = host ?? HeadlessProverHost();
  final IdentityKey _key;
  final ProverHost _host;
  Future<void> _tail = Future.value();
  bool _ready = false, _disposed = false;
  Future<T> _serial<T>(Future<T> Function() action) {
    final result = Completer<T>();
    _tail = _tail.then((_) async {
      try {
        if (_disposed) throw const ProverFailure();
        result.complete(await action());
      } catch (error, stack) {
        result.completeError(
          error is GroupRootMismatch ? error : const ProverFailure(),
          stack,
        );
      }
    });
    return result.future;
  }

  Future<void> _start() async {
    if (_ready) return;
    try {
      await _host.start();
      _ready = true;
    } catch (_) {
      await _host.dispose();
      rethrow;
    }
  }

  Future<dynamic> _call(String function, Map<String, dynamic> arguments) async {
    await _start();
    final ProverReply reply;
    try {
      reply = await _host
          .call(function, arguments)
          .timeout(const Duration(seconds: 120));
    } on TimeoutException {
      _ready = false;
      await _host.dispose();
      throw const ProverFailure();
    }
    if (reply.error != null) {
      final match = RegExp(r'GROUP_ROOT_MISMATCH:([0-9]+):([0-9]+)')
          .firstMatch(reply.error!);
      if (match != null) throw GroupRootMismatch(match[1]!, match[2]!);
      throw const ProverFailure();
    }
    return reply.value;
  }

  @override
  Future<String> commitment() => _serial(() async {
    final value = await _call('commitment', {
      'privateKey': base64Encode(await _key.load()),
    });
    if (value is! String || !RegExp(r'^[0-9]+$').hasMatch(value)) {
      throw const ProverFailure();
    }
    return value;
  });
  @override
  Future<Map<String, dynamic>> prove({
    required List<String> members,
    required String onchainRoot,
    required String message,
    required String scope,
  }) => _serial(() async {
    final value = await _call('prove', {
      'args': {
        'privateKey': base64Encode(await _key.load()),
        'members': members,
        'onchainRoot': onchainRoot,
        'message': message,
        'scope': scope,
        'depth': 16,
      },
    });
    if (value is! Map) throw const ProverFailure();
    final proof = Map<String, dynamic>.from(value);
    final decimal = RegExp(r'^[0-9]+$');
    if (proof['merkle_tree_depth'] != 16 ||
        proof['merkle_tree_root'] != onchainRoot ||
        ['merkle_tree_root', 'nullifier', 'message', 'scope'].any(
          (key) =>
              proof[key] is! String || !decimal.hasMatch(proof[key] as String),
        )) {
      throw const ProverFailure();
    }
    final points = proof['points'];
    if (points is! List ||
        points.length != 8 ||
        points.any((p) => p is! String || !decimal.hasMatch(p))) {
      throw const ProverFailure();
    }
    return proof;
  });
  Future<void> dispose() async {
    _disposed = true;
    await _tail;
    await _host.dispose();
  }
}
