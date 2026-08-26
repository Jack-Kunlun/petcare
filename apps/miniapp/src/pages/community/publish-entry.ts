import { requireProfile } from "../../state/session";

interface PendingState {
  value: boolean;
}

/** Opens the community publisher once the current user has a complete profile. */
export async function openCommunityPublishEntry(pending: PendingState): Promise<void> {
  if (pending.value) {
    return;
  }

  pending.value = true;

  try {
    if (await requireProfile("/pages-content/community/publish")) {
      await uni.navigateTo({ url: "/pages-content/community/publish" });
    }
  } finally {
    pending.value = false;
  }
}
