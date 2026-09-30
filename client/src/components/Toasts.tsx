import { useGameStore } from '../store/gameStore';

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
