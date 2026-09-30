import type { PlayerCardView, PublicPlayer } from '@truemafia/shared';
import { ROLES } from '@truemafia/shared';
import { Avatar } from './Avatar';

interface Props {
  player: PlayerCardView | PublicPlayer;
  selected?: boolean;
  selectable?: boolean;
  disabled?: boolean;
  showRole?: boolean;
  voteCount?: number;
  onClick?: () => void;
  sub?: string;
}

export function PlayerCard({
  player,
  selected,
  selectable,
  disabled,
  showRole,
  voteCount,
  onClick,
  sub,
}: Props) {
  const alive = 'alive' in player ? player.alive : true;
  const role = showRole && 'role' in player && player.role ? ROLES[player.role] : null;
  const dead = !alive;
  return (
    <button
      className={`player-card ${selectable ? 'selectable' : ''} ${selected ? 'selected' : ''} ${
        dead ? 'dead' : ''
      }`}
      disabled={disabled || !selectable}
      onClick={() => {
        onClick?.();
      }}
    >
      <span className="seat">#{String(player.seat).padStart(2, '0')}</span>
      {voteCount ? <span className="vote-count">{voteCount}</span> : null}
      <Avatar src={player.photoUrl} name={player.displayName} size="md" />
      <span className="name">{player.displayName}</span>
      {role ? (
        <span className={`badge ${role.team === 'MAFIA' ? 'badge-red' : role.team === 'TOWN' ? 'badge-green' : ''}`}>
          {role.name}
        </span>
      ) : (
        sub ?? (
          <span className="row" style={{ gap: 5 }}>
            <span className={`dot ${player.connected === false ? 'off' : ''}`} />
            {player.isBot ? <span className="badge">BOT</span> : null}
          </span>
        )
      )}
    </button>
  );
}
