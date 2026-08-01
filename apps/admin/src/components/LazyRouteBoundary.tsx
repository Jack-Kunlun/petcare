import { Component, type ReactNode } from "react";

interface LazyRouteBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

interface LazyRouteBoundaryState {
  failed: boolean;
}

/** 将动态路由资源加载失败转换为可感知、可恢复的页面状态。 */
export class LazyRouteBoundary extends Component<LazyRouteBoundaryProps, LazyRouteBoundaryState> {
  state: LazyRouteBoundaryState = { failed: false };

  static getDerivedStateFromError(): LazyRouteBoundaryState {
    return { failed: true };
  }

  private readonly retry = (): void => {
    if (this.props.onRetry) {
      this.props.onRetry();

      return;
    }

    window.location.reload();
  };

  render() {
    if (this.state.failed) {
      return (
        <section
          role="alert"
          aria-label="页面资源加载失败"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-950"
        >
          <h1 className="text-xl font-semibold">系统设置加载失败</h1>
          <p className="mt-2 leading-6">页面资源暂时无法获取，网络恢复后可重新加载页面。</p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-4 min-h-11 cursor-pointer rounded-lg bg-red-800 px-4 py-2 font-semibold text-white outline-none hover:bg-red-900 focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2"
          >
            重新加载页面
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}
