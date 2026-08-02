import { RBAC_PERMISSION_TYPES, type RbacPermissionDefinition } from "@petcare/shared-types";

/** A catalog permission presented in the role permission tree. */
export interface PermissionTreeNode {
  /** Stable permission code submitted to the RBAC role API. */
  code: string;
  /** Permission kind; API nodes are rendered as read-only information. */
  type: "menu" | "button" | "api";
  /** Administrator-facing permission label. */
  label: string;
  /** Menu route, or null for an action button. */
  path: string | null;
  /** Child menus and actions in deterministic catalog order. */
  children: PermissionTreeNode[];
  /** Whether this permission itself is selected. */
  checked: boolean;
  /** Whether a descendant is selected but the descendant branch is incomplete. */
  indeterminate: boolean;
}

/** Returns whether an API mutation failed because the resource changed concurrently. */
export function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    error.response.status === 409
  );
}

function sortPermissions(left: RbacPermissionDefinition, right: RbacPermissionDefinition): number {
  return left.order - right.order || left.code.localeCompare(right.code);
}

function deriveIndeterminate(node: PermissionTreeNode): PermissionTreeNode {
  const children = node.children.map((child) => deriveIndeterminate(child));
  const branchHasSelection =
    node.checked || children.some((child) => child.checked || child.indeterminate);
  const branchIsComplete =
    node.checked && children.every((child) => child.checked && !child.indeterminate);

  return {
    ...node,
    children,
    indeterminate: children.length > 0 && branchHasSelection && !branchIsComplete,
  };
}

/**
 * Builds the editable UI permission hierarchy from the server-owned catalog.
 *
 * API permissions are derived server-side from selected UI permissions and are exposed as
 * read-only nodes. A malformed catalog entry with no known parent is retained as a root item so
 * an administrator can still identify it.
 */
export function buildPermissionTree(
  catalog: readonly RbacPermissionDefinition[],
  selectedCodes: readonly string[],
): PermissionTreeNode[] {
  const selected = new Set(selectedCodes);
  const definitionsByCode = new Map(catalog.map((permission) => [permission.code, permission]));
  const childrenByParent = new Map<string, RbacPermissionDefinition[]>();

  for (const permission of catalog) {
    if (!permission.parentCode || !definitionsByCode.has(permission.parentCode)) {
      continue;
    }

    const children = childrenByParent.get(permission.parentCode) ?? [];

    children.push(permission);
    childrenByParent.set(permission.parentCode, children);
  }

  function createNode(permission: RbacPermissionDefinition): PermissionTreeNode {
    const children = (childrenByParent.get(permission.code) ?? [])
      .sort(sortPermissions)
      .map(createNode);

    return deriveIndeterminate({
      code: permission.code,
      type: permission.type,
      label: permission.label,
      path: permission.path,
      children,
      checked: selected.has(permission.code),
      indeterminate: false,
    });
  }

  return catalog
    .filter((permission) => !permission.parentCode || !definitionsByCode.has(permission.parentCode))
    .sort(sortPermissions)
    .map(createNode);
}

/** Collects checked menu and button codes while excluding read-only API nodes. */
export function collectCheckedCodes(nodes: readonly PermissionTreeNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.type === RBAC_PERMISSION_TYPES.API || !node.checked ? [] : [node.code]),
    ...collectCheckedCodes(node.children),
  ]);
}

function containsCode(nodes: readonly PermissionTreeNode[], code: string): boolean {
  return nodes.some(
    (node) => node.code === code || (node.children.length > 0 && containsCode(node.children, code)),
  );
}

function setBranchChecked(node: PermissionTreeNode, checked: boolean): PermissionTreeNode {
  return {
    ...node,
    checked,
    indeterminate: false,
    children: node.children.map((child) => setBranchChecked(child, checked)),
  };
}

function toggleNode(node: PermissionTreeNode, code: string): PermissionTreeNode {
  if (node.type === RBAC_PERMISSION_TYPES.API) {
    return node;
  }

  if (node.code === code) {
    const shouldCheck = !node.checked || node.indeterminate;
    const nextNode = setBranchChecked(node, shouldCheck);

    return {
      ...nextNode,
      children: nextNode.children.map((child) => toggleNode(child, code)),
    };
  }

  return {
    ...node,
    children: node.children.map((child) => toggleNode(child, code)),
  };
}

/**
 * Returns an immutable permission tree after toggling the selected node and all of its descendants.
 * A half-selected parent becomes fully selected; a fully selected parent becomes fully cleared.
 */
export function togglePermissionTree(
  tree: readonly PermissionTreeNode[],
  code: string,
): PermissionTreeNode[] {
  if (!containsCode(tree, code)) {
    return [...tree];
  }

  return tree.map((node) => deriveIndeterminate(toggleNode(node, code)));
}
