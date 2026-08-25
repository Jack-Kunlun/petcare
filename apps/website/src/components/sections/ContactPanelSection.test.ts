import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("ContactPanelSection", () => {
  it("renders only visible channels and keeps non-executable values informational", async () => {
    const source = await readFile(new URL("./ContactPanelSection.astro", import.meta.url), "utf8");

    expect(source).toMatch(
      /section\.content\.channels\s*\.filter\(\(channel\) => channel\.isEnabled !== false\)\s*\.map/u,
    );
    expect(source).toContain(
      "{href ? <a href={href}>{channel.value}</a> : <span>{channel.value}</span>}",
    );
  });
});
