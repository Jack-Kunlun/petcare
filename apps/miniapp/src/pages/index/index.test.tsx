import Taro from "@tarojs/taro";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useAuth } from "../../auth/auth.context";
import Index from ".";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getMenuButtonBoundingClientRect: jest.fn(() => ({ top: 32, bottom: 64 })),
    getWindowInfo: jest.fn(() => ({
      statusBarHeight: 24,
      screenHeight: 844,
      safeArea: { bottom: 810 },
    })),
    navigateTo: jest.fn(),
    switchTab: jest.fn(),
  },
}));

jest.mock("@tarojs/components", () => {
  const React = jest.requireActual("react");

  return {
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
    Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("span", props, children),
    Button: ({
      children,
      hoverClass: _hoverClass,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("button", props, children),
    Image: ({ children, ariaLabel, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("img", { ...props, "aria-label": ariaLabel }, children),
    Icon: ({ ariaLabel, type }: { ariaLabel?: string; type: string }) =>
      React.createElement("span", { role: "img", "aria-label": ariaLabel, "data-icon": type }),
    ScrollView: ({ children }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", null, children),
    Swiper: ({ children }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", null, children),
    SwiperItem: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
  };
});

jest.mock("../../auth/auth.context", () => ({
  useAuth: jest.fn(),
}));

describe("Index Page", () => {
  const logout = jest.fn();

  function renderAuthenticatedHome() {
    jest.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: {
        id: "user-1",
        phone: "13800138000",
        nickname: "宠友1878",
        avatar: null,
        userType: "pet_owner",
      },
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    return render(<Index />);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-06T09:00:00"));
    logout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the session restore state", () => {
    jest.mocked(useAuth).mockReturnValue({
      status: "loading",
      user: null,
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    render(<Index />);

    expect(screen.getByText("正在恢复登录状态")).toBeInTheDocument();
  });

  it("lets a guest navigate to WeChat login", () => {
    jest.mocked(useAuth).mockReturnValue({
      status: "guest",
      user: null,
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    render(<Index />);
    fireEvent.click(screen.getByText("微信登录"));

    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: "/pages/auth/index",
    });
  });

  it("uses Miniapp-safe Tailwind tokens", () => {
    jest.mocked(useAuth).mockReturnValue({
      status: "guest",
      user: null,
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    const { container } = render(<Index />);

    expect(container.firstElementChild).toHaveClass(
      "box-border",
      "min-h-screen",
      "bg-surface",
      "px-page-x",
    );
    expect(screen.getByText("微信登录")).toHaveClass("h-control", "rounded-button", "bg-brand");
  });

  it("keeps the header below the capsule and content above the safe-area tab bar", () => {
    renderAuthenticatedHome();

    expect(screen.getByTestId("status-bar-spacer")).toHaveStyle({ height: "72px" });
    expect(screen.getByTestId("home-page")).toHaveStyle({ paddingBottom: "98px" });
    expect(screen.getByTestId("home-page")).not.toHaveClass("pb-page-tab-offset");
  });

  it("keeps the approved home section order", () => {
    renderAuthenticatedHome();
    const page = screen.getByTestId("home-page");
    const sections = within(page)
      .getAllByTestId(/home-section-/)
      .map((element) => element.getAttribute("data-testid"));

    expect(sections).toEqual([
      "home-section-header",
      "home-section-hero",
      "home-section-service",
      "home-section-bounty",
      "home-section-classroom",
      "home-section-community",
    ]);
  });

  it("renders the prototype content density", () => {
    renderAuthenticatedHome();

    expect(screen.getAllByTestId("bounty-card")).toHaveLength(3);
    expect(screen.getAllByTestId("classroom-card")).toHaveLength(4);
    expect(screen.getAllByTestId("community-card")).toHaveLength(3);
  });

  it("keeps the classroom and community view-all actions at the 44px control height", () => {
    renderAuthenticatedHome();

    expect(screen.getByRole("button", { name: "查看全部课堂" })).toHaveClass("min-h-control");
    expect(screen.getByRole("button", { name: "查看全部社区" })).toHaveClass("min-h-control");
  });

  it("uses switchTab for first-level destinations", () => {
    renderAuthenticatedHome();

    fireEvent.click(screen.getByRole("button", { name: "查看全部悬赏" }));

    expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/bounty/index" });
  });

  it("renders the prototype header and switches to the messages tab", () => {
    renderAuthenticatedHome();

    expect(screen.getByText("早上好")).toBeInTheDocument();
    expect(screen.getByText("上海市 · 静安区")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开消息" }));
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/messages/index" });
  });

  it("renders three local brand banners in prototype order", () => {
    renderAuthenticatedHome();

    expect(screen.getAllByTestId("home-banner")).toHaveLength(3);
    expect(screen.getByText("毛孩子 · 专业上门宠物服务")).toBeInTheDocument();
    expect(screen.getByText("每一次照护，都有清晰记录")).toBeInTheDocument();
  });
});
