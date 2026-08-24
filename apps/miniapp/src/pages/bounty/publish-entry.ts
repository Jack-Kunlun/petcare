import { requireProfile } from "../../state/session";

interface PendingState {
  value: boolean;
}

export async function openPublishEntry(pending: PendingState): Promise<void> {
  if (pending.value) {
    return;
  }

  pending.value = true;

  try {
    if (await requireProfile("/pages-bounty/publish/step1")) {
      await uni.navigateTo({ url: "/pages-bounty/publish/step1" });
    }
  } finally {
    pending.value = false;
  }
}
