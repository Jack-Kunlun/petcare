import type { ApiErrorResponse } from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, BadgeCheck, FileCheck2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  approveAdminProviderCertification,
  fetchAdminProviderCertification,
  rejectAdminProviderCertification,
} from "../../../api/provider-certifications";
import { PermissionGate } from "../../../auth/PermissionGate";

type DialogMode = "approve" | "reject" | null;

const certificationStatusLabels = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
} as const;

/** 将 ISO 时间格式化为认证详情使用的本地日期时间。 */
function formatDateTime(value: string | null): string {
  if (!value) {
    return "尚未审核";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

/** 从统一错误响应中提取适合管理员查看的错误文案。 */
function reviewErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    if (error.response?.status === 409) {
      return "该申请已由其他管理员处理，已刷新最新状态。";
    }

    return error.response?.data.message ?? "审核操作失败，请稍后重试。";
  }

  return "审核操作失败，请稍后重试。";
}

export default function ProviderCertificationDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const query = useQuery({
    queryKey: ["admin-provider-certification", id],
    queryFn: () => fetchAdminProviderCertification(id),
    enabled: Boolean(id),
  });

  async function refreshCertification() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-provider-certifications"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-provider-certification", id] }),
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: () => approveAdminProviderCertification(id),
    onSuccess: async () => {
      setDialogMode(null);
      setActionError("");
      await refreshCertification();
    },
    onError: async (error) => {
      setActionError(reviewErrorMessage(error));
      setDialogMode(null);

      if (axios.isAxiosError(error) && error.response?.status === 409) {
        await query.refetch();
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectAdminProviderCertification(id, { reason }),
    onSuccess: async () => {
      setDialogMode(null);
      setRejectReason("");
      setActionError("");
      await refreshCertification();
    },
    onError: async (error) => {
      setActionError(reviewErrorMessage(error));
      setDialogMode(null);

      if (axios.isAxiosError(error) && error.response?.status === 409) {
        await query.refetch();
      }
    },
  });

  function submitReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = rejectReason.trim();

    if (reason.length < 2 || reason.length > 500) {
      setFormError("驳回原因需填写 2 至 500 个字符");

      return;
    }

    setFormError("");
    rejectMutation.mutate(reason);
  }

  const application = query.data;
  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <Link
        to="/users/certifications"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        返回认证审核
      </Link>

      {query.isPending ? (
        <div aria-label="正在加载认证详情" className="h-80 animate-pulse rounded-xl bg-slate-100" />
      ) : null}
      {query.isError ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-8 text-center"
        >
          <ShieldAlert aria-hidden="true" className="mx-auto h-8 w-8 text-red-600" />
          <h1 className="mt-3 text-xl font-semibold text-red-950">认证详情加载失败</h1>
          <button
            type="button"
            className="mt-4 h-11 cursor-pointer rounded-lg border border-red-300 px-4 text-sm"
            onClick={() => void query.refetch()}
          >
            重新加载
          </button>
        </section>
      ) : null}

      {application ? (
        <>
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-medium text-blue-700">认证申请详情</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                {application.applicant.nickname}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                提交于 {formatDateTime(application.createdAt)}
              </p>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              {certificationStatusLabels[application.status]}
            </span>
          </header>

          {actionError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {actionError}
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                <ShieldCheck aria-hidden="true" className="h-5 w-5 text-blue-700" />
                申请人信息
              </h2>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">手机号</dt>
                  <dd className="mt-1 font-medium tabular-nums text-slate-900">
                    {application.applicant.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">登录账号</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {application.applicant.username ?? "未设置"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">真实姓名</dt>
                  <dd className="mt-1 font-medium text-slate-900">{application.realNameMasked}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">身份证号</dt>
                  <dd className="mt-1 font-medium tabular-nums text-slate-900">
                    {application.idCardMasked}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                <BadgeCheck aria-hidden="true" className="h-5 w-5 text-blue-700" />
                准入条件
              </h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">身份资料</dt>
                  <dd className="font-medium text-emerald-700">
                    {application.idCardVerified ? "已提交" : "缺失"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">培训考核</dt>
                  <dd className="font-medium text-slate-900">
                    {application.trainingPassed ? "已通过" : "未通过"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">微信支付分</dt>
                  <dd className="font-medium tabular-nums text-slate-900">
                    {application.wechatScore ?? "未提供"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-950">
              <FileCheck2 aria-hidden="true" className="h-5 w-5 text-blue-700" />
              审核记录
            </h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">审核管理员</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {application.reviewedBy?.nickname ?? "尚未审核"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">审核时间</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {formatDateTime(application.reviewedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">驳回原因</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {application.rejectReason ?? "无"}
                </dd>
              </div>
            </dl>
          </section>

          {application.status === "pending" ? (
            <div className="sticky bottom-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
              <PermissionGate all={["user.reject_provider"]}>
                <button
                  type="button"
                  className="min-h-11 cursor-pointer rounded-lg border border-red-300 px-5 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  onClick={() => {
                    setFormError("");
                    setDialogMode("reject");
                  }}
                >
                  驳回申请
                </button>
              </PermissionGate>
              <PermissionGate all={["user.approve_provider"]}>
                <button
                  type="button"
                  className="min-h-11 cursor-pointer rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  onClick={() => setDialogMode("approve")}
                >
                  审核通过
                </button>
              </PermissionGate>
            </div>
          ) : null}
        </>
      ) : null}

      {dialogMode === "approve" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-title"
            className="w-full max-w-[448px] rounded-xl bg-white p-6 shadow-2xl"
          >
            <h2 id="approve-title" className="text-xl font-semibold text-slate-950">
              确认通过认证？
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              通过后将立即授予该用户认证宠托师资格。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-sm"
                onClick={() => setDialogMode(null)}
              >
                取消
              </button>
              <PermissionGate all={["user.approve_provider"]}>
                <button
                  type="button"
                  disabled={isMutating}
                  className="min-h-11 cursor-pointer rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => approveMutation.mutate()}
                >
                  确认通过
                </button>
              </PermissionGate>
            </div>
          </section>
        </div>
      ) : null}

      {dialogMode === "reject" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            className="w-full max-w-[512px] rounded-xl bg-white p-6 shadow-2xl"
          >
            <h2 id="reject-title" className="text-xl font-semibold text-slate-950">
              驳回认证申请
            </h2>
            <form className="mt-4" onSubmit={submitReject}>
              <label htmlFor="reject-reason" className="text-sm font-medium text-slate-800">
                驳回原因
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                rows={5}
                aria-describedby={formError ? "reject-error" : "reject-help"}
                onChange={(event) => setRejectReason(event.target.value)}
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <div className="mt-1 flex justify-between gap-4 text-xs">
                <p
                  id={formError ? "reject-error" : "reject-help"}
                  className={formError ? "text-red-700" : "text-slate-500"}
                >
                  {formError || "请明确说明需要用户修改的资料。"}
                </p>
                <span className="tabular-nums text-slate-500">{rejectReason.length}/500</span>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="min-h-11 cursor-pointer rounded-lg border border-slate-300 px-4 text-sm"
                  onClick={() => setDialogMode(null)}
                >
                  取消
                </button>
                <PermissionGate all={["user.reject_provider"]}>
                  <button
                    type="submit"
                    disabled={isMutating}
                    className="min-h-11 cursor-pointer rounded-lg bg-red-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    确认驳回
                  </button>
                </PermissionGate>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
