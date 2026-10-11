import { SkeletonRows } from './Skeleton';

export function LoadingState({ message = 'Loading' }: { message?: string }) {
  return (
    <div className="card card-pad">
      <SkeletonRows rows={4} label={message} />
    </div>
  );
}
