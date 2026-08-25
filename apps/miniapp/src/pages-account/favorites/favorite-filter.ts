/** Returns the favorite items that belong to the selected content category. */
export function filterFavorites<T extends { kind: string }>(
  items: readonly T[],
  activeKind: string,
): T[] {
  return items.filter((item) => item.kind === activeKind);
}
