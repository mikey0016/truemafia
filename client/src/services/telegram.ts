export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser };
  colorScheme: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  MainButton: {
    setText: (t: { text: string }) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export const tg: TelegramWebApp | null =
  typeof window !== 'undefined' && window.Telegram?.WebApp ? window.Telegram.WebApp : null;

export function initTelegram(): void {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.('#0a0b0f');
  tg.setBackgroundColor?.('#0a0b0f');
  tg.disableVerticalSwipes?.();
}

export function getTgUser(): TgUser | null {
  if (!tg) return null;
  return tg.initDataUnsafe?.user ?? null;
}

export function getInitData(): string {
  return tg?.initData ?? '';
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  tg?.HapticFeedback.impactOccurred(style);
}

export function hapticNotify(type: 'success' | 'error' | 'warning'): void {
  tg?.HapticFeedback.notificationOccurred(type);
}

export function setBackButton(show: boolean, onClick?: () => void): () => void {
  if (!tg) return () => {};
  const bb = tg.BackButton;
  if (show) {
    if (onClick) bb.onClick(onClick);
    bb.show();
    return () => {
      if (onClick) bb.offClick(onClick);
      bb.hide();
    };
  }
  bb.hide();
  return () => {};
}

const waiters: (() => void)[] = [];
let mainBtnHandler: (() => void) | null = null;

export function showMainButton(text: string, onClick: () => void, opts: { active?: boolean } = {}): () => void {
  if (!tg) return () => {};
  const mb = tg.MainButton;
  if (mainBtnHandler) mb.offClick(mainBtnHandler);
  mainBtnHandler = onClick;
  mb.setText({ text });
  mb.onClick(onClick);
  mb.enable();
  mb.show();
  waiters.length = 0;
  return () => {
    mb.offClick(onClick);
    mb.hide();
    mainBtnHandler = null;
  };
}

export function hideMainButton(): void {
  tg?.MainButton.hide();
}
