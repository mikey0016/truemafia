export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls = `avatar avatar-${size}`;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={cls}>
      {src ? <img src={src} alt={name} referrerPolicy="no-referrer" /> : initial}
    </div>
  );
}
