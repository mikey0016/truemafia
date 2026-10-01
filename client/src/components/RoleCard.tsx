import { useEffect, useState } from 'react';
import type { RoleId } from '@truemafia/shared';
import { ROLES } from '@truemafia/shared';
import { haptic, hapticNotify } from '../services/telegram';
import { playSound } from '../services/sound';

const ICONS: Record<string, string> = {
  user: '🧑',
  skull: '💀',
  crown: '👑',
  plus: '⚕️',
  search: '🔍',
  shield: '🛡️',
  knife: '🔪',
  masks: '🎭',
  drop: '🩸',
};

export function RoleCard({ role, onClose }: { role: RoleId; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const def = ROLES[role];
  const glowClass =
    def.team === 'MAFIA' ? 'card-glow-mafia' : def.team === 'TOWN' ? 'card-glow-town' : 'card-glow-indep';

  useEffect(() => {
    setFlipped(false);
  }, [role]);

  const flip = () => {
    if (flipped) return;
    setFlipped(true);
    playSound('cardFlip');
    haptic('medium');
    hapticNotify('success');
  };

  return (
    <div className="role-stage">
      <div className={`role-card ${flipped ? 'flipped' : ''}`} onClick={flip}>
        {/* FRONT — yopiq karta */}
        <div className="role-face front card-glow-unknown">
          <div className="role-shine" />
          <div className="label">YOUR ROLE</div>
          <div style={{ fontSize: '3.8rem', animation: 'floaty 3.2s ease-in-out infinite' }}>🌙</div>
          <div className="role-name" style={{ fontSize: '1.3rem', color: 'var(--text-dim)' }}>
            ????
          </div>
          <div className="role-divider" />
          <div className="role-tagline" style={{ color: 'var(--gold)', animation: 'hintPulse 2s ease-in-out infinite' }}>
            TAP TO REVEAL
          </div>
        </div>

        {/* BACK — rol */}
        <div className={`role-face back ${glowClass}`}>
          <div className="role-shine" />
          <div className="role-icon">{ICONS[def.icon] ?? '🎭'}</div>
          <div className="role-name" style={{ color: def.color }}>
            {def.name.toUpperCase()}
          </div>
          <div className="role-tagline">{def.tagline}</div>
          <div className="role-divider" />
          <div className="role-desc">{def.description}</div>
          <div className="role-desc" style={{ color: def.color, fontWeight: 700 }}>
            {def.ability}
          </div>
        </div>
      </div>

      {/* holat ko'rsatkichi — flashcard ekanligi aniq bo'lishi uchun */}
      {!flipped && <div className="role-hint">👆 KARTANI BOSING</div>}

      {flipped && (
        <button
          className="btn btn-primary"
          style={{ position: 'absolute', bottom: '6%', width: 'min(70vw, 260px)' }}
          onClick={() => {
            haptic('light');
            onClose();
          }}
        >
          UNDERSTOOD ✓
        </button>
      )}
    </div>
  );
}
