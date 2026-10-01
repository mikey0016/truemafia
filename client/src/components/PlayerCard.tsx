import type { PlayerCardView, PublicPlayer } from '@truemafia/shared';
import { ROLES } from '@truemafia/shared';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

interface Props {
  player: PlayerCardView | PublicPlayer;
  selected?: boolean;
  selectable?: boolean;
  disabled?: boolean;
  showRole?: boolean;
  voteCount?: number;
  voteFraction?: number;
  onClick?: () => void;
  sub?: string;
  me?: boolean;
  ally?: boolean;
  voteLocked?: boolean;
}

export function PlayerCard({
  player,
  selected,
  selectable,
  disabled,
  showRole,
  voteCount,
  voteFraction,
  onClick,
  sub,
  me,
  ally,
  voteLocked,
}: Props) {
  const alive = 'alive' in player ? player.alive : true;
  const role = showRole && 'role' in player && player.role ? ROLES[player.role] : null;
  const dead = !alive;
  return (
    <button
      className={`player-card ${selectable ? 'selectable' : ''} ${selected ? 'selected' : ''} ${
        dead ? 'dead' : ''
      } ${me ? 'me' : ''} ${ally ? 'ally' : ''}`}
      disabled={disabled || (!selectable && !showRole && !me)}
      onClick={() => {
        onClick?.();
      }}
    >
      <span className="seat">#{String(player.seat).padStart(2, '0')}</span>
      {me && !dead && <span className="me-tag">SIZ</span>}
      {voteCount ? <span className="vote-count">{voteCount}</span> : null}
      <Avatar src={player.photoUrl} name={player.displayName} size="md" />
      <span className="name">{player.displayName}</span>
      {'title' in player && player.title && (
        <span className="badge badge-gold" style={{ fontSize: '0.52rem', padding: '2px 7px' }}>
          «{player.title}»
        </span>
      )}
      {dead && <span className="dead-mark">✕</span>}
      {role ? (
        <span
          className="badge"
          style={{
            color: role.color,
            borderColor: `${role.color}66`,
            background: `${role.color}1c`,
          }}
        >
          {role.name}
        </span>
      ) : sub ? (
        <span className="badge">{sub}</span>
      ) : player.isBot ? (
        <span className="badge">BOT</span>
      ) : (
        <span className="row" style={{ gap: 5, minHeight: 22 }}>
          <span className={`dot ${player.connected === false ? 'off' : ''}`} />
        </span>
      )}
      {voteFraction !== undefined && voteFraction > 0 && (
        <div className="vote-bar">
          <div style={{ width: `${Math.round(voteFraction * 100)}%` }} />
        </div>
      )}
      {voteLocked && (
        <span className="badge badge-gold" style={{ marginTop: 2 }}>
          <Icon name="check" size={11} /> OVOZ
        </span>
      )}
    </button>
  );
}
