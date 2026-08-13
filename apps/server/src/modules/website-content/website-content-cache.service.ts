import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { WebsitePublicContent } from "@petcare/shared-types";
import { createClient } from "redis";
import { ConfigService } from "../../config/config.service";

/** Fixed TTL for immutable published Website Content snapshots. */
export const WEBSITE_CONTENT_CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Narrow Redis capability owned solely by Website Content's best-effort cache. */
export interface WebsiteContentCacheClient {
  readonly isOpen: boolean;
  connect(): Promise<unknown>;
  get(key: string): Promise<unknown>;
  setEx(key: string, ttl: number, value: string): Promise<unknown>;
  quit?(): Promise<unknown>;
}

/** Construction options kept local until the typed Website cache configuration lands. */
export interface WebsiteContentCacheServiceOptions {
  clientFactory?: () => WebsiteContentCacheClient;
  ttlSeconds?: number;
}

/** Returns the immutable Redis key for one published Website Content version. */
export function websiteContentCacheKey(versionId: string): string {
  return `website_content:version:${versionId}`;
}

function isPublicContent(value: unknown): value is WebsitePublicContent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WebsitePublicContent>;

  return (
    typeof candidate.contentKey === "string" &&
    typeof candidate.businessVersion === "number" &&
    typeof candidate.publishedAt === "string" &&
    Array.isArray(candidate.sections)
  );
}

/**
 * Best-effort cache for immutable published Website Content versions.
 *
 * It intentionally owns a separate lazy client and never affects the auth/session
 * Redis policy. Connection, read, and write failures are cache misses.
 */
@Injectable()
export class WebsiteContentCacheService implements OnModuleDestroy {
  private readonly clientFactory: () => WebsiteContentCacheClient;
  private readonly ttlSeconds: number;
  private client: WebsiteContentCacheClient | null = null;
  private connecting: Promise<WebsiteContentCacheClient | null> | null = null;

  constructor(options: WebsiteContentCacheServiceOptions | ConfigService = {}) {
    const serviceOptions = options instanceof ConfigService
      ? { ttlSeconds: options.websiteContentCacheTtlSeconds }
      : options;

    this.clientFactory = serviceOptions.clientFactory ?? (() => createClient());
    this.ttlSeconds = serviceOptions.ttlSeconds ?? WEBSITE_CONTENT_CACHE_TTL_SECONDS;
  }

  /** Reads a previously cached immutable published version, or returns a cache miss. */
  async get(versionId: string): Promise<WebsitePublicContent | null> {
    try {
      const client = await this.connectedClient();

      if (!client) {
        return null;
      }

      const raw = await client.get(websiteContentCacheKey(versionId));

      if (typeof raw !== "string") {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);

      return isPublicContent(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** Stores one immutable published version and reports whether Redis accepted it. */
  async set(versionId: string, content: WebsitePublicContent): Promise<boolean> {
    try {
      const client = await this.connectedClient();

      if (!client) {
        return false;
      }

      await client.setEx(websiteContentCacheKey(versionId), this.ttlSeconds, JSON.stringify(content));

      return true;
    } catch {
      return false;
    }
  }

  /** Closes this module's independent lazy client only when it was actually opened. */
  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen && this.client.quit) {
      try {
        await this.client.quit();
      } catch {
        // A best-effort cache must not delay shutdown.
      }
    }
  }

  private async connectedClient(): Promise<WebsiteContentCacheClient | null> {
    const client = this.client ?? this.createClient();

    if (client.isOpen) {
      return client;
    }

    if (!this.connecting) {
      this.connecting = client
        .connect()
        .then(() => client)
        .catch(() => null)
        .finally(() => {
          this.connecting = null;
        });
    }

    return this.connecting;
  }

  private createClient(): WebsiteContentCacheClient {
    const client = this.clientFactory();

    this.client = client;

    return client;
  }
}
