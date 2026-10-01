/**
 * Yagona line-art SVG ikonlar to'plami (24x24, stroke).
 * Emoji o'rniga ishlatiladi — har qanday o'lchamda o'tkir ko'rinadi.
 */
export function Icon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name] ?? PATHS.user}
    </svg>
  );
}

const PATHS: Record<string, React.ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c1.4-3.4 4-5 7.2-5s5.8 1.6 7.2 5" />
    </>
  ),
  skull: (
    <>
      <path d="M12 2.5c4.7 0 8 3.3 8 7.6 0 2.4-1.1 4.2-2.8 5.4v3a1.5 1.5 0 0 1-1.5 1.5h-7.4A1.5 1.5 0 0 1 6.8 18.5v-3C5.1 14.3 4 12.5 4 10.1 4 5.8 7.3 2.5 12 2.5Z" />
      <circle cx="9" cy="10.4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10.4" r="1.5" fill="currentColor" stroke="none" />
      <path d="M10.5 16.5v2M13.5 16.5v2" />
    </>
  ),
  crown: (
    <>
      <path d="M3 8.5 6.5 12 12 5.5 17.5 12 21 8.5 19.5 18h-15L3 8.5Z" />
      <path d="M8.5 15h7" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6" />
      <path d="m20 20-4.9-4.9" />
      <path d="M8.4 9.4a3 3 0 0 1 2.4-1.9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 19.5 5.5v6c0 4.6-3 8.1-7.5 9.7C7.5 19.6 4.5 16.1 4.5 11.5v-6L12 2.8Z" />
      <path d="M12 7.5v6M9 10.5h6" />
    </>
  ),
  knife: (
    <>
      <path d="M4 20c3-0.5 5.5-1.8 7.4-3.7L20.5 7.2 16.8 3.5 7.7 12.6C5.8 14.5 4.5 17 4 20Z" />
      <path d="m10 14 3.2 3.2" />
    </>
  ),
  masks: (
    <>
      <path d="M3.5 5.5c2.8 1.1 6.2 1.1 9 0v6.3c0 3-2 5.2-4.5 5.2S3.5 14.8 3.5 11.8V5.5Z" />
      <path d="M11.5 9.7c2.8 1.1 6.2 1.1 9 0V16c0 3-2 5.2-4.5 5.2s-4.5-2.2-4.5-5.2V9.7Z" fill="none" />
      <path d="M6 9.2h0.01M10 9.2h0.01" strokeWidth={2.4} />
      <path d="M14.5 13.2h0.01M18.5 13.2h0.01" strokeWidth={2.4} />
    </>
  ),
  moon: (
    <>
      <path d="M20.2 14.5A8.3 8.3 0 0 1 9.5 3.8a8.3 8.3 0 1 0 10.7 10.7Z" />
      <path d="M17.5 4.5 18 6l1.5.5L18 7l-.5 1.5L17 7l-1.5-.5L17 6l.5-1.5Z" fill="currentColor" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" />
    </>
  ),
  gavel: (
    <>
      <path d="m9.5 6.5 5-5M14.5 6.5l-5-5" transform="translate(3 5) rotate(45 12 4)" />
      <path d="M13.5 5.5 18.5 10.5M10.4 8.6 15.4 13.6" />
      <rect x="11.7" y="10.6" width="6.4" height="3" rx="0.8" transform="rotate(45 14.9 12.1)" />
      <path d="M8.5 15.5 3 21M12.5 19.5h-8" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  coins: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2v9.6M14.8 9.2c-.6-.9-1.7-1.4-2.8-1.4-1.6 0-2.9.9-2.9 2.2 0 2.9 5.8 1.5 5.8 4.3 0 1.3-1.3 2.2-2.9 2.2-1.2 0-2.3-.5-2.9-1.4" />
    </>
  ),
  door: (
    <>
      <path d="M13.5 3.5h5v17h-5" />
      <path d="M13.5 3.5 6 5.5v13l7.5 2M13.5 3.5v17" />
      <circle cx="11" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.4 2.4M15.6 15.6 18 18M18 6l-2.4 2.4M8.4 15.6 6 18" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 4h11a2 2 0 0 1 2 2v1.5h-4" />
      <path d="M7 4a2 2 0 0 0-2 2v12a2.5 2.5 0 0 0 2.5 2.5H18a2 2 0 0 0 2-2v-1h-4" />
      <path d="M9 9h7M9 12.5h7M9 16h4.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4.5h8V10a4 4 0 0 1-8 0V4.5Z" />
      <path d="M8 6H4.5c0 3 1.4 4.7 3.7 5M16 6h3.5c0 3-1.4 4.7-3.7 5" />
      <path d="M12 14v3M8.5 20.5h7M10 20.5c0-2 .8-3.5 2-3.5s2 1.5 2 3.5" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14.5" r="5" />
      <path d="m9 10.5-3-6.5h4l2 4 2-4h4l-3 6.5" />
      <path d="m12 12.8.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3.9-1.8Z" fill="currentColor" stroke="none" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </>
  ),
  cart: (
    <>
      <path d="M3.5 4.5h2l2.3 10.4a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.2l1.6-6.5H7" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),
  back: (
    <>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </>
  ),
  send: (
    <>
      <path d="M4.5 12 20 4.5 15 20l-4-6-6.5-2Z" />
      <path d="m11 14 4-4.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  heart: (
    <>
      <path d="M12 20.5S3.5 15 3.5 8.9C3.5 5.9 5.9 4 8.4 4c1.6 0 3 .8 3.6 2 .6-1.2 2-2 3.6-2 2.5 0 4.9 1.9 4.9 4.9 0 6.1-8.5 11.6-8.5 11.6Z" />
    </>
  ),
  refresh: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 13-5.2L20 9.5" />
      <path d="M20 4v5.5h-5.5M19.5 12a7.5 7.5 0 0 1-13 5.2L4 14.5" />
      <path d="M4 20v-5.5h5.5" />
    </>
  ),
};
