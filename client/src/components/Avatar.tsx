export function Avatar({
  src,
  name,
  size = 'md',
  frame,
}: {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** market ramkasi: bronze | neon | gold */
  frame?: string;
}) {
  const frameCls = frame ? ` frame-${frame}` : '';
  const cls = `avatar avatar-${size}${frameCls}`;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={cls}>
      {src ? <img src={src} alt={name} referrerPolicy="no-referrer" /> : initial}
    </div>
  );
}
