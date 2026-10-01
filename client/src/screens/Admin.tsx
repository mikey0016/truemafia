import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Icon } from '../components/Icon';
import { haptic } from '../services/telegram';

type Tab = 'stats' | 'rooms' | 'users' | 'broadcast';

const PHASE_LABEL: Record<string, string> = {
  LOBBY: 'LOBBY',
  ROLE_REVEAL: 'ROLLAR',
  NIGHT: 'TUN',
  NIGHT_RESULT: 'TONG',
  DAY: 'KUN',
  DISCUSSION: 'MUHOKAMA',
  VOTING: 'OVOZ',
  VOTE_RESULT: 'NATIJA',
  GAME_OVER: 'TUGADI',
};

export function Admin() {
  const navigate = useGameStore((s) => s.navigate);
  const {
    adminStats,
    adminRooms,
    adminUsers,
    adminLoading,
    loadAdminStats,
    loadAdminRooms,
    loadAdminUsers,
    adminCloseRoom,
    adminSetBan,
    adminAddCoins,
    adminBroadcast,
  } = useGameStore();
  const [tab, setTab] = useState<Tab>('stats');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [coins, setCoins] = useState('100');
  const [broadcast, setBroadcast] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void loadAdminStats();
    void loadAdminRooms();
    void loadAdminUsers('');
  }, [loadAdminStats, loadAdminRooms, loadAdminUsers]);

  const refresh = () => {
    haptic('light');
    void loadAdminStats();
    void loadAdminRooms();
    void loadAdminUsers(query);
  };

  const sel = adminUsers.find((u) => u.userId === selected) ?? null;

  const send = async () => {
    if (!broadcast.trim()) return;
    setSending(true);
    haptic('medium');
    await adminBroadcast(broadcast.trim());
    setBroadcast('');
    setSending(false);
  };

  return (
    <div className="screen">
      <div className="row-between">
        <button className="btn btn-ghost" style={{ minHeight: 0, padding: '9px 13px' }} onClick={() => navigate('home')}>
          <Icon name="back" size={16} />
        </button>
        <div className="h1" style={{ flex: 1, textAlign: 'center', marginRight: 52 }}>⚙️ ADMIN</div>
      </div>

      <div className="tabbar">
        {(
          [
            ['stats', 'STATS'],
            ['rooms', 'XONALAR'],
            ['users', 'FOYLAR'],
            ['broadcast', 'E’LON'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat-box">
              <div className="v gold">{adminStats?.onlinePlayers ?? '—'}</div>
              <div className="k">Onlayn ulanish</div>
            </div>
            <div className="stat-box">
              <div className="v">{adminStats?.activeGames ?? '—'}</div>
              <div className="k">Faol o‘yin</div>
            </div>
            <div className="stat-box">
              <div className="v">{adminStats?.openRooms ?? '—'}</div>
              <div className="k">Ochiq xona</div>
            </div>
            <div className="stat-box">
              <div className="v">{adminStats ? `${adminStats.totalGames}` : '—'}</div>
              <div className="k">Umumiy o‘yin</div>
            </div>
          </div>
          <div className="stat-box">
            <div className="v gold">{adminStats?.totalUsers ?? '—'}</div>
            <div className="k">Ro‘yxatdan o‘tgan foydalanuvchi</div>
          </div>
          <button className="btn btn-ghost btn-block" onClick={refresh} disabled={adminLoading}>
            <Icon name="refresh" size={16} /> YANGILASH
          </button>
        </>
      )}

      {tab === 'rooms' && (
        <>
          {adminRooms.length === 0 && <div className="empty-state">Hozircha xona yo‘q.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {adminRooms.map((r) => (
              <div key={r.code} className="list-row">
                <span className="serif gold" style={{ fontWeight: 800, letterSpacing: '0.14em' }}>{r.code}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="label">{PHASE_LABEL[r.phase] ?? r.phase} · RAUND {r.round}</div>
                  <div className="dim" style={{ fontSize: '0.74rem' }}>
                    {r.players} o‘yinchi{r.demo ? ' · botli' : ''}
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ minHeight: 0, padding: '8px 13px', fontSize: '0.72rem' }}
                  onClick={() => {
                    haptic('medium');
                    void adminCloseRoom(r.code);
                  }}
                >
                  YOPISH
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'users' && (
        <>
          <div className="row" style={{ gap: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID yoki ism bo‘yicha qidirish…"
              style={{ fontSize: '0.88rem' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadAdminUsers(query);
              }}
            />
            <button className="btn" style={{ minHeight: 0, width: 48, flexShrink: 0 }} onClick={() => void loadAdminUsers(query)}>
              <Icon name="search" size={17} />
            </button>
          </div>

          {sel && (
            <div className="card-strong">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{sel.displayName}</div>
                  <div className="label">@{sel.username} · ID {sel.userId}</div>
                </div>
                <button className="btn btn-ghost" style={{ minHeight: 0, padding: '7px 11px', fontSize: '0.7rem' }} onClick={() => setSelected(null)}>
                  YOPISH
                </button>
              </div>
              <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
                <div className="stat-box"><div className="v gold">{sel.coins}</div><div className="k">Coin</div></div>
                <div className="stat-box"><div className="v">{sel.games}</div><div className="k">O‘yin</div></div>
                <div className="stat-box"><div className="v">{sel.wins}</div><div className="k">G‘alaba</div></div>
              </div>
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <input
                  value={coins}
                  onChange={(e) => setCoins(e.target.value.replace(/[^-0-9]/g, ''))}
                  style={{ width: 90, textAlign: 'center', fontWeight: 800, flexShrink: 0 }}
                  inputMode="numeric"
                />
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, minHeight: 0, padding: '11px', fontSize: '0.78rem' }}
                  onClick={() => {
                    haptic('medium');
                    void adminAddCoins(sel.userId, parseInt(coins || '0', 10));
                  }}
                >
                  + COIN BERISH (− oladi)
                </button>
              </div>
              {sel.isBanned ? (
                <button
                  className="btn btn-block"
                  style={{ minHeight: 46, fontSize: '0.8rem', color: 'var(--green-2)' }}
                  onClick={() => {
                    haptic('medium');
                    void adminSetBan(sel.userId, false);
                  }}
                >
                  BLOKDAN OLISH
                </button>
              ) : (
                <button
                  className="btn btn-danger btn-block"
                  style={{ minHeight: 46, fontSize: '0.8rem' }}
                  onClick={() => {
                    haptic('heavy');
                    void adminSetBan(sel.userId, true);
                  }}
                >
                  🔨 HISOBNI BLOKLASH
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {adminUsers.map((u) => (
              <button
                key={u.userId}
                className="list-row card-press"
                style={{ textAlign: 'left' }}
                onClick={() => {
                  haptic('light');
                  setSelected(u.userId);
                  setCoins('100');
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.displayName}
                </span>
                <span className="dim" style={{ fontSize: '0.72rem' }}>ID {u.userId}</span>
                <span className="spacer" />
                <span className="badge">{u.coins} 🪙</span>
                {u.isBanned && <span className="badge badge-red">BLOK</span>}
              </button>
            ))}
            {adminUsers.length === 0 && !adminLoading && (
              <div className="empty-state">Hech kim topilmadi.</div>
            )}
          </div>
        </>
      )}

      {tab === 'broadcast' && (
        <>
          <div className="card">
            <div className="label" style={{ marginBottom: 8 }}>HAMMAGA E’LON YUBORISH</div>
            <div className="dim" style={{ fontSize: '0.78rem', marginBottom: 10 }}>
              Barcha onlayn o‘yinchilar ekranida bildirishnoma chiqadi.
            </div>
            <textarea
              value={broadcast}
              onChange={(e) => setBroadcast(e.target.value.slice(0, 240))}
              placeholder="Masalan: 5 daqiqadan keyin server yangilanadi!"
              rows={4}
              style={{ resize: 'none' }}
            />
            <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={sending || !broadcast.trim()} onClick={() => void send()}>
              {sending ? 'YUBORILMOQDA…' : '📢 E’LON QILISH'}
            </button>
          </div>
          <div className="ghost-chat-note">E’lon faqat onlayn klientlarga yetadi.</div>
        </>
      )}
      <div className="spacer" />
    </div>
  );
}
