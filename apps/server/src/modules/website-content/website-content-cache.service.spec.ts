import type { WebsitePublicContent } from "@petcare/shared-types";
import {
  WEBSITE_CONTENT_CACHE_TTL_SECONDS,
  WebsiteContentCacheService,
} from "./website-content-cache.service";

const publicContent: WebsitePublicContent = {
  contentKey: "home",
  businessVersion: 1,
  publishedAt: "2026-08-13T00:00:00.000Z",
  seo: {
    title: "PetCare",
    description: "PetCare official website",
    canonicalPath: "/",
    image: null,
  },
  sections: [],
};

describe("WebsiteContentCacheService", () => {
  it("configures the default Redis client with shared credentials and a bounded retry policy", async () => {
    const connect = jest.fn(async () => {
      throw new Error("redis unavailable");
    });
    const clientFactory = jest.fn(() => ({
      isOpen: false,
      connect,
      get: jest.fn(),
      setEx: jest.fn(),
    }));
    const service = new WebsiteContentCacheService({
      clientFactory,
      redis: { host: "redis.internal", port: 6380, password: "shared-secret" },
    });

    await expect(service.get("published-home-1")).resolves.toBeNull();
    expect(clientFactory).toHaveBeenCalledWith({
      socket: {
        host: "redis.internal",
        port: 6380,
        connectTimeout: 1_000,
        reconnectStrategy: false,
      },
      password: "shared-secret",
      disableOfflineQueue: true,
    });
  });

  it("lazily reads an immutable published-version cache entry", async () => {
    const client = {
      isOpen: false,
      connect: jest.fn(async () => {
        client.isOpen = true;
      }),
      get: jest.fn(async () => JSON.stringify(publicContent)),
      setEx: jest.fn(),
    };
    const clientFactory = jest.fn(() => client);
    const service = new WebsiteContentCacheService({ clientFactory });

    expect(clientFactory).not.toHaveBeenCalled();

    await expect(service.get("published-home-1")).resolves.toEqual(publicContent);
    expect(clientFactory).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith("website_content:version:published-home-1");
  });

  it("writes immutable version entries with the fixed twenty-four-hour TTL", async () => {
    const client = {
      isOpen: false,
      connect: jest.fn(async () => {
        client.isOpen = true;
      }),
      get: jest.fn(),
      setEx: jest.fn(),
    };
    const service = new WebsiteContentCacheService({ clientFactory: () => client });

    await expect(service.set("published-home-1", publicContent)).resolves.toBe(true);
    expect(client.setEx).toHaveBeenCalledWith(
      "website_content:version:published-home-1",
      WEBSITE_CONTENT_CACHE_TTL_SECONDS,
      JSON.stringify(publicContent),
    );
  });

  it("degrades cache connection failures to a miss instead of failing public reads", async () => {
    const client = {
      isOpen: false,
      connect: jest.fn(async () => {
        throw new Error("redis unavailable");
      }),
      get: jest.fn(),
      setEx: jest.fn(),
    };
    const service = new WebsiteContentCacheService({ clientFactory: () => client });

    await expect(service.get("published-home-1")).resolves.toBeNull();
    await expect(service.set("published-home-1", publicContent)).resolves.toBe(false);
    expect(client.get).not.toHaveBeenCalled();
    expect(client.setEx).not.toHaveBeenCalled();
  });
});
