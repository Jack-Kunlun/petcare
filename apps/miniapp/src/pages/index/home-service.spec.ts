import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";
import { computed, ref, watch } from "vue";

function createHome() {
  let revision = 1;
  const apis = {
    getMyBounties: vi.fn().mockResolvedValue({ list: [], total: 0 }),
    getMyBountyIntents: vi.fn().mockResolvedValue({ list: [], total: 0 }),
    getBountySop: vi.fn().mockResolvedValue({ steps: [] }),
  };
  const session = {
    session: { user: { id: "owner" } as { id: string } | null },
    captureSessionUserRevision: () => ({ revision, userId: session.session.user?.id }),
    isSessionUserRevisionCurrent: (value: { revision: number }) => value.revision === revision,
  };
  const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/u)![1];
  const compiled = transpileModule(script, {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  const home = runInNewContext(`${compiled}\n({ loadService, service, sop, serviceError });`, {
    exports: {},
    definePage: () => undefined,
    require: (name: string) => {
      if (name === "vue") {
        return { computed, ref, watch };
      }

      if (name === "@/api/bounties") {
        return apis;
      }

      if (name === "@/state/session") {
        return session;
      }

      if (name === "@/config/features") {
        return { commercialServicesEnabled: true };
      }

      if (name === "@dcloudio/uni-app") {
        return {
          onShow: () => undefined,
          onShareAppMessage: () => undefined,
          onShareTimeline: () => undefined,
        };
      }

      return {};
    },
  });

  return {
    home,
    apis,
    changeAccount: () => {
      revision += 1;
      session.session.user = null;
    },
  };
}

describe("home service data", () => {
  it("finds an active service beyond the first page", async () => {
    const { home, apis } = createHome();

    apis.getMyBounties
      .mockResolvedValueOnce({ list: [], total: 51 })
      .mockResolvedValueOnce({ list: [{ id: "older-active", status: "in_progress" }], total: 51 });
    await home.loadService();
    expect(home.service.value.id).toBe("older-active");
    expect(apis.getMyBounties).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 });
  });
  it("uses a confirmed provider intent and its real SOP instead of a rejected intent", async () => {
    const { home, apis } = createHome();

    apis.getMyBountyIntents.mockResolvedValue({
      list: [
        { status: "rejected", bounty: { id: "rejected", status: "in_progress" } },
        { status: "confirmed", bounty: { id: "active", status: "in_progress" } },
      ],
    });
    await home.loadService();
    expect(home.service.value.id).toBe("active");
    expect(apis.getBountySop).toHaveBeenCalledWith("active");
  });

  it("discards private data returned after the account changes", async () => {
    const { home, apis, changeAccount } = createHome();

    apis.getMyBounties.mockImplementation(async () => {
      changeAccount();

      return { list: [{ id: "other-owner", status: "in_progress" }] };
    });
    await home.loadService();
    expect(home.service.value).toBeNull();
    expect(apis.getBountySop).not.toHaveBeenCalled();
  });

  it("keeps request failure as an error without inventing a service", async () => {
    const { home, apis } = createHome();

    apis.getMyBounties.mockRejectedValue(new Error("offline"));
    await home.loadService();
    expect(home.service.value).toBeNull();
    expect(home.serviceError.value).toBe(true);
  });
});
