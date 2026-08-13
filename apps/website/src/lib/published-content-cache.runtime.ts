import { PublishedContentCache } from "./published-content-cache";

let cache: PublishedContentCache | undefined;
let cacheTtlMilliseconds: number | undefined;

/** Returns the process-local cache used only for recent published SSR snapshots. */
export function getPublishedContentCache(ttlMilliseconds: number): PublishedContentCache {
  if (!cache || cacheTtlMilliseconds !== ttlMilliseconds) {
    cache = new PublishedContentCache({ ttlMilliseconds });
    cacheTtlMilliseconds = ttlMilliseconds;
  }

  return cache;
}
