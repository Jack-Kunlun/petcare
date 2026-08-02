import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/auth";
import { AuthContext, type AuthContextValue } from "./auth.context";
import { PermissionGate } from "./PermissionGate";
import { usePermission, usePermissions } from "./permissions";

function createAuth(permissions: string[]): AuthContextValue {
  return {
    status: "authenticated",
    user: {
      id: "admin-1",
      username: "operator",
      phone: "17679141878",
      nickname: "Operator",
      roles: ["operator"],
      permissions,
    },
    loginWithPassword: vi.fn(),
    loginWithSms: vi.fn(),
    getCaptcha: vi.fn(),
    sendSmsCode: vi.fn(),
    logout: vi.fn(),
  };
}

function renderGate(permissions: string[], gate: ReactNode) {
  return render(
    <AuthContext.Provider value={createAuth(permissions)}>{gate}</AuthContext.Provider>,
  );
}

function PermissionProbe() {
  const permissions = usePermissions();
  const canPublish = usePermission("system.publish");

  return (
    <output>{`${permissions.has("system.view")}:${permissions.hasAll(["system.view", "system.publish"])}:${permissions.hasAny(["unknown", "system.publish"])}:${canPublish}`}</output>
  );
}

describe("PermissionGate", () => {
  it("hides children behind its fallback when the administrator has no matching permission", () => {
    renderGate(
      [],
      <PermissionGate all={["system.view"]} fallback={<span>Unavailable</span>}>
        <button type="button">Publish</button>
      </PermissionGate>,
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("renders only when every all permission is present", () => {
    const { rerender } = renderGate(
      ["system.view"],
      <PermissionGate all={["system.view", "system.publish"]} fallback={<span>Unavailable</span>}>
        <button type="button">Publish</button>
      </PermissionGate>,
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    rerender(
      <AuthContext.Provider value={createAuth(["system.view", "system.publish"])}>
        <PermissionGate all={["system.view", "system.publish"]} fallback={<span>Unavailable</span>}>
          <button type="button">Publish</button>
        </PermissionGate>
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("renders when any permission is present", () => {
    renderGate(
      ["system.publish"],
      <PermissionGate any={["system.view", "system.publish"]} fallback={<span>Unavailable</span>}>
        <button type="button">Publish</button>
      </PermissionGate>,
    );

    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("renders children explicitly when permission gating is disabled", () => {
    renderGate(
      [],
      <PermissionGate all={["system.publish"]} disabled fallback={<span>Unavailable</span>}>
        <button type="button">Publish</button>
      </PermissionGate>,
    );

    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("updates its helpers and rendered child when authenticated permissions change without API calls", () => {
    const getSpy = vi.spyOn(apiClient, "get");
    const postSpy = vi.spyOn(apiClient, "post");

    function PermissionState() {
      const [permissions, setPermissions] = useState<string[]>([]);

      return (
        <AuthContext.Provider value={createAuth(permissions)}>
          <PermissionProbe />
          <PermissionGate any={["system.publish"]} fallback={<span>Unavailable</span>}>
            <button type="button">Publish</button>
          </PermissionGate>
          <button type="button" onClick={() => setPermissions(["system.view", "system.publish"])}>
            Grant
          </button>
        </AuthContext.Provider>
      );
    }

    render(<PermissionState />);
    expect(screen.getByRole("status")).toHaveTextContent("false:false:false:false");
    expect(screen.getByText("Unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Grant" }));

    expect(screen.getByRole("status")).toHaveTextContent("true:true:true:true");
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  });
});
