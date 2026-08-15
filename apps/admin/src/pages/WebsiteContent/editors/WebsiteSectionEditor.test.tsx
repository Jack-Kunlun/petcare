import type { WebsiteSiteHeaderSection } from "@petcare/shared-types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebsiteSectionEditor } from "./WebsiteSectionEditor";

const siteHeader: WebsiteSiteHeaderSection = {
  sectionKey: "site_header",
  sectionType: "site_header",
  sortOrder: 1,
  isEnabled: true,
  schemaVersion: 1,
  content: {
    brandLabel: "PetCare 宠伴",
    navigation: [{ itemKey: "services", label: "服务模式", href: "/services" }],
    action: { label: "联系我们", href: "/contact" },
  },
  settings: { sticky: true },
};

describe("WebsiteSectionEditor", () => {
  it("renders the typed site-header fields without exposing section composition controls", () => {
    const onChange = vi.fn();

    render(<WebsiteSectionEditor section={siteHeader} onChange={onChange} />);

    const brandLabel = screen.getByRole("textbox", { name: "品牌名称" });

    expect(brandLabel).toHaveValue("PetCare 宠伴");
    expect(screen.getByRole("checkbox", { name: "滚动时固定页头" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "导航项 服务模式 文案" })).toHaveValue("服务模式");
    expect(
      screen.queryByRole("button", { name: /新增区块|删除区块|更换区块类型|拖拽排序/ }),
    ).toBeNull();

    fireEvent.change(brandLabel, { target: { value: "PetCare" } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sectionKey: "site_header",
        sectionType: "site_header",
        sortOrder: 1,
        content: expect.objectContaining({ brandLabel: "PetCare" }),
      }),
    );
  });
});
