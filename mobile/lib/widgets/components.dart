import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';

class SoftCard extends StatelessWidget {
  const SoftCard({super.key, required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 16),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .94),
      borderRadius: BorderRadius.circular(28),
      boxShadow: [
        BoxShadow(
          color: purple.withValues(alpha: .035),
          blurRadius: 24,
          offset: const Offset(0, 10),
        ),
      ],
    ),
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: Padding(padding: const EdgeInsets.all(24), child: child),
      ),
    ),
  );
}

class PageShell extends StatelessWidget {
  const PageShell({
    super.key,
    required this.title,
    required this.children,
    this.tab,
    this.back = true,
  });
  final String title;
  final List<Widget> children;
  final int? tab;
  final bool back;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFE8DDFB), Color(0xFFF4F3FC), Color(0xFFF9F7FB)],
          stops: [0, .35, 1],
        ),
      ),
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 18, 24, 32),
          children: [
            Row(
              children: [
                if (back && context.canPop())
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                const Spacer(),
                const Icon(Icons.shield_outlined, size: 18, color: purple),
                const SizedBox(width: 8),
                const Text(
                  'INCOGNITO',
                  style: TextStyle(
                    letterSpacing: 2,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              'DEMO WORKSPACE · LOCAL DATA',
              style: TextStyle(
                fontSize: 10,
                letterSpacing: 1.3,
                color: Color(0xFF7542BE),
              ),
            ),
            const SizedBox(height: 18),
            Text(title, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 24),
            ...children,
          ],
        ),
      ),
    ),
    bottomNavigationBar: tab == null
        ? null
        : NavigationBar(
            selectedIndex: tab!,
            backgroundColor: Colors.white,
            indicatorColor: const Color(0xFFE8DDFB),
            onDestinationSelected: (i) =>
                context.go(['/home', '/reports', '/inbox', '/settings'][i]),
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Icon(Icons.folder_outlined),
                label: 'Reports',
              ),
              NavigationDestination(
                icon: Icon(Icons.chat_bubble_outline),
                label: 'Inbox',
              ),
              NavigationDestination(
                icon: Icon(Icons.shield_outlined),
                label: 'Privacy',
              ),
            ],
          ),
  );
}

class ActionButton extends StatelessWidget {
  const ActionButton(
    this.label,
    this.onPressed, {
    super.key,
    this.busy = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        child: busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(label),
      ),
    ),
  );
}

class HintCard extends StatelessWidget {
  const HintCard(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => SoftCard(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.info_outline, color: purple, size: 20),
        const SizedBox(width: 12),
        Expanded(child: Text(text)),
      ],
    ),
  );
}

void feedback(BuildContext context, String text) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
