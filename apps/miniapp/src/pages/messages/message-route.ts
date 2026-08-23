export function getMessageTarget(
  kind: "system" | "order" | "interaction",
  id: string,
): string | undefined {
  if (kind === "order") {
    return `/pages-care/order/detail?id=${encodeURIComponent(id)}`;
  }

  if (kind === "interaction") {
    return `/pages-care/chat/index?userId=${encodeURIComponent(id)}`;
  }

  return undefined;
}
