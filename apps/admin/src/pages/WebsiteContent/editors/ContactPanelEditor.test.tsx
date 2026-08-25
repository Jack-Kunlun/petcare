import type { WebsiteContactPanelSection } from "@petcare/shared-types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactPanelEditor } from "./ContactPanelEditor";

const section: WebsiteContactPanelSection = {
  sectionKey: "contact_channels",
  sectionType: "contact_panel",
  sortOrder: 2,
  isEnabled: true,
  schemaVersion: 1,
  content: {
    title: "联系渠道",
    description: "请选择公开渠道",
    channels: [
      {
        channelKey: "customer_service",
        label: "客服电话",
        value: "待运营配置",
        href: "/contact",
        availability: "工作时间待运营配置",
        isEnabled: false,
      },
      {
        channelKey: "business",
        label: "商务合作",
        value: "business@example.com",
        href: "mailto:business@example.com",
        availability: "工作日 09:00–18:00",
      },
    ],
  },
  settings: { columns: 2 },
};

describe("ContactPanelEditor", () => {
  it("exposes an accessible visibility checkbox for every fixed channel", () => {
    const onChange = vi.fn();

    render(<ContactPanelEditor section={section} onChange={onChange} />);

    const customerService = screen.getByRole("checkbox", { name: "显示联系渠道 客服电话" });
    const legacyBusiness = screen.getByRole("checkbox", { name: "显示联系渠道 商务合作" });

    expect(customerService).not.toBeChecked();
    expect(legacyBusiness).toBeChecked();

    fireEvent.click(customerService);

    expect(onChange).toHaveBeenCalledWith({
      ...section,
      content: {
        ...section.content,
        channels: [
          { ...section.content.channels[0], isEnabled: true },
          section.content.channels[1],
        ],
      },
    });
  });
});
