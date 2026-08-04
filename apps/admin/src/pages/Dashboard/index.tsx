import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ShoppingBag,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface Metric {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  hint: string;
  icon: LucideIcon;
}

const metrics: Metric[] = [
  {
    label: "累计用户",
    value: "1,234",
    change: "12.5%",
    trend: "up",
    hint: "较上月",
    icon: Users,
  },
  {
    label: "今日订单",
    value: "56",
    change: "8.2%",
    trend: "up",
    hint: "较昨日",
    icon: ShoppingBag,
  },
  {
    label: "本月成交额",
    value: "¥ 128,640",
    change: "5.4%",
    trend: "up",
    hint: "较上月",
    icon: CircleDollarSign,
  },
  {
    label: "订单完成率",
    value: "96.8%",
    change: "0.6%",
    trend: "down",
    hint: "较上月",
    icon: BadgeCheck,
  },
];

const weeklyOrders = [
  { day: "周一", value: 48 },
  { day: "周二", value: 64 },
  { day: "周三", value: 52 },
  { day: "周四", value: 78 },
  { day: "周五", value: 68 },
  { day: "周六", value: 92 },
  { day: "周日", value: 74 },
];

const todos = [
  {
    title: "待审核宠托师",
    description: "有 8 份新的认证申请等待处理",
    count: 8,
    path: "/users",
    action: "查看待审核宠托师",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    title: "待处理纠纷",
    description: "有 3 笔订单需要平台介入",
    count: 3,
    path: "/orders",
    action: "查看待处理纠纷",
    tone: "bg-red-50 text-red-700",
  },
  {
    title: "即将超时订单",
    description: "有 5 笔订单将在 2 小时内超时",
    count: 5,
    path: "/orders",
    action: "查看即将超时订单",
    tone: "bg-blue-50 text-blue-700",
  },
];

export default function Dashboard() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 text-text-primary">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-blue-700">控制台</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">运营概览</h1>
          <p className="mt-1 text-sm text-slate-500">掌握平台经营状态，及时处理关键事项。</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm sm:self-auto">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-slate-400" />
          <span>最近 7 天</span>
        </div>
      </section>

      <section aria-label="核心指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === "up" ? ArrowUpRight : ArrowDownRight;
          const trendClass = metric.trend === "up" ? "text-emerald-700" : "text-amber-700";

          return (
            <article
              key={metric.label}
              className="rounded-xl border border-border bg-white p-5 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {metric.value}
                  </p>
                </div>
                <span className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className={`inline-flex items-center font-semibold ${trendClass}`}>
                  <TrendIcon aria-hidden="true" className="mr-0.5 h-3.5 w-3.5" />
                  {metric.change}
                </span>
                <span className="text-slate-400">{metric.hint}</span>
              </div>
            </article>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <section className="rounded-xl border border-border bg-white p-5 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">订单趋势</h2>
              <p className="mt-1 text-xs text-slate-500">最近 7 天订单量</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-slate-950">476</p>
              <p className="text-xs font-medium text-emerald-700">周同比 +9.6%</p>
            </div>
          </div>

          <div
            aria-label="最近七天订单趋势图"
            className="mt-6 flex h-56 items-end gap-3 border-b border-slate-200 px-1"
            role="img"
          >
            {weeklyOrders.map((item) => (
              <div key={item.day} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                <div
                  className="w-full rounded-t-md bg-blue-600 transition-colors duration-200 hover:bg-blue-700"
                  style={{ height: `${item.value}%` }}
                  title={`${item.day}：${item.value} 单`}
                />
                <span className="pb-2 text-center text-xs text-slate-400">{item.day}</span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>最近七天订单量</caption>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">订单量</th>
              </tr>
            </thead>
            <tbody>
              {weeklyOrders.map((item) => (
                <tr key={item.day}>
                  <th scope="row">{item.day}</th>
                  <td>{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border bg-white p-5 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:border-brand-primary/30 hover:shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">待处理事项</h2>
              <p className="mt-1 text-xs text-slate-500">优先处理影响服务体验的任务</p>
            </div>
            <Clock3 aria-hidden="true" className="h-5 w-5 text-slate-400" />
          </div>

          <ul className="mt-4 divide-y divide-slate-100">
            {todos.map((todo) => (
              <li key={todo.title} className="py-4 first:pt-2 last:pb-0">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-8 min-w-8 items-center justify-center rounded-lg text-sm font-semibold ${todo.tone}`}
                  >
                    {todo.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{todo.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{todo.description}</p>
                    <Link
                      to={todo.path}
                      className="mt-2 inline-flex cursor-pointer items-center rounded-sm text-xs font-semibold text-brand-primary outline-none transition-colors hover:text-brand-primary-hover active:text-brand-primary-hover focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                    >
                      {todo.action}
                      <ArrowRight aria-hidden="true" className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
