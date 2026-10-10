import 'api_client.dart';
import 'reporter_zk.dart';
import 'zk_prover.dart';
import 'webview_prover.dart';

/// User-facing text for integration failures. Never includes server internals or identifiers.
String friendlyError(
  Object error, {
  String fallback = 'Something went wrong. Please try again.',
}) {
  if (error is NotEnrolled) {
    return 'This phone is not verified yet. Verify your membership first.';
  }
  if (error is GroupRootMismatch) {
    return 'The member list changed while preparing your proof. Please try again.';
  }
  if (error is ProverFailure) {
    return 'Could not prepare your membership proof on this phone. Check your connection and try again.';
  }
  if (error is ApiFailure) {
    return switch (error.reason) {
      'replay' => 'This was already submitted. One report per day, and one challenge per committee member.',
      'bad_enroll_code' =>
        'That invite code was not accepted. Check it with HR.',
      'network_error' =>
        'No connection to INCOGNITO. Check your network and retry.',
      'case_not_found' => 'This case is not available on this phone.',
      'missing_witness_code' => 'Enter your witness code first.',
      'invitation_not_found' => 'That witness code has no invitations.',
      'already_responded' => 'You have already responded to this invitation.',
      'too_many_files' => 'A case can hold up to five evidence files.',
      'file_too_large' => 'Each evidence file must be under 20 MB.',
      'invalid_proof' ||
      'unknown_root' ||
      'root_expired' => 'Your membership proof was not accepted. Please retry.',
      _ => fallback,
    };
  }
  return fallback;
}
