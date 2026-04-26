type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 60 * 1000
};

export function checkServerRateLimit(key: string, now = Date.now()) {
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + LIMIT.windowMs });
    return { allowed: true, remaining: LIMIT.maxRequests - 1, resetAt: now + LIMIT.windowMs };
  }

  if (current.count >= LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, remaining: LIMIT.maxRequests - current.count, resetAt: current.resetAt };
}
