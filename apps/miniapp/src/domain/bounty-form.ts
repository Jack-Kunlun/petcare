import {
  BOUNTY_LIMITS,
  BOUNTY_SERVICE_TYPE,
  BOUNTY_SERVICE_TYPE_LABELS,
} from "@petcare/shared-types";
import type { BountyServiceType, CreateBountyRequest } from "@petcare/shared-types";

/** Writable fields owned by the Cycle 5 bounty form. */
export interface BountyForm {
  petId: string;
  serviceType: BountyServiceType | "";
  serviceDate: string;
  serviceClock: string;
  amountYuan: string;
  address: string;
  remark: string;
}

/** Form field that receives the nearest validation message. */
export type BountyFormField = keyof BountyForm;

/** Validated request or one actionable form error. */
export type BountyFormValidation =
  | { ok: true; request: CreateBountyRequest }
  | { ok: false; field: BountyFormField; message: string };

/** Stable selector options derived only from the shared service catalog. */
export const BOUNTY_SERVICE_OPTIONS = Object.values(BOUNTY_SERVICE_TYPE).map((value) => ({
  value,
  label: BOUNTY_SERVICE_TYPE_LABELS[value],
}));

/** Creates a blank form without inventing a pet, service, time, or price. */
export function createEmptyBountyForm(): BountyForm {
  return {
    petId: "",
    serviceType: "",
    serviceDate: "",
    serviceClock: "",
    amountYuan: "",
    address: "",
    remark: "",
  };
}

/** Converts user-facing date and yuan input into the strict shared request. */
export function validateBountyForm(form: BountyForm, now = new Date()): BountyFormValidation {
  if (!form.petId) {
    return { ok: false, field: "petId", message: "请选择需要照护的宠物" };
  }

  if (!form.serviceType || !Object.values(BOUNTY_SERVICE_TYPE).includes(form.serviceType)) {
    return { ok: false, field: "serviceType", message: "请选择服务类型" };
  }

  const serviceTime = parseLocalDateTime(form.serviceDate, form.serviceClock);

  if (!serviceTime || serviceTime.getTime() <= now.getTime()) {
    return { ok: false, field: "serviceDate", message: "请选择晚于当前时间的服务日期和时间" };
  }

  const amountCents = parseYuanToCents(form.amountYuan);

  if (
    amountCents === null ||
    amountCents < BOUNTY_LIMITS.AMOUNT_MIN_CENTS ||
    amountCents > BOUNTY_LIMITS.AMOUNT_MAX_CENTS
  ) {
    return {
      ok: false,
      field: "amountYuan",
      message: `悬赏金额应为 ${BOUNTY_LIMITS.AMOUNT_MIN_CENTS / 100} 至 ${BOUNTY_LIMITS.AMOUNT_MAX_CENTS / 100} 元，最多两位小数`,
    };
  }

  const address = form.address.trim();

  if (!validText(address, BOUNTY_LIMITS.ADDRESS_MAX_LENGTH, false)) {
    return {
      ok: false,
      field: "address",
      message: `请填写 1 至 ${BOUNTY_LIMITS.ADDRESS_MAX_LENGTH} 个字符的服务地址`,
    };
  }

  const remark = form.remark.trim();

  if (!validText(remark, BOUNTY_LIMITS.REMARK_MAX_LENGTH, true)) {
    return {
      ok: false,
      field: "remark",
      message: `备注不能超过 ${BOUNTY_LIMITS.REMARK_MAX_LENGTH} 个字符`,
    };
  }

  return {
    ok: true,
    request: {
      petId: form.petId,
      serviceType: form.serviceType,
      serviceTime: serviceTime.toISOString(),
      amountCents,
      address,
      remark: remark || null,
    },
  };
}

/** Formats integer cents for display without floating-point business arithmetic. */
export function formatBountyAmount(amountCents: number): string {
  const yuan = Math.trunc(amountCents / 100);
  const cents = Math.abs(amountCents % 100);

  return cents === 0 ? `¥${yuan}` : `¥${yuan}.${cents.toString().padStart(2, "0")}`;
}

function parseYuanToCents(value: string): number | null {
  const normalized = value.trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/u.test(normalized)) {
    return null;
  }

  const [yuan, fraction = ""] = normalized.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(cents) ? cents : null;
}

function parseLocalDateTime(date: string, clock: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/u.exec(clock);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const value = new Date(year, month - 1, day, hour, minute, 0, 0);

  return value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === day &&
    value.getHours() === hour &&
    value.getMinutes() === minute
    ? value
    : null;
}

function validText(value: string, maxLength: number, optional: boolean): boolean {
  return (optional || value.length > 0) && value.length <= maxLength && !/\p{Cc}/u.test(value);
}
