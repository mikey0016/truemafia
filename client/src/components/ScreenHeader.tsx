import { Icon } from './Icon';
import { useGameStore } from '../store/gameStore';
import { haptic } from '../services/telegram';

/**
 * Har bir ichki sahifa uchun yagona sarlavha: orqaga tugmasi + markazda nom.
 * Orqaga — navigate stack'dan qaytadi (Telegram BackButton bilan bir xil mantiq).
 */
export function ScreenHeader({ title }: { title: string }) {
  const back = useGameStore((s) => s.back);
  return (
    <div className="row-between">
      <button
        className="btn btn-ghost"
        style={{ minHeight: 0, padding: '9px 13px', flexShrink: 0 }}
        onClick={() => {
          haptic('light');
          back();
        }}
        aria-label="Orqaga"
      >
        <Icon name="back" size={16} />
      </button>
      <div className="h1" style={{ flex: 1, textAlign: 'center' }}>{title}</div>
      <span style={{ width: 52, flexShrink: 0 }} />
    </div>
  );
}
