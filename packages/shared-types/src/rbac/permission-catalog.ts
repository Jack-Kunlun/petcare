/** RBAC permission categories supported by the shared catalog. */
export const RBAC_PERMISSION_TYPES = {
  /** Menu entry used to expose an administration route. */
  MENU: "menu",
  /** Page action that can be granted at button level. */
  BUTTON: "button",
  /** Server endpoint permission derived from UI permissions. */
  API: "api",
} as const;

/** A permission category declared by the RBAC catalog. */
export type RbacPermissionType = (typeof RBAC_PERMISSION_TYPES)[keyof typeof RBAC_PERMISSION_TYPES];

/** A code-defined permission available to the administration system. */
export interface RbacPermissionDefinition {
  /** Stable authorization code stored in role assignments. */
  code: string;
  /** Whether the permission represents a menu, button, or server API. */
  type: RbacPermissionType;
  /** Human-readable permission name for administrative users. */
  label: string;
  /** Business module that owns the permission. */
  module: string;
  /** Administration route for menu permissions, otherwise null. */
  path: string | null;
  /** Parent menu code for nested menus and buttons, otherwise null. */
  parentCode: string | null;
  /** Stable display order within the parent menu. */
  order: number;
  /** Icon identifier for menu permissions, otherwise null. */
  icon: string | null;
  /** API permissions granted automatically with this UI permission. */
  impliedApiCodes: readonly string[];
}

