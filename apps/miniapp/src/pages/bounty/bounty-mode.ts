export function getBountyMode(query: Record<string, unknown>): "list" | "map" {
  return query.mode === "map" ? "map" : "list";
}
