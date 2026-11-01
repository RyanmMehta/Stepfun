// Small stroke icons, sized by font-size so they sit on the text baseline.

type P = { className?: string };

function Svg({ className = "", children }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-[1em] w-[1em] shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const StopIcon = (p: P) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </Svg>
);

export const UploadIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 15V4M7 9l5-5 5 5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const MicIcon = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);

export const SparkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
  </Svg>
);

export const SpeakerIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </Svg>
);

export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
);

export const XIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ArrowIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const RetryIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" />
  </Svg>
);

export const BookIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6" />
  </Svg>
);

export const ListIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Svg>
);

// The brand mark: a fast, jagged wave settling into a calm one.
export function Mark({ className = "" }: P) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="9" fill="#1b1a17" />
      <path
        d="M6 16h2l1.5-6 2 12 2-9 1.5 6 1.5-3h2.5c1.5 0 2-3 3.5-3s2 3 3.5 3"
        fill="none"
        stroke="#f5b841"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Animated bars shown while the voice is speaking.
export function Bars({ className = "" }: P) {
  return (
    <span className={`inline-flex h-[1em] items-end gap-[2px] ${className}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="eq-bar w-[3px] rounded-full bg-current" style={{ animationDelay: `${i * -0.22}s` }} />
      ))}
    </span>
  );
}
