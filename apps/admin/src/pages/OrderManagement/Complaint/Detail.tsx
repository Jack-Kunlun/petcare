import type {
  AdminComplaintDetail,
  ComplaintAction,
  SubmitDisputeDecisionRequest,
  TransferComplaintRequest,
} from "@petcare/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  Gavel,
  Hand,
  RefreshCcw,
  Send,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  claimAdminComplaint,
  fetchAdminComplaint,
  fetchExecutionTasks,
  retryExecutionTask,
  submitFinalDecision,
  submitInitialDecision,
  transferAdminComplaint,
} from "../../../api/complaints";
import { PermissionGate } from "../../../auth/PermissionGate";
import { EditorPageLayout, FormSection } from "../../../components/EditorPageLayout";
import { DecisionDialog } from "./DecisionDialog";
import { TransferDialog } from "./TransferDialog";

type DialogMode = "transfer" | "initial" | "final" | null;

const statusLabels: Record<string, string> = {
  pending_response: "待回应",
  unassigned: "待认领",
  processing_initial: "初审中",
  initial_decided: "申诉期内",
  processing_final: "终审中",
  closed: "已结案",
  withdrawn: "已撤回",
};
const taskLabels: Record<string, string> = {
  refund: "退款",
  settlement: "结算",
  complainant_credit: "投诉方信用",
  respondent_credit: "被投诉方信用",
};
const currentActionDefinitions = [
  { action: "claim", label: "认领案件", icon: <Hand className="h-4 w-4" /> },
  { action: "transfer", label: "转派案件", icon: <Send className="h-4 w-4" /> },
  {
    action: "initial_decide",
    label: "作出初审裁决",
    icon: <Gavel className="h-4 w-4" />,
  },
  {
    action: "final_decide",
    label: "作出最终裁决",
    icon: <Gavel className="h-4 w-4" />,
  },
] as const;

/** 格式化 ISO 时间供卷宗阅读。 */
function dateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

/** 同时刷新详情、列表与执行任务缓存。 */
async function invalidateComplaint(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-complaints"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-complaint", id] }),
    queryClient.invalidateQueries({ queryKey: ["admin-complaint-execution-tasks", id] }),
  ]);
}

