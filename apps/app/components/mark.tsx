import { cn } from "@/lib/utils";

/** The Xorv mark. Inline so it paints with the first frame. */
export function Mark({ className, id = "m" }: { className?: string; id?: string }) {
  const beam = `xb-${id}`;
  const beam2 = `xb2-${id}`;
  const core = `xc-${id}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("h-7 w-7", className)} aria-hidden="true">
      <defs>
        <linearGradient id={beam} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="0.5" stopColor="#4C9BFF" />
          <stop offset="1" stopColor="#3DDCFF" />
        </linearGradient>
        <linearGradient id={beam2} x1="56" y1="8" x2="8" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3DDCFF" />
          <stop offset="0.55" stopColor="#5BC8FF" />
          <stop offset="1" stopColor="#7C5CFF" />
        </linearGradient>
        <linearGradient id={core} x1="26" y1="26" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9F8BFF" />
          <stop offset="1" stopColor="#50F0C8" />
        </linearGradient>
      </defs>
      <g strokeLinecap="round" fill="none" strokeWidth="7">
        <path d="M14 14 L27 27" stroke={`url(#${beam})`} />
        <path d="M37 37 L50 50" stroke={`url(#${beam})`} />
        <path d="M50 14 L37 27" stroke={`url(#${beam2})`} />
        <path d="M27 37 L14 50" stroke={`url(#${beam2})`} />
      </g>
      <rect x="27.6" y="27.6" width="8.8" height="8.8" rx="2.2" transform="rotate(45 32 32)" fill={`url(#${core})`} />
      <g>
        <circle cx="14" cy="14" r="3.1" fill="#7C5CFF" />
        <circle cx="50" cy="50" r="3.1" fill="#3DDCFF" />
        <circle cx="50" cy="14" r="3.1" fill="#3DDCFF" />
        <circle cx="14" cy="50" r="3.1" fill="#7C5CFF" />
      </g>
    </svg>
  );
}
