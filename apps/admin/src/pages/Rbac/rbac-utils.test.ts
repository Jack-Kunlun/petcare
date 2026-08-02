import type { RbacPermissionDefinition } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import { buildPermissionTree, collectCheckedCodes, togglePermissionTree } from "./rbac-utils";

const catalog: readonly RbacPermissionDefinition[] = [
  {
    code: "system.view",
    type: "menu",
    label: "System settings",
    module: "system",
    path: "/settings",
    parentCode: null,
    order: 20,
    icon: "Settings",
    impliedApiCodes: [],
  },
  {
    code: "system.api",
    type: "api",
    label: "Read settings API",
    module: "system",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  {
    code: "rbac.view",
    type: "menu",
    label: "Role management",
    module: "rbac",
    path: "/rbac",
    parentCode: "system.view",
    order: 30,
    icon: "ShieldCheck",
    impliedApiCodes: [],
  },
  {
    code: "rbac.role.update",
    type: "button",
    label: "Update role",
    module: "rbac",
    path: null,
    parentCode: "rbac.view",
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  {
    code: "rbac.role.create",
    type: "button",
    label: "Create role",
    module: "rbac",
    path: null,
    parentCode: "rbac.view",
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  {
    code: "orphan.button",
    type: "button",
    label: "Orphan action",
    module: "orphan",
    path: null,
    parentCode: "missing.menu",
    order: 1,
    icon: null,
    impliedApiCodes: [],
  },
];

describe("buildPermissionTree", () => {
  it("groups menu, button, and read-only API permissions deterministically", () => {
    expect(buildPermissionTree(catalog, [])).toEqual([
      {
        code: "orphan.button",
        type: "button",
        label: "Orphan action",
        path: null,
        children: [],
        checked: false,
        indeterminate: false,
      },
      {
        code: "system.api",
        type: "api",
        label: "Read settings API",
        path: null,
        children: [],
        checked: false,
        indeterminate: false,
      },
      {
        code: "system.view",
        type: "menu",
        label: "System settings",
        path: "/settings",
        children: [
          {
            code: "rbac.view",
            type: "menu",
            label: "Role management",
            path: "/rbac",
            children: [
              {
                code: "rbac.role.create",
                type: "button",
                label: "Create role",
                path: null,
                children: [],
                checked: false,
                indeterminate: false,
              },
              {
                code: "rbac.role.update",
                type: "button",
                label: "Update role",
                path: null,
                children: [],
                checked: false,
                indeterminate: false,
              },
            ],
            checked: false,
            indeterminate: false,
          },
        ],
        checked: false,
        indeterminate: false,
      },
    ]);
  });

  it("keeps effective API selections visible but excludes them from editable save payloads", () => {
    const tree = buildPermissionTree(catalog, ["system.view", "system.api", "rbac.role.create"]);

    expect(tree.find((node) => node.code === "system.api")).toMatchObject({
      type: "api",
      checked: true,
    });
    expect(collectCheckedCodes(tree)).toEqual(["system.view", "rbac.role.create"]);
  });

  it("marks selected permissions and their ancestors as half-selected when descendants differ", () => {
    const tree = buildPermissionTree(catalog, ["system.view", "rbac.role.create"]);

    expect(tree[2]).toMatchObject({ checked: true, indeterminate: true });
    expect(tree[2].children[0]).toMatchObject({ checked: false, indeterminate: true });
    expect(tree[2].children[0].children[0]).toMatchObject({ checked: true, indeterminate: false });
  });
});

describe("togglePermissionTree", () => {
  it("selects every descendant when a parent is toggled and leaves the original tree unchanged", () => {
    const tree = buildPermissionTree(catalog, ["system.view"]);
    const nextTree = togglePermissionTree(tree, "system.view");

    expect(nextTree).not.toBe(tree);
    expect(nextTree[2]).toMatchObject({ checked: true, indeterminate: false });
    expect(nextTree[2].children[0]).toMatchObject({ checked: true, indeterminate: false });
    expect(nextTree[2].children[0].children.map((node) => node.checked)).toEqual([true, true]);
    expect(tree[2].children[0].checked).toBe(false);
  });

  it("toggles a child independently and updates each ancestor to half-selected", () => {
    const tree = buildPermissionTree(catalog, [
      "system.view",
      "rbac.view",
      "rbac.role.create",
      "rbac.role.update",
    ]);
    const nextTree = togglePermissionTree(tree, "rbac.role.update");

    expect(nextTree[2]).toMatchObject({ checked: true, indeterminate: true });
    expect(nextTree[2].children[0]).toMatchObject({ checked: true, indeterminate: true });
    expect(nextTree[2].children[0].children.map((node) => node.checked)).toEqual([true, false]);
  });
});
