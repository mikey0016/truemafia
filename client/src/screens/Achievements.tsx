import { ACHIEVEMENTS } from '@truemafia/shared';
import { useGameStore } from '../store/gameStore';
import { ScreenHeader } from '../components/ScreenHeader';

export function Achievements() {
  const profile = useGameStore((s) => s.profile);

  const unlocked = new Map((profile?.achievements ?? []).map((a) => [a.id, a.unlockedAt]));

  return (
    <div className="screen">
      <ScreenHeader title="YUTUQLAR" />
      <div className="dim" style={{ fontSize: '0.85rem' }}>
        {unlocked.size}/{ACHIEVEMENTS.length} ochilgan
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACHIEVEMENTS.map((a) => {
          const has = unlocked.has(a.id);
          return (
            <div key={a.id} className={`achievement-card ${has ? '' : 'locked'} ${a.rare ? 'rare' : ''}`}>
              <div className="achievement-icon">🎖️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>{a.name}</div>
                <div className="dim" style={{ fontSize: '0.8rem' }}>{a.description}</div>
              </div>
              {has ? <span className="badge badge-green">✓</span> : <span className="badge">🔒</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
