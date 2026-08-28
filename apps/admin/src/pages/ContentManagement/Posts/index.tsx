import type { AdminContentPostListItem, AdminContentPostStatus } from "@petcare/shared-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, MessageSquare, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { fetchAdminContentPosts } from "../../../api/content/posts";
import {
  Badge,
  Button,
  DataPanel,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableRow,
  FilterBar,
  ListSkeleton,
  PageHeader,
  PageShell,
  Pagination,
  SearchInput,
  Select,
  StatePanel,
} from "../../../components/ui";

const PAGE_SIZE = 20;

const statusLabels: Record<AdminContentPostStatus, string> = {
  pending: "待审核",
  published: "已发布",
  rejected: "已驳回",
  offline: "已下架",
  deleted: "已删除",
};

const statusTones: Record<AdminContentPostStatus, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  published: "success",
  rejected: "danger",
  offline: "warning",
  deleted: "neutral",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: AdminContentPostStatus }) {
  return <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>;
}

function PostRow({ post }: { post: AdminContentPostListItem }) {
  return (
    <DataTableRow>
      <DataTableCell className="max-w-[360px]">
        <p className="line-clamp-2 font-medium leading-6 text-text-primary">
          {post.contentExcerpt}
        </p>
        <p className="mt-1 text-xs text-text-secondary">{post.id}</p>
      </DataTableCell>
      <DataTableCell>
        <p className="font-medium text-text-primary">{post.author.nickname}</p>
        <p className="mt-1 text-xs text-text-secondary">{post.author.phone}</p>
      </DataTableCell>
      <DataTableCell className="text-text-secondary">
        <div className="grid min-w-40 grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span>媒体 {post.mediaCount}</span>
          <span>赞 {post.likesCount}</span>
          <span>评 {post.commentsCount}</span>
          <span>转 {post.sharesCount}</span>
          <span>举报 {post.reportsCount}</span>
        </div>
      </DataTableCell>
      <DataTableCell>
        <StatusBadge status={post.status} />
      </DataTableCell>
      <DataTableCell className="whitespace-nowrap text-text-secondary">
        {formatDate(post.createdAt)}
      </DataTableCell>
      <DataTableCell className="text-right">
        <Button asChild intent="secondary" size="sm">
          <Link to={`/content/posts/${post.id}`}>查看详情</Link>
        </Button>
      </DataTableCell>
    </DataTableRow>
  );
}

export default function ContentPosts() {
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState<string>();
  const [status, setStatus] = useState<AdminContentPostStatus>();

  const query = useQuery({
    queryKey: ["admin-content-posts", { page, keyword, status }],
    queryFn: () => fetchAdminContentPosts({ page, pageSize: PAGE_SIZE, keyword, status }),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeyword(keywordInput.trim() || undefined);
    setPage(1);
  }

  function resetFilters() {
    setKeywordInput("");
    setKeyword(undefined);
    setStatus(undefined);
    setPage(1);
  }

  return (
    <PageShell>
      <PageHeader
        actions={
          <Badge className="h-9 px-3" tone="brand">
            <MessageSquare aria-hidden="true" className="h-4 w-4" />共 {total} 条帖子
          </Badge>
        }
        description="查看社区帖子、媒体数量和互动数据。"
        eyebrow="内容管理"
        title="帖子管理"
      />

      <FilterBar
        aria-label="帖子筛选"
        className="md:grid-cols-[minmax(260px,1fr)_170px_auto]"
        onSubmit={submitSearch}
      >
        <SearchInput
          aria-label="搜索帖子"
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="搜索帖子、作者或正文"
          value={keywordInput}
        />
        <Select
          aria-label="帖子状态"
          onChange={(event) => {
            setStatus((event.target.value || undefined) as AdminContentPostStatus | undefined);
            setPage(1);
          }}
          value={status ?? ""}
        >
          <option value="">全部帖子状态</option>
          <option value="pending">待审核</option>
          <option value="published">已发布</option>
          <option value="rejected">已驳回</option>
          <option value="offline">已下架</option>
          <option value="deleted">已删除</option>
        </Select>
        <div className="flex gap-2">
          <Button className="flex-1 md:flex-none" type="submit">
            查询
          </Button>
          <Button aria-label="重置筛选" intent="secondary" onClick={resetFilters} size="icon">
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </FilterBar>

      <DataPanel aria-label="帖子列表">
        {query.isPending && <ListSkeleton label="正在加载帖子" rowClassName="h-16" />}
        {!query.isPending && query.isError && (
          <StatePanel
            action={<Button onClick={() => void query.refetch()}>重试</Button>}
            description="请检查服务端连接后重试。"
            icon={<AlertCircle aria-hidden="true" className="h-6 w-6" />}
            title="帖子列表加载失败"
            tone="danger"
          />
        )}
        {!query.isPending && !query.isError && query.data?.list.length === 0 && (
          <StatePanel
            description="调整筛选条件后可以继续查看。"
            icon={<MessageSquare aria-hidden="true" className="h-6 w-6" />}
            title="暂无帖子内容"
          />
        )}
        {!query.isPending && !query.isError && query.data?.list.length !== 0 && (
          <>
            <DataTable minWidthClassName="min-w-[900px]">
              <DataTableHead>
                <tr>
                  <DataTableHeadCell>帖子内容</DataTableHeadCell>
                  <DataTableHeadCell>作者</DataTableHeadCell>
                  <DataTableHeadCell>互动</DataTableHeadCell>
                  <DataTableHeadCell>状态</DataTableHeadCell>
                  <DataTableHeadCell>发布时间</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {query.data?.list.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </DataTableBody>
            </DataTable>
            <Pagination
              disabled={query.isFetching}
              itemLabel="条帖子"
              onPageChange={setPage}
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              totalPages={totalPages}
            />
          </>
        )}
      </DataPanel>
    </PageShell>
  );
}
