import { RBAC_PERMISSION_TYPES, type RbacPermissionDefinition } from "@petcare/shared-types";

/** A menu or button permission presented in the editable role permission tree. */
export interface PermissionTreeNode {
  /** Stable permission code submitted to the RBAC role API. */
  code: string;
  /** UI permission kind; API permissions are deliberately absent from this tree. */
  type: "menu" | "button";
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

type EditablePermissionDefinition = RbacPermissionDefinition & {
  type: PermissionTreeNode["type"];
};

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
 * API permissions are derived server-side from selected UI permissions and are never exposed as
 * editable nodes. A malformed catalog entry with no editable parent is retained as a root item so
 * an administrator can still identify and correct it.
 */
export function buildPermissionTree(
  catalog: readonly RbacPermissionDefinition[],
  selectedCodes: readonly string[],
): PermissionTreeNode[] {
  const selected = new Set(selectedCodes);
  const editable = catalog.filter(
    (permission): permission is EditablePermissionDefinition =>
      permission.type === RBAC_PERMISSION_TYPES.MENU ||
      permission.type === RBAC_PERMISSION_TYPES.BUTTON,
  );
  const definitionsByCode = new Map(editable.map((permission) => [permission.code, permission]));
  const childrenByParent = new Map<string, EditablePermissionDefinition[]>();

  for (const permission of editable) {
    if (!permission.parentCode || !definitionsByCode.has(permission.parentCode)) {
      continue;
    }

    const children = childrenByParent.get(permission.parentCode) ?? [];

    children.push(permission);
    childrenByParent.set(permission.parentCode, children);
  }

  function createNode(permission: EditablePermissionDefinition): PermissionTreeNode {
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

  return editable
    .filter((permission) => !permission.parentCode || !definitionsByCode.has(permission.parentCode))
    .sort(sortPermissions)
    .map(createNode);
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
