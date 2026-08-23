export function getPetFormMode(query: Record<string, unknown>): "add" | "edit" {
  return query.mode === "edit" && typeof query.id === "string" && query.id ? "edit" : "add";
}