/** 投诉纠纷连续卷宗与裁决工作台。 */
export default function ComplaintDetailPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [actionError, setActionError] = useState("");
  const query = useQuery({
    queryKey: ["admin-complaint", id],
    queryFn: () => fetchAdminComplaint(id),
    enabled: Boolean(id),
  });
  const complaint = query.data;
  const canRetry = complaint?.allowedActions.includes("retry_execution") ?? false;
  const tasks = useQuery({
    queryKey: ["admin-complaint-execution-tasks", id],
    queryFn: () => fetchExecutionTasks(id, { page: 1, pageSize: 100 }),
    enabled: Boolean(id) && canRetry,
  });

  /** 统一处理案件动作成功后的缓存刷新。 */
  async function succeeded() {
    setDialog(null);
    setActionError("");
    await invalidateComplaint(queryClient, id);
  }

  /** 统一处理并发冲突与普通操作失败。 */
  async function failed(error: unknown) {
    setDialog(null);

    if (axios.isAxiosError(error) && error.response?.status === 409) {
      setActionError("案件状态已变化，请根据最新状态继续处理。");
      await query.refetch();

      return;
    }

    setActionError("操作失败，请稍后重试。");
  }

  const claim = useMutation({
    mutationFn: () => claimAdminComplaint(id, { version: complaint!.version }),
    onSuccess: succeeded,
    onError: failed,
  });
  const transfer = useMutation({
    mutationFn: (request: TransferComplaintRequest) => transferAdminComplaint(id, request),
    onSuccess: succeeded,
    onError: failed,
  });
  const initial = useMutation({
    mutationFn: (request: SubmitDisputeDecisionRequest) => submitInitialDecision(id, request),
    onSuccess: succeeded,
    onError: failed,
  });
  const final = useMutation({
    mutationFn: (request: SubmitDisputeDecisionRequest) => submitFinalDecision(id, request),
    onSuccess: succeeded,
    onError: failed,
  });
  const retry = useMutation({
    mutationFn: (taskId: string) => retryExecutionTask(id, taskId, { version: complaint!.version }),
    onSuccess: succeeded,
    onError: failed,
  });

  if (query.isPending) {
    return (
      <div aria-label="正在加载投诉卷宗" className="h-96 animate-pulse rounded-xl bg-slate-100" />
    );
  }

  if (query.isError || !complaint) {
    return (
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-7 w-7 text-red-700" />
        <h1 className="mt-3 text-xl font-semibold">投诉卷宗加载失败</h1>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-4 min-h-11 rounded-lg border border-red-300 px-4"
        >
          重新加载
        </button>
      </section>
    );
  }

  return (
    <>
      <EditorPageLayout
        width="wide"
        title={<span className="font-mono">{complaint.caseNumber}</span>}
        description={`投诉纠纷卷宗 · 订单 ${complaint.orderId} · 更新于 ${dateTime(complaint.updatedAt)}`}
        status={
          <span className="w-fit rounded-full bg-blue-50 px-3 py-2 font-medium text-blue-800">
            {statusLabels[complaint.status]}
          </span>
        }
        back={
          <Link
            to="/orders/complaints"
            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            返回投诉工作队列
          </Link>
        }
        actions={
          <ComplaintActionButtons
            actions={complaint.allowedActions}
            pending={claim.isPending || retry.isPending}
            onClaim={() => claim.mutate()}
            onTransfer={() => setDialog("transfer")}
            onInitial={() => setDialog("initial")}
            onFinal={() => setDialog("final")}
            ariaLabelPrefix="顶部"
          />
        }
      >
        {actionError ? (
          <p
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"
          >
            {actionError}
          </p>
        ) : null}
        <div className="grid items-start gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Dossier complaint={complaint} />
          </div>
          <aside className="space-y-4 xl:sticky xl:top-24">
            <Workbench
              actions={complaint.allowedActions}
              pending={claim.isPending || retry.isPending}
              onClaim={() => claim.mutate()}
              onTransfer={() => setDialog("transfer")}
              onInitial={() => setDialog("initial")}
              onFinal={() => setDialog("final")}
            />
            {canRetry ? (
              <FormSection title="执行任务">
                <div className="grid gap-3">
                  {tasks.data?.list.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <div>
                        <p className="font-medium">{taskLabels[task.taskType]}</p>
                        <p className="mt-1 text-xs text-red-700">
                          {task.failureReason ?? "执行失败"}
                        </p>
                      </div>
                      {task.status === "failed" ? (
                        <PermissionGate all={["dispute.resolve"]}>
                          <button
                            type="button"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(task.id)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-300 px-3 font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                          >
                            <RefreshCcw className="h-4 w-4" />
                            重试{taskLabels[task.taskType]}任务
                          </button>
                        </PermissionGate>
                      ) : null}
                    </div>
                  ))}
                </div>
              </FormSection>
            ) : null}
          </aside>
        </div>
      </EditorPageLayout>
      {dialog === "transfer" ? (
        <TransferDialog
          version={complaint.version}
          pending={transfer.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(request) => transfer.mutate(request)}
        />
      ) : null}
      {dialog === "initial" || dialog === "final" ? (
        <DecisionDialog
          level={dialog}
          version={complaint.version}
          allocatableAmount={complaint.order.allocatableAmount}
          pending={initial.isPending || final.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(request) =>
            dialog === "initial" ? initial.mutate(request) : final.mutate(request)
          }
        />
      ) : null}
    </>
  );
}

/** 渲染卷宗中的统一信息区块。 */
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <FormSection
      title={
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
      }
    >
      {children}
    </FormSection>
  );
}

