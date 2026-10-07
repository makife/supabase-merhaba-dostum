// user_presence.last_seen stores UTC without an offset; profiles dates include one.
export const parseProfileTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const normalized = value.trim().replace(" ", "T");
  const withTimezone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const timestamp = Date.parse(withTimezone);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const getProfileLastSeen = (
  createdAt: string | null | undefined,
  ...values: Array<string | null | undefined>
): string | null => {
  const joinedAt = parseProfileTimestamp(createdAt);
  const validTimes = values
    .map(parseProfileTimestamp)
    .filter((time): time is number => time !== null && (joinedAt === null || time >= joinedAt));
  return validTimes.length ? new Date(Math.max(...validTimes)).toISOString() : null;
};

export const PROFILE_DATE_TIME_ZONE = "Europe/Istanbul";