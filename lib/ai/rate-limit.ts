type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 60 * 1000
};

const DEFAULT_MAX_BUCKETS = 2048;
const MAX_KEY_LENGTH = 160;

function positiveIntegerFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function maxBuckets() {
  return positiveIntegerFromEnv("AI_RATE_LIMIT_MAX_BUCKETS", DEFAULT_MAX_BUCKETS);
}

function normalizeKey(key: string) {
  const trimmed = key.trim();
  return (trimmed || "anonymous").slice(0, MAX_KEY_LENGTH);
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function setBucket(key: string, bucket: Bucket, now: number) {
  if (!buckets.has(key)) {
    pruneExpiredBuckets(now);
    const limit = maxBuckets();
    while (buckets.size >= limit) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      buckets.delete(oldestKey);
    }
  }

  buckets.delete(key);
  buckets.set(key, bucket);
}

export function checkServerRateLimit(key: string, now = Date.now()) {
  const bucketKey = normalizeKey(key);
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    setBucket(bucketKey, { count: 1, resetAt: now + LIMIT.windowMs }, now);
    return { allowed: true, remaining: LIMIT.maxRequests - 1, resetAt: now + LIMIT.windowMs };
  }

  if (current.count >= LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  setBucket(bucketKey, current, now);
  return { allowed: true, remaining: LIMIT.maxRequests - current.count, resetAt: current.resetAt };
}

export function resetServerRateLimitForTests() {
  buckets.clear();
}

export function getServerRateLimitBucketCountForTests(now = Date.now()) {
  pruneExpiredBuckets(now);
  return buckets.size;
}
