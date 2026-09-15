export const IN_GAME_ACTIVITY_STALE_MS = 12_000;
export const IN_GAME_STATUS_POLL_MS = 3_000;

export const getInGameActivityThreshold = () => new Date(Date.now() - IN_GAME_ACTIVITY_STALE_MS).toISOString();