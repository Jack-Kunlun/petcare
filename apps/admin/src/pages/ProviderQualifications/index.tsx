import {
  PROVIDER_QUALIFICATION_MATERIAL_KIND,
  PROVIDER_QUALIFICATION_STATUS,
  type ProviderQualificationMaterialKind,
  type ProviderQualificationStatus,
} from "@petcare/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  fetchQualification,
  fetchQualificationMaterial,
  fetchQualifications,
  reviewQualification,
  revokeQualification,
} from "../../api/provider-qualifications";
import { usePermissions } from "../../auth/permissions";
import { Button, PageHeader, PageShell, StatePanel } from "../../components/ui";
import { showApiError } from "../../lib/global-error";

const kinds = [
  { kind: PROVIDER_QUALIFICATION_MATERIAL_KIND.ID_FRONT, label: "身份证人像面" },
  { kind: PROVIDER_QUALIFICATION_MATERIAL_KIND.ID_BACK, label: "身份证国徽面" },
  { kind: PROVIDER_QUALIFICATION_MATERIAL_KIND.TRAINING, label: "培训证明" },
] as const;
const statuses = [
  { value: PROVIDER_QUALIFICATION_STATUS.PENDING, label: "待审核" },
  { value: PROVIDER_QUALIFICATION_STATUS.APPROVED, label: "已通过" },
  { value: PROVIDER_QUALIFICATION_STATUS.REJECTED, label: "未通过" },
  { value: PROVIDER_QUALIFICATION_STATUS.REVOKED, label: "已撤销" },
] as const;

