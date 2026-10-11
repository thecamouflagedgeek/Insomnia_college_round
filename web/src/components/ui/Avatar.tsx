import { useState } from 'react';
import { initials } from '../../lib/people';

/** Staff photo with an initials fallback when the image can't load. */
export function Avatar({ src, name, size = 32, className = '' }: { src?: string; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!src || failed) {
    return (
      <span
        style={style}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-[0.6875rem] font-bold text-brand-700 ${className}`}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={style}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  );
}
