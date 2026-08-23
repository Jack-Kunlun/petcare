import { describe, expect, it } from "vitest";
import { getPetFormMode } from "./pet-form-mode";

describe("getPetFormMode", () => {
  it("uses edit only when mode and id are both present", () => {
    expect(getPetFormMode({ mode: "edit", id: "mimi" })).toBe("edit");
    expect(getPetFormMode({ mode: "edit" })).toBe("add");
    expect(getPetFormMode({})).toBe("add");
  });
});
