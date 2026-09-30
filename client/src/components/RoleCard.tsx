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
    // subtle entrance handled by CSS; mark flipped=false initially
    setFlipped(false);
  }, [role]);

  return (
    <div className="role-stage">
      <div
        className={`role-card ${flipped ? 'flipped' : ''}`}
        onClick={() => {
          if (!flipped) {
            setFlipped(true);
            playSound('cardFlip');
            haptic('medium');
            hapticNotify('success');
          }
        }}
      >
        {/* FRONT — face down */}
        <div className="role-face front card-glow-unknown">
          <div className="role-shine" />
          <div className="label">YOUR ROLE</div>
          <div style={{ fontSize: '3.6rem' }}>🌙</div>
          <div className="role-name" style={{ fontSize: '1.3rem' }}>
            UNKNOWN
          </div>
          <div className="role-tagline">TAP TO REVEAL</div>
        </div>

        {/* BACK — the role */}
        <div className={`role-face back ${glowClass}`} style={{ background: 'linear-gradient(165deg, #181a22, #0e1015)' }}>
          <div className="role-shine" />
          <div className="role-icon">{ICONS[def.icon] ?? '🎭'}</div>
          <div className="role-name" style={{ color: def.color }}>
            {def.name.toUpperCase()}
          </div>
          <div className="role-tagline">{def.tagline}</div>
          <div className="role-divider" />
          <div className="role-desc">{def.description}</div>
          <div className="role-desc" style={{ color: def.color }}>
            {def.ability}
          </div>
        </div>
      </div>

      {flipped && (
        <button
          className="btn btn-ghost"
          style={{ position: 'absolute', bottom: '12%', width: 'min(70vw, 260px)' }}
          onClick={() => {
            haptic('light');
            onClose();
          }}
        >
          CLOSE
        </button>
      )}
    </div>
  );
}
