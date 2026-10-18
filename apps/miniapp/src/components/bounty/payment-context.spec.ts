import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

function createPanel() {
  let current = true;
  let unmount: (() => void) | undefined;
  const nativePayment = vi.fn();
  const api = {
    getOrderPayment: vi.fn(),
    prepayOrder: vi.fn(),
    refreshOrderPayment: vi.fn(),
    simulateOrderPayment: vi.fn(),
  };
  const source = readFileSync(resolve(import.meta.dirname, "BountyPaymentPanel.vue"), "utf8");
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/u)![1];
  const compiled = transpileModule(script, {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  const panel = runInNewContext(`${compiled}\n({load, pay, status, payment});`, {
    exports: {},
    uni: { requestPayment: nativePayment },
    defineProps: () => ({ orderId: "owned-order", amountCents: 100 }),
    require: (name: string) => {
      if (name === "vue") {
        return {
          ref,
          onMounted: () => undefined,
          watch: () => undefined,
          onUnmounted: (callback: () => undefined) => {
            unmount = callback;
          },
        };
      }

      if (name === "@/api/payment") {
        return api;
      }

      if (name === "@/config/features") {
        return { paymentSimulationEnabled: false };
      }

      if (name === "@/state/session") {
        return {
          session: { user: { id: "owner" } },
          captureSessionUserRevision: () => ({}),
          isSessionUserRevisionCurrent: () => current,
        };
      }

      return {};
    },
  });

  return {
    panel,
    api,
    nativePayment,
    changeAccount: () => {
      current = false;
    },
    unmount: () => unmount?.(),
  };
}

describe("payment context isolation", () => {
  it("never opens native payment after the prepay response belongs to an old account", async () => {
    const { panel, api, nativePayment, changeAccount } = createPanel();

    panel.status.value = "ready";
    api.prepayOrder.mockImplementation(async () => {
      changeAccount();

      return { payment: { status: "pending" }, parameters: {} };
    });
    await panel.pay();
    expect(nativePayment).not.toHaveBeenCalled();
    expect(api.refreshOrderPayment).not.toHaveBeenCalled();
    expect(panel.payment.value).toBeNull();
  });

  it("discards a payment lookup after the panel unmounts", async () => {
    const { panel, api, unmount } = createPanel();

    api.getOrderPayment.mockImplementation(async () => {
      unmount();

      return { status: "succeeded" };
    });
    await panel.load();
    expect(panel.payment.value).toBeNull();
    expect(panel.status.value).toBe("loading");
  });
});
