import { RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button, StatePanel } from "./ui";

interface LazyRouteBoundaryProps {
  children: ReactNode;
  label?: string;
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
      const label = this.props.label?.trim() || "页面";

      return (
        <StatePanel
          role="alert"
          aria-label="页面资源加载失败"
          tone="danger"
          icon={<RefreshCw aria-hidden="true" className="h-5 w-5" />}
          title={`${label}加载失败`}
          description="页面资源暂时无法获取，网络恢复后可重新加载页面。"
          action={
            <Button intent="dangerOutline" onClick={this.retry}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              重新加载页面
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
