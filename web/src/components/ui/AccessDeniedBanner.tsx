import { ShieldAlert, Lock, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface AccessDeniedBannerProps {
  caseId?: string;
  errorMessage?: string;
  onBack?: () => void;
  onRetry?: () => void;
}

export function AccessDeniedBanner({
  caseId,
  errorMessage,
  onBack,
  onRetry
}: AccessDeniedBannerProps) {
  const { currentUser } = useAuth();

  return (
    <div className="bg-red-50/90 border border-red-200 rounded-3xl p-8 max-w-2xl mx-auto my-8 shadow-sm text-center">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100/80 border border-red-300 text-red-800 text-xs font-mono font-bold rounded-full mb-3">
        <Lock className="w-3.5 h-3.5" />
        HTTP 403 FORBIDDEN — ACCESS REVOKED
      </div>

      <h2 className="text-xl font-bold text-red-950 mb-2">
        Zero-Trust Authorization Enforcement
      </h2>

      <p className="text-sm text-red-800 leading-relaxed mb-6">
        {errorMessage || (
          <>
            Access to case <strong>{caseId}</strong> was denied by the backend authorization layer.
            User <span className="font-semibold underline">{currentUser.name}</span> ({currentUser.title}) has been 
            revoked from this case assignment following an upheld Committee Challenge.
          </>
        )}
      </p>

      <div className="bg-white/80 border border-red-200 rounded-2xl p-4 text-left text-xs text-red-900 mb-6 font-mono space-y-1">
        <p className="font-bold text-red-700">Security Audit Receipt:</p>
        <p>• Auth Check: <code>require_case_access('{currentUser.id}', '{caseId}')</code></p>
        <p>• Revocation Vector: <code>COMMITTEE_CHALLENGE_UPHELD</code></p>
        <p>• Action: <code>READ_REPORT_DISALLOWED</code></p>
        <p>• Enforced by: <code>FastAPI Auth Dependency / Zero-Knowledge State Engine</code></p>
      </div>

      <div className="flex items-center justify-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Queue
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry API Request
          </button>
        )}
      </div>
    </div>
  );
}
