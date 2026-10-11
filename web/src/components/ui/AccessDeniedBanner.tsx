import { ArrowLeft, RefreshCw, ShieldX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_LABEL } from '../../lib/people';

interface AccessDeniedBannerProps {
  caseId?: string;
  errorMessage?: string;
  onBack?: () => void;
  onRetry?: () => void;
}

/** Shown when the backend refuses a case (403/404). Reports the server's reason as given. */
export function AccessDeniedBanner({ caseId, errorMessage, onBack, onRetry }: AccessDeniedBannerProps) {
  const { currentUser } = useAuth();

  return (
    <div className="card mx-auto my-6 max-w-xl animate-enter p-6 text-center sm:p-8" role="alert">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600">
        <ShieldX className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-ink">You can't open this case</h1>
      <p className="mt-1.5 text-sm text-muted">
        Access was refused to <span className="case-id text-ink">{caseId}</span> for {currentUser.name} (
        {ROLE_LABEL[currentUser.role]}). Access is checked on the server for every request.
      </p>
      {errorMessage && (
        <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-left font-mono text-xs text-ink-soft">{errorMessage}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft />
            Back to queue
          </button>
        )}
        {onRetry && (
          <button className="btn btn-ghost" onClick={onRetry}>
            <RefreshCw />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
