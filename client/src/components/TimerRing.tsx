/**
 * Doiraviy taymer — SVG ring + markazda qolgan soniya.
 */
export function TimerRing({
  secondsLeft,
  totalSeconds,
  night,
  urgent,
}: {
  secondsLeft: number;
  totalSeconds: number;
  night?: boolean;
  urgent?: boolean;
}) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const frac = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const label = mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : String(ss);

  return (
    <div className={`timer-ring ${night ? 'night' : ''} ${urgent ? 'urgent' : ''}`}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle className="track" cx="26" cy="26" r={R} />
        <circle
          className="prog"
          cx="26"
          cy="26"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
        />
      </svg>
      <span className="tval mono">{label}</span>
    </div>
  );
}
