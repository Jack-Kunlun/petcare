export function getMessageTarget(
  kind: "system" | "order" | "interaction",
  referenceId: string | null,
): string | undefined {
  if (!referenceId) {
    return undefined;
  }

  if (kind === "order") {
    return `/pages-care/order/detail?id=${encodeURIComponent(referenceId)}`;
  }

  if (kind === "interaction") {
    return `/pages-content/community/article?id=${encodeURIComponent(referenceId)}`;
  }

  return undefined;
}
