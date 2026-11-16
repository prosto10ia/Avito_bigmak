export const isTelegram = () =>
  typeof window !== 'undefined' && Boolean((window as Window & { Telegram?: unknown }).Telegram);
export const platformLabel = () => (isTelegram() ? 'Telegram Mini App' : 'Браузерный демо-режим');
