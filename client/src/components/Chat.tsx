import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, GameSnapshot } from '@truemafia/shared';
import { CHAT_MAX_LEN } from '@truemafia/shared';
import { Avatar } from './Avatar';
import { getSocket } from '../services/socket';
import { haptic } from '../services/telegram';
import { useGameStore } from '../store/gameStore';

const CHANNEL_LABEL: Record<string, string> = {
  day: 'SHAHAR',
  mafia: 'MAFIYA',
  ghosts: 'ARVOHLAR',
};

export function Chat({ snapshot }: { snapshot: GameSnapshot }) {
  const messages = useGameStore((s) => s.chatMessages);
  const [channel, setChannel] = useState<'day' | 'mafia' | 'ghosts'>(snapshot.channels[0] ?? 'day');
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const myId = snapshot.you.userId;

  useEffect(() => {
    if (!snapshot.channels.includes(channel) && snapshot.channels.length > 0) {
      setChannel(snapshot.channels[0]);
    }
  }, [snapshot.channels, channel]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    const socket = getSocket();
    const onTyping = (p: { channel: string; name: string }) => {
      if (p.channel !== channel) return;
      setTyping(p.name);
      setTimeout(() => setTyping((cur) => (cur === p.name ? null : cur)), 1800);
    };
    socket.on('typing', onTyping);
    return () => {
      socket.off('typing', onTyping);
    };
  }, [channel]);

  const visible = messages.filter((m) => m.channel === channel);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    haptic('light');
    getSocket().emit('chat:send', { channel, text: t }, (res) => {
        if (!res.ok) useGameStore.getState().pushToast('error', res.error ?? 'Yuborilmadi');
    });
    setText('');
  };

  const canChat =
    (channel === 'day' && snapshot.you.alive) ||
    (channel === 'mafia' && snapshot.you.alive) ||
    channel === 'ghosts';

  return (
    <div className="chat">
      {snapshot.channels.length > 1 && (
        <div className="tabbar">
          {snapshot.channels.map((c) => (
            <button
              key={c}
              className={c === channel ? 'active' : ''}
              onClick={() => {
                haptic('light');
                setChannel(c);
              }}
            >
              {CHANNEL_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      )}
      <div className="chat-scroll" ref={scrollRef}>
        {visible.length === 0 && (
          <div className="empty-state">
            Hali xabar yo‘q.{channel === 'ghosts' ? ' Nariqdan kuzatyapsiz…' : ' Sukunatni buzing.'}
          </div>
        )}
        {visible.map((m: ChatMessage) =>
          m.senderId === 0 ? (
            <div key={m.id} className="chat-msg system">
              <div className="bubble">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className={`chat-msg ${m.senderId === myId ? 'mine' : ''}`}>
              <Avatar src={m.photoUrl} name={m.senderName} size="sm" />
              <div className="bubble">
                <div className="label" style={{ marginBottom: 2, color: m.senderId === myId ? 'var(--gold)' : undefined }}>
                  {m.senderName}
                </div>
                {m.text}
              </div>
            </div>
          ),
        )}
        {typing && <div className="ghost-chat-note">{typing} yozyapti…</div>}
      </div>
      {canChat ? (
        <div className="chat-input-row">
          <input
            value={text}
            maxLength={CHAT_MAX_LEN}
            placeholder="Xabar…"
            onChange={(e) => {
              setText(e.target.value);
              getSocket().emit('chat:typing', { channel });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
          />
          <button className="btn" style={{ width: 56, flexShrink: 0 }} onClick={send}>
            ➤
          </button>
        </div>
      ) : (
        <div className="ghost-chat-note">
          {channel === 'day' ? 'Sizda so‘z yo‘q (o‘lganlar gapirolmaydi).' : ''}
        </div>
      )}
    </div>
  );
}
