import { useEffect, useState } from 'react';
import { ROLES } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

const ROLE_ICONS: Record<string, string> = {
  user: '👤', skull: '💀', crown: '👑', plus: '➕', search: '🔎',
  shield: '🛡️', knife: '🔪', masks: '🎭', drop: '🩸',
};

export function Market() {
  const { shopBalance, shopItems, shopLoading, loadShop, buyItem } = useGameStore();
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const buy = async (id: string) => {
    setBuying(id);
    playSound('click');
    haptic('medium');
    const ok = await buyItem(id);
    if (ok) hapticNotify('success');
    setBuying(null);
  };

  return (
    <div className="screen">
      <div className="row-between">
        <div className="h1">BOZOR 🛒</div>
        <span className="badge badge-gold" style={{ fontSize: '0.9rem', padding: '8px 14px' }}>
          {shopBalance} 🪙
        </span>
      </div>

      <div className="dim" style={{ fontSize: '0.82rem', marginBottom: 4 }}>
        Premium aktiv rollar — sotib olsangiz <b>Rol tanlash</b> rejimida tanlay olasiz.
        O‘yin yutib coin yig‘ing (g‘alaba +25 🪙).
      </div>

      {shopLoading && shopItems.length === 0 && (
        <>
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 90 }} />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shopItems.map((item) => {
          const def = ROLES[item.roleId];
          return (
            <div key={item.id} className="card" style={{ borderColor: item.owned ? '#46a758' : undefined }}>
              <div className="row" style={{ gap: 12 }}>
                <span style={{ fontSize: '2rem' }}>{ROLE_ICONS[def.icon] ?? '🎭'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: def.color }}>
                    {def.name.toUpperCase()}
                  </div>
                  <div className="dim" style={{ fontSize: '0.78rem' }}>{def.ability}</div>
                </div>
              </div>
              <button
                className={`btn btn-block ${item.owned ? '' : 'btn-primary'}`}
                style={{ marginTop: 10 }}
                disabled={item.owned || buying !== null}
                onClick={() => void buy(item.id)}
              >
                {item.owned ? 'SIZNIKI ✓' : buying === item.id ? 'OLINMOQDA…' : `OLISH — ${item.price} 🪙`}
              </button>
            </div>
          );
        })}
      </div>

      {!shopLoading && shopItems.length === 0 && (
        <div className="empty-state">Market yuklanmadi — backend ulanmagan bo'lishi mumkin.</div>
      )}
      <div className="spacer" />
    </div>
  );
}