/** The code-defined permission catalog enabled by the current personal-version runtime. */
export const RBAC_PERMISSION_CATALOG: readonly RbacPermissionDefinition[] = [
  /** Opens the current management overview in the administration console. */
  {
    code: "stats.view",
    type: "menu",
    label: "管理概览",
    module: "stats",
    path: "/",
    parentCode: null,
    order: 10,
    icon: "House",
    impliedApiCodes: [],
  },
  /** Opens the user management section in the administration console. */
  {
    code: "user.view",
    type: "menu",
    label: "用户管理",
    module: "user",
    path: "/users",
    parentCode: null,
    order: 20,
    icon: "Users",
    impliedApiCodes: ["user.read"],
  },
  /** Allows reading user lists and user details. */
  {
    code: "user.read",
    type: "api",
    label: "查看用户列表",
    module: "user",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows creating a user through the administration API. */
  {
    code: "user.create",
    type: "api",
    label: "创建用户",
    module: "user",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows updating user profile and account data. */
  {
    code: "user.update",
    type: "api",
    label: "更新用户",
    module: "user",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows deleting a user account. */
  {
    code: "user.delete",
    type: "api",
    label: "删除用户",
    module: "user",
    path: null,
    parentCode: null,
    order: 40,
    icon: null,
    impliedApiCodes: [],
  },
  /** 打开当前内容管理入口。 */
  {
    code: "content.view",
    type: "menu",
    label: "内容管理",
    module: "content",
    path: "/content",
    parentCode: null,
    order: 40,
    icon: "FileText",
    impliedApiCodes: [],
  },
  /** 打开社区帖子管理页面。 */
  {
    code: "content.post.view",
    type: "menu",
    label: "帖子管理",
    module: "content",
    path: "/content/posts",
    parentCode: "content.view",
    order: 20,
    icon: "FileText",
    impliedApiCodes: ["content.post.read"],
  },
  /** 允许读取后台帖子列表。 */
  {
    code: "content.post.read",
    type: "api",
    label: "查看帖子列表",
    module: "content",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** 允许运营人员审核和下架社区帖子。 */
  {
    code: "content.post.moderate",
    type: "button",
    label: "审核社区帖子",
    module: "content",
    path: null,
    parentCode: "content.post.view",
    order: 10,
    icon: null,
    impliedApiCodes: [
      "content.post.read",
      "content.post.report_read",
      "content.post.moderate_action",
    ],
  },
  /** 允许读取社区帖子举报人和举报原因。 */
  {
    code: "content.post.report_read",
    type: "api",
    label: "查看社区帖子举报",
    module: "content",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** 允许通过后台接口执行社区帖子审核命令。 */
  {
    code: "content.post.moderate_action",
    type: "api",
    label: "审核社区帖子接口",
    module: "content",
    path: null,
    parentCode: null,
    order: 40,
    icon: null,
    impliedApiCodes: [],
  },
  /** 打开文章管理页面。 */
  {
    code: "content.article.view",
    type: "menu",
    label: "文章管理",
    module: "content",
    path: "/content/articles",
    parentCode: "content.view",
    order: 30,
    icon: "FileText",
    impliedApiCodes: ["content.article.read"],
  },
  /** 允许读取后台课堂文章列表。 */
  {
    code: "content.article.read",
    type: "api",
    label: "查看课堂文章列表",
    module: "content",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** 允许编辑课堂文章草稿。 */
  {
    code: "content.article.write",
    type: "button",
    label: "编辑课堂文章",
    module: "content",
    path: null,
    parentCode: "content.article.view",
    order: 10,
    icon: null,
    impliedApiCodes: ["content.article.read", "content.article.write_action"],
  },
  /** 允许通过后台接口编辑课堂文章。 */
  {
    code: "content.article.write_action",
    type: "api",
    label: "编辑课堂文章接口",
    module: "content",
    path: null,
    parentCode: null,
    order: 40,
    icon: null,
    impliedApiCodes: [],
  },
  /** 允许发布、下线或重新发布课堂文章。 */
  {
    code: "content.article.publish",
    type: "button",
    label: "发布课堂文章",
    module: "content",
    path: null,
    parentCode: "content.article.view",
    order: 20,
    icon: null,
    impliedApiCodes: ["content.article.read", "content.article.publish_action"],
  },
  /** 允许通过后台接口修改课堂文章发布状态。 */
  {
    code: "content.article.publish_action",
    type: "api",
    label: "发布课堂文章接口",
    module: "content",
    path: null,
    parentCode: null,
    order: 50,
    icon: null,
    impliedApiCodes: [],
  },
  /** Opens Website Content management and its version history. */
  {
    code: "website.view",
    type: "menu",
    label: "内容配置",
    module: "website",
    path: "/website-content",
    parentCode: null,
    order: 50,
    icon: "Globe2",
    impliedApiCodes: ["website.read"],
  },
  /** Allows reading Website Content drafts, history, diffs, and media. */
  {
    code: "website.read",
    type: "api",
    label: "读取官网内容",
    module: "website",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows draft editing, media, and preview actions. */
  {
    code: "website.edit",
    type: "button",
    label: "编辑官网草稿",
    module: "website",
    path: null,
    parentCode: "website.view",
    order: 10,
    icon: null,
    impliedApiCodes: ["website.read", "website.edit_action"],
  },
  /** Allows saving drafts, managing media, and creating previews. */
  {
    code: "website.edit_action",
    type: "api",
    label: "编辑官网内容接口",
    module: "website",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows explicit publish and history-restore actions. */
  {
    code: "website.publish",
    type: "button",
    label: "发布官网内容",
    module: "website",
    path: null,
    parentCode: "website.view",
    order: 20,
    icon: null,
    impliedApiCodes: ["website.read", "website.publish_action"],
  },
  /** Allows page-scoped publishing and creating restore drafts. */
  {
    code: "website.publish_action",
    type: "api",
    label: "发布官网内容接口",
    module: "website",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** Opens role and permission management in the administration console. */
  {
    code: "rbac.view",
    type: "menu",
    label: "权限管理",
    module: "rbac",
    path: "/rbac",
    parentCode: null,
    order: 60,
    icon: "ShieldCheck",
    impliedApiCodes: ["rbac.permission.read", "rbac.role.read"],
  },
  /** Opens the read-only permission catalog under role management. */
  {
    code: "rbac.catalog.view",
    type: "menu",
    label: "菜单目录",
    module: "rbac",
    path: "/rbac/catalog",
    parentCode: "rbac.view",
    order: 70,
    icon: "ShieldCheck",
    impliedApiCodes: ["rbac.permission.read"],
  },
  /** Allows reading role lists and role details. */
  {
    code: "rbac.role.read",
    type: "api",
    label: "查看角色列表",
    module: "rbac",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the action for creating a role. */
  {
    code: "rbac.role.create",
    type: "button",
    label: "创建角色",
    module: "rbac",
    path: null,
    parentCode: "rbac.view",
    order: 10,
    icon: null,
    impliedApiCodes: ["rbac.role.create_action"],
  },
  /** Allows creating a role through the RBAC API. */
  {
    code: "rbac.role.create_action",
    type: "api",
    label: "创建角色接口",
    module: "rbac",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the action for editing a role. */
  {
    code: "rbac.role.update",
    type: "button",
    label: "更新角色",
    module: "rbac",
    path: null,
    parentCode: "rbac.view",
    order: 20,
    icon: null,
    impliedApiCodes: ["rbac.role.update_action"],
  },
  /** Allows updating role metadata and assigned permissions. */
  {
    code: "rbac.role.update_action",
    type: "api",
    label: "更新角色接口",
    module: "rbac",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the action for deleting a non-system role. */
  {
    code: "rbac.role.delete",
    type: "button",
    label: "删除角色",
    module: "rbac",
    path: null,
    parentCode: "rbac.view",
    order: 30,
    icon: null,
    impliedApiCodes: ["rbac.role.delete_action"],
  },
  /** Allows deleting a non-system role through the RBAC API. */
  {
    code: "rbac.role.delete_action",
    type: "api",
    label: "删除角色接口",
    module: "rbac",
    path: null,
    parentCode: null,
    order: 40,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows reading the code-defined permission catalog. */
  {
    code: "rbac.permission.read",
    type: "api",
    label: "查看权限点",
    module: "rbac",
    path: null,
    parentCode: null,
    order: 50,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the action for assigning users to a role. */
  {
    code: "rbac.assign_role",
    type: "button",
    label: "分配用户角色",
    module: "rbac",
    path: null,
    parentCode: "rbac.view",
    order: 40,
    icon: null,
    impliedApiCodes: ["rbac.assign_role_action"],
  },
  /** Allows replacing the users assigned to a role. */
  {
    code: "rbac.assign_role_action",
    type: "api",
    label: "分配用户角色接口",
    module: "rbac",
    path: null,
    parentCode: null,
    order: 60,
    icon: null,
    impliedApiCodes: [],
  },
];

/** Looks up a catalog permission by its stable authorization code. */
export function getRbacPermission(code: string): RbacPermissionDefinition | undefined {
  return RBAC_PERMISSION_CATALOG.find((permission) => permission.code === code);
}

/** Returns the current catalog version identifier. */
export function getRbacCatalogVersion(): string {
  return "2026-08-27";
}

/** Returns the menu and button codes that role editors may assign. */
export function getRbacUiPermissionCodes(): readonly string[] {
  return RBAC_PERMISSION_CATALOG.filter(
    (permission) => permission.type !== RBAC_PERMISSION_TYPES.API,
  ).map((permission) => permission.code);
}
