const APNS_TOKEN_REGEX = /^[A-F0-9]{64}$/;
const FCM_TOKEN_MIN_LENGTH = 80;

export const normalizePushToken = (token?: string | null): string => token?.trim() ?? "";

export const isApnsTokenFormat = (token?: string | null): boolean => {
  const normalized = normalizePushToken(token);
  return APNS_TOKEN_REGEX.test(normalized);
};

export const isValidFcmToken = (token?: string | null): boolean => {
  const normalized = normalizePushToken(token);
  return Boolean(normalized) && normalized.length >= FCM_TOKEN_MIN_LENGTH && normalized.includes(":") && !isApnsTokenFormat(normalized);
};

export const getValidFcmToken = (token?: string | null): string | null => {
  const normalized = normalizePushToken(token);
  return isValidFcmToken(normalized) ? normalized : null;
};
