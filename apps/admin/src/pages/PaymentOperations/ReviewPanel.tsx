import type {
  CreatePaymentBillReviewRequest,
  PaymentBillReviewAction,
} from "@petcare/shared-types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createBillReview, fetchBillReviews } from "../../api/payment";
import { useAuth } from "../../auth/auth.context";
import { PermissionGate } from "../../auth/PermissionGate";
import { usePermissions } from "../../auth/permissions";
import { Button, Field, Input, Select, Textarea } from "../../components/ui";
import { paymentErrorCode, PaymentLoadError, paymentTime } from "./presentation";

const actions: Record<PaymentBillReviewAction, string> = {
  note: "追加备注",
  record_outcome: "记录处理结论",
  reopen: "重新打开",
};

/** Records human handling separately from the immutable bill comparison. */
export function ReviewPanel({
  runId,
  ordinal,
  onLock,
}: {
  runId: string;
  ordinal: number;
  onLock: (locked: boolean) => void;
}) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const [pages, setPages] = useState([0]);
  const cursor = pages[pages.length - 1];
  const history = useQuery({
    queryKey: ["bill-reviews", user?.id, runId, ordinal, cursor],
    queryFn: () => fetchBillReviews(runId, ordinal, cursor),
    retry: false,
    enabled: permissions.has("payment.bill_read"),
  });
  const [action, setAction] = useState<PaymentBillReviewAction>("note");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const command = useRef<CreatePaymentBillReviewRequest | null>(null);
  const submitting = useRef(false);
  const canWrite = permissions.hasAll(["payment.bill_read", "payment.bill_review"]);
  const validNote = note.trim().length >= 5 && note.trim().length <= 1000;
  const validReference =
    (!reference.trim() && action !== "record_outcome") ||
    /^[A-Za-z0-9][A-Za-z0-9._/-]{2,199}$/.test(reference.trim());

  useEffect(() => {
    onLock(busy || uncertain);
  }, [busy, uncertain, onLock]);

  async function save(): Promise<void> {
    if (
      submitting.current ||
      !canWrite ||
      !history.data ||
      history.isError ||
      needsRefresh ||
      (!uncertain && (!validNote || !validReference))
    ) {
      return;
    }

    command.current ??= {
      idempotencyKey: crypto.randomUUID(),
      expectedVersion: history.data.version,
      action,
      note: note.trim(),
      evidenceReference: reference.trim() || null,
    };
    submitting.current = true;
    setBusy(true);
    setError("");
    setSaved("");

    try {
      const result = await createBillReview(runId, ordinal, command.current);

      command.current = null;
      setUncertain(false);
      setNote("");
      setReference("");
      setAction("note");
      setSaved(`已保存处理版本 ${result.version}，原日账差异与资金状态未改变。`);
      setPages([0]);
      void history.refetch();
    } catch (cause) {
      const code = paymentErrorCode(cause);

      if (
        [
          "PAYMENT_BILL_REVIEW_CONFLICT",
          "PAYMENT_BILL_REVIEW_INVALID",
          "VALIDATION_FAILED",
        ].includes(code ?? "")
      ) {
        command.current = null;
        setUncertain(false);
        setNeedsRefresh(true);
        setError("记录已变化或请求被拒绝。请先刷新处理历史，核对最新版本并修正内容后再提交。");
      } else {
        setUncertain(true);
        setError("提交结果未知。请勿离开页面，使用原请求重试；不会生成新操作标识。");
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-label={`差异 ${ordinal} 的处理历史`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">人工处理历史</h3>
        <Button
          intent="secondary"
          disabled={busy || uncertain}
          loading={history.isFetching}
          onClick={() => {
            void history.refetch().then((result) => {
              if (result.isSuccess) {
                setNeedsRefresh(false);
                setError("");
              }
            });
          }}
        >
          刷新处理历史
        </Button>
      </div>
      <p className="text-sm text-text-secondary">
        记录结论不代表差异已消失，也不改变核对或资金状态。不要填写个人资料、密钥或原始账单。
      </p>
      {saved ? (
        <p role="status" className="text-sm text-text-primary">
          {saved}
        </p>
      ) : null}
      {history.isPending && <p role="status">正在加载处理历史…</p>}
      {history.isError && (
        <PaymentLoadError
          error={history.error}
          busy={history.isFetching}
          retry={() => void history.refetch()}
        />
      )}
      {history.isSuccess && (
        <>
          <p className="text-sm">
            当前人工状态：{history.data.status === "open" ? "待处理" : "已记录结论（非资金确认）"} ·
            版本 {history.data.version}
          </p>
          {history.data.entries.length === 0 ? (
            <p className="text-sm text-text-secondary">尚无人工处理记录。</p>
          ) : (
            <ol className="space-y-3">
              {history.data.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border bg-surface-subtle p-3 text-sm"
                >
                  <p className="font-medium">
                    版本 {entry.version} · {actions[entry.action]}
                  </p>
                  <p className="break-all text-xs text-text-secondary">
                    {paymentTime(entry.createdAt)} · 操作人 {entry.actorId}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words">{entry.note}</p>
                  {entry.evidenceReference ? (
                    <p className="mt-2 break-all">依据：{entry.evidenceReference}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-3">
            <Button
              intent="secondary"
              disabled={pages.length === 1 || history.isFetching || busy || uncertain}
              onClick={() => setPages((value) => value.slice(0, -1))}
            >
              上一页处理历史
            </Button>
            <Button
              intent="secondary"
              disabled={!history.data.nextCursor || history.isFetching || busy || uncertain}
              onClick={() => setPages((value) => [...value, history.data.nextCursor!])}
            >
              下一页处理历史
            </Button>
          </div>
          <PermissionGate
            all={["payment.bill_read", "payment.bill_review"]}
            fallback={<p className="text-sm text-text-secondary">只读权限，不能追加处理记录。</p>}
          >
            <form
              className="space-y-4 border-t border-border pt-4"
              aria-label="记录差异处理"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <Field label="处理动作" htmlFor="review-action">
                <Select
                  id="review-action"
                  value={action}
                  disabled={busy || uncertain}
                  onChange={(event) => setAction(event.target.value as PaymentBillReviewAction)}
                >
                  <option value="note">追加备注</option>
                  {history.data.status === "open" ? (
                    <option value="record_outcome">记录处理结论</option>
                  ) : (
                    <option value="reopen">重新打开</option>
                  )}
                </Select>
              </Field>
              <Field label="处理说明" htmlFor="review-note" required>
                <Textarea
                  id="review-note"
                  required
                  minLength={5}
                  maxLength={1000}
                  value={note}
                  disabled={busy || uncertain}
                  aria-describedby="review-note-help"
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              <p id="review-note-help" className="text-xs text-text-secondary">
                去除首尾空白后 5–1000 字符；只记录处理过程，不粘贴敏感资料。
              </p>
              <Field
                label="依据编号"
                htmlFor="review-reference"
                required={action === "record_outcome"}
              >
                <Input
                  id="review-reference"
                  maxLength={200}
                  required={action === "record_outcome"}
                  value={reference}
                  disabled={busy || uncertain}
                  aria-describedby="review-reference-help"
                  onChange={(event) => setReference(event.target.value)}
                />
              </Field>
              <p id="review-reference-help" className="text-xs text-text-secondary">
                工单或文档编号，3–200 位字母、数字及 . _ /
                -，不接受链接。记录结论时必填，由处理人核验其内容。
              </p>
              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                loading={busy}
                className="disabled:pointer-events-auto"
                disabled={
                  history.isFetching ||
                  needsRefresh ||
                  (!uncertain && (!validNote || !validReference))
                }
              >
                {uncertain ? "重试原处理请求" : "保存处理记录"}
              </Button>
            </form>
          </PermissionGate>
        </>
      )}
    </section>
  );
}
