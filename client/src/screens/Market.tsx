import { useEffect, useState } from 'react';
import { ROLES, type ShopItem } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

export function Market() {
  const { shopBalance, shopItems, shopLoading, loadShop, buyItem, equipItem, unequipItem, profile } =
    useGameStore();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const buy = async (id: string) => {
    setBusy(id);
    playSound('click');
    haptic('medium');
    const ok = await buyItem(id);
    if (ok) hapticNotify('success');
    setBusy(null);
  };

  const equip = async (id: string) => {
    setBusy(id);
    haptic('light');
    const ok = await equipItem(id);
    if (ok) hapticNotify('success');
    setBusy(null);
  };

  const unequip = async (kind: 'frame' | 'title') => {
    setBusy(kind);
    haptic('light');
    await unequipItem(kind);
    setBusy(null);
  };

  const roles = shopItems.filter((i) => i.kind === 'role');
  const frames = shopItems.filter((i) => i.kind === 'frame');
  const titles = shopItems.filter((i) => i.kind === 'title');

  return (
    <div className="screen">
      <ScreenHeader title="BOZOR" />
      <div className="row-between">
        <span className="badge badge-gold" style={{ fontSize: '0.9rem', padding: '8px 14px' }}>
          {shopBalance} 🪙
        </span>
        <span className="badge">G‘ALABA +25 🪙</span>
      </div>

      <div className="dim" style={{ fontSize: '0.8rem' }}>
        Coin yig‘ib premium narsalar oling. Rollar faqat <b>Rol tanlash</b> rejimida, ramka va
        unvonlar darhol kiyiladi (g‘alaba +25 🪙).
      </div>

      {shopLoading && shopItems.length === 0 && (
        <>
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 90 }} />
        </>
      )}

      {/* --- RAMKALAR --- */}
      {frames.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 4 }}>🖼️ AVATAR RAMKALARI</div>
          <div className="market-grid">
            {frames.map((item) => (
              <FrameCard
                key={item.id}
                item={item}
                owned={item.owned}
                equipped={profile?.frame === item.value}
                busy={busy === item.id}
                onBuy={() => void buy(item.id)}
                onEquip={() => void equip(item.id)}
                onUnequip={() => void unequip('frame')}
              />
            ))}
          </div>
        </>
      )}

      {/* --- UNVONLAR --- */}
      {titles.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 4 }}>🏷️ UNVONLAR</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {titles.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                owned={item.owned}
                equipped={profile?.title === item.value}
                equipable
                busy={busy === item.id}
                onBuy={() => void buy(item.id)}
                onEquip={() => void equip(item.id)}
                preview={
                  <span className="badge badge-gold" style={{ fontSize: '0.72rem', padding: '6px 12px' }}>
                    «{item.value}»
                  </span>
                }
              />
            ))}
          </div>
        </>
      )}

      {/* --- PREMIUM ROLLAR --- */}
      {roles.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 4 }}>🎭 PREMIUM ROLLAR</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {roles.map((item) => {
              const def = ROLES[item.roleId!];
              return (
                <ItemRow
                  key={item.id}
                  item={item}
                  owned={item.owned}
                  equipped={false}
                  equipable={false}
                  busy={busy === item.id}
                  onBuy={() => void buy(item.id)}
                  onEquip={() => void equip(item.id)}
                  preview={
                    <div className="achievement-icon" style={{ color: def.color }}>
                      <Icon name={def.icon} size={24} />
                    </div>
                  }
                />
              );
            })}
          </div>
          <div className="dim" style={{ fontSize: '0.74rem' }}>
            Premium rollar rol-tanlash rejimida kartadan chiqadi (server tasodifiy beradi).
          </div>
        </>
      )}

      {!shopLoading && shopItems.length === 0 && (
        <div className="empty-state">Market yuklanmadi — backend ulanmagan bo‘lishi mumkin.</div>
      )}
      <div className="spacer" />
    </div>
  );
}

function FrameCard({
  item,
  owned,
  equipped,
  busy,
  onBuy,
  onEquip,
  onUnequip,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  busy: boolean;
  onBuy: () => void;
  onEquip: () => void;
  onUnequip: () => void;
}) {
  return (
    <div className="card" style={{ padding: 14, borderColor: equipped ? 'rgba(76,195,106,.5)' : undefined }}>
      <div className="center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '6px 0 10px' }}>
        <Avatar name="N" size="lg" frame={equipped ? item.value : undefined} />
        <div style={{ fontWeight: 800, fontSize: '0.86rem' }}>{item.name}</div>
        <div className="dim" style={{ fontSize: '0.7rem', minHeight: 28 }}>{item.desc}</div>
      </div>
      {owned ? (
        equipped ? (
          <button className="btn btn-block" style={{ minHeight: 44, fontSize: '0.78rem' }} disabled={busy} onClick={onUnequip}>
            KIYILGAN ✓ — YECHISH
          </button>
        ) : (
          <button className="btn btn-primary btn-block" style={{ minHeight: 44, fontSize: '0.78rem' }} disabled={busy} onClick={onEquip}>
            KIYISH
          </button>
        )
      ) : (
        <button className="btn btn-primary btn-block" style={{ minHeight: 44, fontSize: '0.78rem' }} disabled={busy} onClick={onBuy}>
          {busy ? '…' : `OLISH — ${item.price} 🪙`}
        </button>
      )}
    </div>
  );
}

function ItemRow({
  item,
  owned,
  equipped,
  equipable,
  busy,
  onBuy,
  onEquip,
  preview,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  /** sotib olingandan keyin kiyish mumkinmi (ramka/unvon — ha, rol — yo'q) */
  equipable: boolean;
  busy: boolean;
  onBuy: () => void;
  onEquip: () => void;
  preview: React.ReactNode;
}) {
  return (
    <div className="card" style={{ borderColor: owned ? 'rgba(76,195,106,.35)' : undefined }}>
      <div className="row" style={{ gap: 12 }}>
        {preview}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{item.name}</div>
          <div className="dim" style={{ fontSize: '0.76rem' }}>{item.desc}</div>
        </div>
      </div>
      {owned ? (
        equipable ? (
          equipped ? (
            <span className="badge badge-green" style={{ marginTop: 10 }}>KIYILGAN ✓</span>
          ) : (
            <button className="btn btn-primary btn-block" style={{ minHeight: 44, marginTop: 10, fontSize: '0.8rem' }} disabled={busy} onClick={onEquip}>
              KIYISH
            </button>
          )
        ) : (
          <span className="badge badge-green" style={{ marginTop: 10 }}>SIZNIKI ✓</span>
        )
      ) : (
        <button className="btn btn-primary btn-block" style={{ minHeight: 44, marginTop: 10, fontSize: '0.8rem' }} disabled={busy} onClick={onBuy}>
          {busy ? '…' : `OLISH — ${item.price} 🪙`}
        </button>
      )}
    </div>
  );
}
