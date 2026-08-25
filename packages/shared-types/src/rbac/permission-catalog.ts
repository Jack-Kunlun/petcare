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

/** The complete, code-defined RBAC permission catalog. */
export const RBAC_PERMISSION_CATALOG: readonly RbacPermissionDefinition[] = [
  /** Opens the operations dashboard in the administration console. */
  {
    code: "stats.view",
    type: "menu",
    label: "运营概览",
    module: "stats",
    path: "/",
    parentCode: null,
    order: 10,
    icon: "House",
    impliedApiCodes: ["stats.dashboard"],
  },
  /** Allows reading aggregated operations dashboard metrics. */
  {
    code: "stats.dashboard",
    type: "api",
    label: "查看运营数据",
    module: "stats",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
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
  /** Shows the action for approving a service provider application. */
  {
    code: "user.approve_provider",
    type: "button",
    label: "审核服务提供者",
    module: "user",
    path: null,
    parentCode: "user.view",
    order: 10,
    icon: null,
    impliedApiCodes: ["provider_certification.approve"],
  },
  /** Shows the action for rejecting a service provider application. */
  {
    code: "user.reject_provider",
    type: "button",
    label: "驳回服务提供者",
    module: "user",
    path: null,
    parentCode: "user.view",
    order: 20,
    icon: null,
    impliedApiCodes: ["provider_certification.reject"],
  },
  /** Opens the provider certification review page under user management. */
  {
    code: "provider_certification.view",
    type: "menu",
    label: "认证审核",
    module: "provider_certification",
    path: "/users/certifications",
    parentCode: "user.view",
    order: 30,
    icon: "BadgeCheck",
    impliedApiCodes: ["provider_certification.read"],
  },
  /** Allows reading provider certification applications. */
  {
    code: "provider_certification.read",
    type: "api",
    label: "查看认证申请",
    module: "provider_certification",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows approving a provider certification application. */
  {
    code: "provider_certification.approve",
    type: "api",
    label: "通过认证申请",
    module: "provider_certification",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows rejecting a provider certification application. */
  {
    code: "provider_certification.reject",
    type: "api",
    label: "驳回认证申请",
    module: "provider_certification",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** Opens the order management section in the administration console. */
  {
    code: "order.view",
    type: "menu",
    label: "订单管理",
    module: "order",
    path: "/orders",
    parentCode: null,
    order: 30,
    icon: "ShoppingBag",
    impliedApiCodes: ["order.read"],
  },
  /** Allows reading order lists and order details. */
  {
    code: "order.read",
    type: "api",
    label: "查看订单列表",
    module: "order",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows creating an order through the administration API. */
  {
    code: "order.create",
    type: "api",
    label: "创建订单",
    module: "order",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** Allows updating order state and order data. */
  {
    code: "order.update",
    type: "api",
    label: "更新订单",
    module: "order",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the action for cancelling an order. */
  {
    code: "order.cancel",
    type: "button",
    label: "取消订单",
    module: "order",
    path: null,
    parentCode: "order.view",
    order: 10,
    icon: null,
    impliedApiCodes: ["order.update"],
  },
  /** Shows the action for exporting order data. */
  {
    code: "order.export",
    type: "button",
    label: "导出订单数据",
    module: "order",
    path: null,
    parentCode: "order.view",
    order: 20,
    icon: null,
    impliedApiCodes: ["order.export_data"],
  },
  /** Allows the server to generate and return an order export. */
  {
    code: "order.export_data",
    type: "api",
    label: "导出订单数据接口",
    module: "order",
    path: null,
    parentCode: null,
    order: 40,
    icon: null,
    impliedApiCodes: [],
  },
  /** Opens complaint and dispute handling under order management. */
  {
    code: "dispute.view",
    type: "menu",
    label: "投诉与纠纷",
    module: "dispute",
    path: "/orders/complaints",
    parentCode: "order.view",
    order: 30,
    icon: "MessageSquareWarning",
    impliedApiCodes: ["dispute.read"],
  },
  /** Allows reading complaint and dispute records. */
  {
    code: "dispute.read",
    type: "api",
    label: "查看投诉列表",
    module: "dispute",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the action for resolving a complaint or dispute. */
  {
    code: "dispute.resolve",
    type: "button",
    label: "处理投诉纠纷",
    module: "dispute",
    path: null,
    parentCode: "dispute.view",
    order: 10,
    icon: null,
    impliedApiCodes: ["dispute.resolve_action"],
  },
  /** Allows submitting a complaint or dispute resolution. */
  {
    code: "dispute.resolve_action",
    type: "api",
    label: "处理投诉纠纷接口",
    module: "dispute",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** 打开内容管理并查看悬赏内容。 */
  {
    code: "content.view",
    type: "menu",
    label: "内容管理",
    module: "content",
    path: "/content",
    parentCode: null,
    order: 40,
    icon: "FileText",
    impliedApiCodes: ["content.reward.read"],
  },
  /** 允许读取后台悬赏内容列表。 */
  {
    code: "content.reward.read",
    type: "api",
    label: "查看悬赏内容",
    module: "content",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
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
  /** Opens the system settings section in the administration console. */
  {
    code: "system.view",
    type: "menu",
    label: "系统设置",
    module: "system",
    path: "/settings",
    parentCode: null,
    order: 60,
    icon: "Settings",
    impliedApiCodes: ["system.read"],
  },
  /** Allows reading effective system settings and configuration drafts. */
  {
    code: "system.read",
    type: "api",
    label: "查看系统设置",
    module: "system",
    path: null,
    parentCode: null,
    order: 10,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the general system configuration action. */
  {
    code: "system.config",
    type: "button",
    label: "系统配置",
    module: "system",
    path: null,
    parentCode: "system.view",
    order: 10,
    icon: null,
    impliedApiCodes: ["system.config_action"],
  },
  /** Allows saving general system configuration changes. */
  {
    code: "system.config_action",
    type: "api",
    label: "系统配置接口",
    module: "system",
    path: null,
    parentCode: null,
    order: 20,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the service SOP configuration action. */
  {
    code: "system.sop_config",
    type: "button",
    label: "SOP 配置",
    module: "system",
    path: null,
    parentCode: "system.view",
    order: 20,
    icon: null,
    impliedApiCodes: ["system.sop_config_action"],
  },
  /** Allows saving service SOP configuration changes. */
  {
    code: "system.sop_config_action",
    type: "api",
    label: "SOP 配置接口",
    module: "system",
    path: null,
    parentCode: null,
    order: 30,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the rating threshold configuration action. */
  {
    code: "system.threshold_config",
    type: "button",
    label: "评分阈值配置",
    module: "system",
    path: null,
    parentCode: "system.view",
    order: 30,
    icon: null,
    impliedApiCodes: ["system.threshold_config_action"],
  },
  /** Allows saving rating threshold configuration changes. */
  {
    code: "system.threshold_config_action",
    type: "api",
    label: "评分阈值配置接口",
    module: "system",
    path: null,
    parentCode: null,
    order: 40,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the service fee configuration action. */
  {
    code: "system.fee_config",
    type: "button",
    label: "费率配置",
    module: "system",
    path: null,
    parentCode: "system.view",
    order: 40,
    icon: null,
    impliedApiCodes: ["system.fee_config_action"],
  },
  /** Allows saving service fee configuration changes. */
  {
    code: "system.fee_config_action",
    type: "api",
    label: "费率配置接口",
    module: "system",
    path: null,
    parentCode: null,
    order: 50,
    icon: null,
    impliedApiCodes: [],
  },
  /** Shows the action for publishing system configuration drafts. */
  {
    code: "system.publish",
    type: "button",
    label: "发布系统设置",
    module: "system",
    path: null,
    parentCode: "system.view",
    order: 50,
    icon: null,
    impliedApiCodes: ["system.publish_action"],
  },
  /** Allows publishing a system configuration version. */
  {
    code: "system.publish_action",
    type: "api",
    label: "发布系统设置接口",
    module: "system",
    path: null,
    parentCode: null,
    order: 60,
    icon: null,
    impliedApiCodes: [],
  },
  /** Opens role and permission management under system settings. */
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
  /** Opens the read-only permission catalog under system settings. */
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
  return "2026-08-02";
}

/** Returns the menu and button codes that role editors may assign. */
export function getRbacUiPermissionCodes(): readonly string[] {
  return RBAC_PERMISSION_CATALOG.filter(
    (permission) => permission.type !== RBAC_PERMISSION_TYPES.API,
  ).map((permission) => permission.code);
}