export default function ProviderQualifications() {
  const permissions = usePermissions();
  const client = useQueryClient();
  const [status, setStatus] = useState<ProviderQualificationStatus>("pending");
  const [id, setId] = useState<string | null>(null);
  const selectedId = useRef<string | null>(null);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [materialUrl, setMaterialUrl] = useState<string | null>(null);
  const [materialKind, setMaterialKind] = useState<ProviderQualificationMaterialKind | null>(null);
  const [materialBusy, setMaterialBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useQuery({
    queryKey: ["provider-qualifications", status],
    queryFn: () => fetchQualifications(status),
  });
  const detail = useQuery({
    queryKey: ["provider-qualification", id],
    queryFn: () => fetchQualification(id!),
    enabled: Boolean(id),
  });

  useEffect(
    () => () => {
      if (materialUrl) {
        URL.revokeObjectURL(materialUrl);
      }
    },
    [materialUrl],
  );
  useEffect(
    () => () => {
      selectedId.current = null;
    },
    [],
  );

  function select(id: string): void {
    selectedId.current = id;
    setId(id);
    setMaterialUrl(null);
    setMaterialKind(null);
    setReason("");
    setMethod("");
    setReference("");
    setError("");
  }

  async function showMaterial(kind: ProviderQualificationMaterialKind): Promise<void> {
    if (!id || materialBusy || !permissions.has("provider_qualification.material_view")) {
      return;
    }

    setMaterialBusy(true);
    setError("");

    try {
      const blob = await fetchQualificationMaterial(id, kind);

      if (selectedId.current !== id) {
        return;
      }

      if (!blob.type.startsWith("image/")) {
        throw new Error("材料格式无效");
      }

      setMaterialUrl(URL.createObjectURL(blob));
      setMaterialKind(kind);
    } catch (cause) {
      setError("材料读取失败，请检查权限或稍后重试");
      showApiError(cause);
    } finally {
      setMaterialBusy(false);
    }
  }

  async function decide(decision: "approve" | "reject"): Promise<void> {
    if (
      !id ||
      busy ||
      reason.trim().length < 5 ||
      (decision === "approve" && (!method.trim() || !reference.trim()))
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await reviewQualification(id, {
        decision,
        reason: reason.trim(),
        verificationMethod: decision === "approve" ? method.trim() : undefined,
        verificationReference: decision === "approve" ? reference.trim() : undefined,
      });
      setMaterialUrl(null);
      await client.invalidateQueries({ queryKey: ["provider-qualifications"] });
      await client.invalidateQueries({ queryKey: ["provider-qualification", id] });
    } catch (cause) {
      setError("审核未完成，请检查申请状态与核验记录");
      showApiError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(): Promise<void> {
    if (
      !id ||
      busy ||
      reason.trim().length < 5 ||
      !window.confirm("确认撤销资格？撤销后该服务者不能再接单。")
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await revokeQualification(id, reason.trim());
      setMaterialUrl(null);
      await client.invalidateQueries({ queryKey: ["provider-qualifications"] });
      await client.invalidateQueries({ queryKey: ["provider-qualification", id] });
    } catch (cause) {
      setError("资格撤销未完成，请稍后重试");
      showApiError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="服务者资格审核"
        description="只处理已提交申请。身份证与培训证明仅可通过独立授权临时读取，不产生公开链接。"
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(288px,1fr)_minmax(0,2fr)]">
        <section
          className="min-w-0 rounded-xl border border-border bg-surface p-5"
          aria-label="申请列表"
        >
          <label htmlFor="qualification-status" className="block text-sm font-medium">
            申请状态
          </label>
          <select
            id="qualification-status"
            value={status}
            onChange={(event) => {
              selectedId.current = null;
              setStatus(event.target.value as ProviderQualificationStatus);
              setId(null);
              setMaterialUrl(null);
            }}
            className="mt-2 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {list.isPending ? (
            <p className="mt-5 text-sm" role="status">
              正在加载申请…
            </p>
          ) : null}
          {list.isError ? (
            <StatePanel
              className="mt-5"
              title="申请加载失败"
              action={<Button onClick={() => void list.refetch()}>重试</Button>}
            />
          ) : null}
          {list.data?.length === 0 ? <StatePanel className="mt-5" title="当前没有申请" /> : null}
          <ul className="mt-5 space-y-2">
            {list.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => select(item.id)}
                  aria-current={id === item.id ? "true" : undefined}
                  className="min-h-11 w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <span className="block font-medium">申请 {item.id.slice(0, 8)}</span>
                  <span className="block text-text-secondary">
                    {new Date(item.createdAt).toLocaleString("zh-CN")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section
          className="min-w-0 rounded-xl border border-border bg-surface p-5"
          aria-label="审核详情"
        >
          {!id ? <StatePanel title="选择一条资格申请" /> : null}
          {id && detail.isPending ? <p role="status">正在加载审核记录…</p> : null}
          {detail.isError ? (
            <StatePanel
              title="详情加载失败"
              action={<Button onClick={() => void detail.refetch()}>重试</Button>}
            />
          ) : null}
          {detail.data ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">{detail.data.applicantNickname}</h2>
                <p className="text-sm text-text-secondary">
                  账号 {detail.data.applicantId} · {detail.data.applicantPhone ?? "手机号已不可用"}
                </p>
                <p className="mt-2 text-sm">
                  状态：
                  {statuses.find((entry) => entry.value === detail.data.status)?.label ??
                    detail.data.status}
                </p>
                <p className="text-sm">
                  授权同意时间：
                  {detail.data.consentedAt
                    ? new Date(detail.data.consentedAt).toLocaleString("zh-CN")
                    : "未提交"}
                </p>
                {detail.data.decisionReason ? (
                  <p className="text-sm">处理说明：{detail.data.decisionReason}</p>
                ) : null}
              </div>
              <div>
                <h3 className="font-semibold">私密材料</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {kinds.map(({ kind, label }) => (
                    <Button
                      key={kind}
                      intent="secondary"
                      disabled={
                        !permissions.has("provider_qualification.material_view") ||
                        !detail.data.materialKinds.includes(kind) ||
                        materialBusy
                      }
                      loading={materialBusy && materialKind === kind}
                      onClick={() => void showMaterial(kind)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {!permissions.has("provider_qualification.material_view") ? (
                  <p className="mt-2 text-sm text-text-secondary">当前账号没有材料读取权限。</p>
                ) : null}
                {materialUrl && materialKind ? (
                  <div className="mt-3 rounded-lg border border-border p-3">
                    <p className="mb-2 text-sm">
                      临时查看：{kinds.find((item) => item.kind === materialKind)?.label}
                    </p>
                    <img
                      src={materialUrl}
                      alt={`申请人提交的${kinds.find((item) => item.kind === materialKind)?.label}`}
                      className="max-h-[512px] max-w-full object-contain"
                    />
                    <Button className="mt-3" intent="ghost" onClick={() => setMaterialUrl(null)}>
                      关闭材料
                    </Button>
                  </div>
                ) : null}
              </div>
              {(detail.data.status === "pending" &&
                permissions.has("provider_qualification.review")) ||
              (detail.data.status === "approved" &&
                permissions.has("provider_qualification.revoke")) ? (
                <div className="space-y-3 border-t border-border pt-5">
                  <label htmlFor="review-reason" className="block text-sm font-medium">
                    审核或撤销理由（至少 5 字）
                  </label>
                  <textarea
                    id="review-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    className="min-h-24 w-full rounded-lg border border-border p-3 text-sm focus-visible:ring-2 focus-visible:ring-brand-primary"
                  />
                  {detail.data.status === "pending" ? (
                    <>
                      <label htmlFor="verification-method" className="block text-sm font-medium">
                        独立核验方式（通过时必填）
                      </label>
                      <input
                        id="verification-method"
                        value={method}
                        onChange={(event) => setMethod(event.target.value)}
                        maxLength={100}
                        className="h-11 w-full rounded-lg border border-border px-3 text-sm"
                      />
                      <label htmlFor="verification-reference" className="block text-sm font-medium">
                        核验凭证编号（通过时必填）
                      </label>
                      <input
                        id="verification-reference"
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        maxLength={150}
                        className="h-11 w-full rounded-lg border border-border px-3 text-sm"
                      />
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={
                            busy || reason.trim().length < 5 || !method.trim() || !reference.trim()
                          }
                          loading={busy}
                          onClick={() => void decide("approve")}
                        >
                          核验通过
                        </Button>
                        <Button
                          intent="secondary"
                          disabled={busy || reason.trim().length < 5}
                          onClick={() => void decide("reject")}
                        >
                          不通过
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      intent="danger"
                      disabled={busy || reason.trim().length < 5}
                      loading={busy}
                      onClick={() => void revoke()}
                    >
                      撤销资格
                    </Button>
                  )}
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <div className="border-t border-border pt-5">
                <h3 className="font-semibold">操作记录</h3>
                <ol className="mt-2 space-y-2 text-sm text-text-secondary">
                  {detail.data.events.map((event) => (
                    <li key={event.id}>
                      {new Date(event.createdAt).toLocaleString("zh-CN")} · {event.action} ·{" "}
                      {event.actorId}
                      {event.reason ? ` · ${event.reason}` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