/** 按固定业务顺序渲染连续案件卷宗。 */
function Dossier({ complaint }: { complaint: AdminComplaintDetail }) {
  return (
    <>
      <Section title="订单信息" icon={<BriefcaseBusiness className="h-5 w-5 text-blue-700" />}>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Item label="订单模式" value={complaint.order.orderType} />
          <Item label="服务类型" value={complaint.order.serviceType} />
          <Item
            label="订单金额"
            value={`¥${(complaint.order.allocatableAmount / 100).toFixed(2)}`}
          />
          <Item label="订单状态" value={complaint.order.status} />
          <Item label="服务时间" value={dateTime(complaint.order.serviceTime)} />
        </dl>
      </Section>
      <Section title="双方当事人" icon={<Users className="h-5 w-5 text-blue-700" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Party role="投诉方" user={complaint.complainant} />
          <Party role="被投诉方" user={complaint.respondent} />
        </div>
      </Section>
      <Section title="投诉内容" icon={<FileText className="h-5 w-5 text-blue-700" />}>
        <p className="leading-7 text-slate-800">{complaint.reason}</p>
        <p className="mt-3 text-sm text-slate-600">
          期望方案：{complaint.expectedSolution ?? "未填写"}
        </p>
      </Section>
      <Section title="陈述与证据" icon={<FileText className="h-5 w-5 text-blue-700" />}>
        <div className="space-y-4">
          {complaint.statements.map((statement) => (
            <article key={statement.id} className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                {statement.authorId === complaint.complainantId ? "投诉方" : "被投诉方"} ·{" "}
                {dateTime(statement.createdAt)}
              </p>
              <p className="mt-2 leading-6">{statement.statement}</p>
              <Evidence urls={statement.evidenceUrls} />
            </article>
          ))}
        </div>
      </Section>
      <Section title="裁决记录" icon={<Gavel className="h-5 w-5 text-blue-700" />}>
        <div className="space-y-4">
          {complaint.initialDecision ? (
            <Decision label="初审裁决" value={complaint.initialDecision} />
          ) : (
            <p className="text-slate-500">尚无裁决</p>
          )}
          {complaint.finalDecision ? (
            <Decision label="最终裁决" value={complaint.finalDecision} />
          ) : null}
        </div>
      </Section>
      <Section title="案件时间线" icon={<FileText className="h-5 w-5 text-blue-700" />}>
        <ol className="space-y-4 border-l border-slate-200 pl-5">
          {complaint.events.map((event) => (
            <li key={event.id}>
              <p className="font-medium text-slate-900">{event.action}</p>
              <p className="mt-1 text-xs text-slate-500">
                {dateTime(event.createdAt)} · {event.fromStatus ?? "创建"} →{" "}
                {event.toStatus ?? "保持"}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

/** 渲染订单摘要中的单个字段。 */
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/** 渲染单方当事人的后台识别摘要。 */
function Party({ role, user }: { role: string; user: AdminComplaintDetail["complainant"] }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium text-blue-700">{role}</p>
      <p className="mt-2 font-semibold">{user.nickname}</p>
      <p className="mt-1 text-sm text-slate-500">{user.phone}</p>
    </article>
  );
}

/** 渲染陈述所附的证据链接。 */
function Evidence({ urls }: { urls: string[] }) {
  return urls.length > 0 ? (
    <ul className="mt-3 flex flex-wrap gap-2">
      {urls.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            查看证据
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-2 text-xs text-slate-500">未附证据</p>
  );
}

/** 渲染一层已经形成的裁决结果。 */
function Decision({ label, value }: { label: string; value: SubmitDisputeDecisionRequest }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold">{label}</h3>
      <p className="mt-2 leading-6">{value.reason}</p>
      <p className="mt-2 text-sm text-slate-600">
        退款 ¥{(value.refundAmount / 100).toFixed(2)} · 结算 ¥
        {(value.settlementAmount / 100).toFixed(2)}
      </p>
    </article>
  );
}

type ComplaintActionButtonsProps = {
  actions: ComplaintAction[];
  pending: boolean;
  onClaim: () => void;
  onTransfer: () => void;
  onInitial: () => void;
  onFinal: () => void;
  ariaLabelPrefix?: string;
};

/** 仅按服务端 allowedActions 渲染当前可用动作。 */
function ComplaintActionButtons({
  actions,
  pending,
  onClaim,
  onTransfer,
  onInitial,
  onFinal,
  ariaLabelPrefix,
}: ComplaintActionButtonsProps) {
  const callbacks = {
    claim: onClaim,
    transfer: onTransfer,
    initial_decide: onInitial,
    final_decide: onFinal,
  };

  return (
    <>
      {currentActionDefinitions
        .filter((button) => actions.includes(button.action))
        .map((button) => (
          <PermissionGate key={button.action} all={["dispute.resolve"]}>
            <button
              type="button"
              aria-label={ariaLabelPrefix ? `${ariaLabelPrefix}${button.label}` : undefined}
              disabled={pending}
              onClick={callbacks[button.action]}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {button.icon}
              {button.label}
            </button>
          </PermissionGate>
        ))}
    </>
  );
}

function Workbench(props: ComplaintActionButtonsProps) {
  const hasAvailableAction = currentActionDefinitions.some((button) =>
    props.actions.includes(button.action),
  );

  return (
    <FormSection title="当前可执行操作" description="裁决工作台">
      <div className="grid gap-3">
        <ComplaintActionButtons {...props} />
        {!hasAvailableAction ? <p className="text-sm text-slate-500">当前无需人工操作。</p> : null}
      </div>
    </FormSection>
  );
}
