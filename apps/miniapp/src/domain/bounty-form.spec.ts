import { describe, expect, it } from "vitest";
import { createEmptyBountyForm, formatBountyAmount, validateBountyForm } from "./bounty-form";

describe("bounty form", () => {
  const now = new Date(2026, 7, 30, 8, 0, 0, 0);
  const valid = {
    petId: "pet-1",
    serviceType: "feeding" as const,
    serviceDate: "2026-08-31",
    serviceClock: "09:30",
    amountYuan: "50.25",
    address: "  上海市示例地址  ",
    remark: "  请换水  ",
  };

  it("starts without invented commercial data and emits integer cents", () => {
    expect(createEmptyBountyForm()).toEqual({
      petId: "",
      serviceType: "",
      serviceDate: "",
      serviceClock: "",
      amountYuan: "",
      address: "",
      remark: "",
    });

    expect(validateBountyForm(valid, now)).toMatchObject({
      ok: true,
      request: {
        petId: "pet-1",
        serviceType: "feeding",
        amountCents: 5_025,
        address: "上海市示例地址",
        remark: "请换水",
      },
    });
  });

  it("rejects past times, fractional cents, and invalid calendar dates", () => {
    expect(
      validateBountyForm({ ...valid, serviceDate: "2026-08-30", serviceClock: "07:59" }, now),
    ).toMatchObject({ ok: false, field: "serviceDate" });
    expect(validateBountyForm({ ...valid, amountYuan: "50.001" }, now)).toMatchObject({
      ok: false,
      field: "amountYuan",
    });
    expect(validateBountyForm({ ...valid, serviceDate: "2026-02-30" }, now)).toMatchObject({
      ok: false,
      field: "serviceDate",
    });
  });

  it("formats cents without floating-point rounding", () => {
    expect(formatBountyAmount(5_000)).toBe("¥50");
    expect(formatBountyAmount(5_025)).toBe("¥50.25");
  });
});
