export type HelpCategory = "使用与账号" | "发布与沟通" | "照护过程" | "费用与售后" | "照护者帮助";

export interface HelpArticle {
  slug: string;
  category: HelpCategory;
  title: string;
  summary: string;
  keywords: string;
  answer: string;
  steps: string[];
}

export const helpCategories: Array<{ id: HelpCategory; label: string }> = [
  { id: "使用与账号", label: "使用与账号" },
  { id: "发布与沟通", label: "发布与沟通" },
  { id: "照护过程", label: "照护过程" },
  { id: "费用与售后", label: "费用与售后" },
  { id: "照护者帮助", label: "照护者帮助" },
];

export const helpArticles: HelpArticle[] = [
  {
    slug: "create-pet-profile",
    category: "使用与账号",
    title: "如何创建宠物档案？",
    summary: "登录后进入宠物管理，填写资料并上传本人宠物照片。",
    keywords: "账号 资料 宠物 档案 照片 登录",
    answer:
      "登录小程序后进入宠物管理，选择新增宠物，填写基础资料并保存。宠物照片和备注只应使用本人有权管理的内容。",
    steps: [
      "登录 PetCare 小程序。",
      "进入宠物管理并选择新增宠物。",
      "填写基础资料、习惯和需要留意的事项。",
      "上传照片并保存。",
    ],
  },
  {
    slug: "publish-care-request",
    category: "发布与沟通",
    title: "如何发布照护需求？",
    summary: "写清时间、地点、宠物情况和需要完成的照护内容。",
    keywords: "悬赏 服务 发布 需求 时间 地点 照护",
    answer:
      "在小程序进入照护服务，填写时间、地点、宠物情况、照护内容和注意事项，再提交需求。提交前请确认信息完整且符合实际需要。",
    steps: [
      "进入照护服务入口。",
      "填写时间、地点和宠物情况。",
      "说明照护内容、注意事项和希望的结果。",
      "提交后等待沟通确认。",
    ],
  },
  {
    slug: "confirm-service",
    category: "发布与沟通",
    title: "如何确认一次照护服务？",
    summary: "双方确认服务范围、时间、地点和交付边界后再开始。",
    keywords: "沟通 确认 服务范围 时间 地点 订单",
    answer:
      "双方应在开始前确认服务范围、时间、地点、注意事项和完成标准。确认内容应以小程序里的实际记录为准。",
    steps: [
      "查看需求中的宠物资料和照护要求。",
      "与对方确认能否按约定完成。",
      "核对时间、地点、范围和完成标准。",
      "确认记录后再进入服务步骤。",
    ],
  },
  {
    slug: "check-care-progress",
    category: "照护过程",
    title: "去哪里查看照护进度？",
    summary: "进入对应订单或服务记录，查看当前步骤和已留下的过程信息。",
    keywords: "订单 状态 进度 服务 步骤 消息 记录",
    answer:
      "进入小程序中的对应订单或服务记录，即可查看当前状态、沟通信息和已经提交的过程记录。页面展示以实际订单状态为准。",
    steps: [
      "打开小程序中的订单或服务记录。",
      "查看当前步骤和双方消息。",
      "查看已经提交的图片、备注或状态。",
      "需要说明问题时在对应记录中反馈。",
    ],
  },
  {
    slug: "complete-feedback",
    category: "照护过程",
    title: "如何完成评价？",
    summary: "确认照护结果后，在对应记录中留下评价和必要说明。",
    keywords: "完成 评价 反馈 结果 异常",
    answer:
      "照护完成后先核对结果和过程记录，再在对应订单中提交评价。遇到异常时，应同时保留具体说明和相关证据。",
    steps: [
      "打开已完成或待确认的服务记录。",
      "核对照护结果和过程信息。",
      "提交评价或异常说明。",
      "保留与问题相关的记录。",
    ],
  },
  {
    slug: "payment-and-settlement",
    category: "费用与售后",
    title: "支付和结算什么时候生效？",
    summary: "体验流程和真实资金流分别记录，真实收款与出款以配置为准。",
    keywords: "支付 退款 结算 收入 提现 配置 费用",
    answer:
      "订单页面可以展示支付、退款和账务状态。真实收款、退款、结算与提现是否可用，以经营主体、商户账户和出款配置完成情况为准。",
    steps: [
      "在订单中查看当前支付或账务状态。",
      "需要退款时先查看对应规则和订单状态。",
      "收入与结算状态以实际账务记录为准。",
      "配置未完成时不会把体验状态当作真实出款。",
    ],
  },
  {
    slug: "caregiver-qualification",
    category: "照护者帮助",
    title: "照护者如何申请资格？",
    summary: "提交服务范围和必要资料后，等待平台审核结果。",
    keywords: "服务者 照护者 资格 申请 审核 资料",
    answer:
      "照护者需要先确认自己能承担的服务范围和时间，再按小程序或平台当前入口提交必要资料。资格状态以审核结果为准。",
    steps: [
      "确认可承担的服务范围和时间。",
      "准备平台要求的必要资料。",
      "从当前有效入口提交申请。",
      "等待审核结果并按状态继续。",
    ],
  },
  {
    slug: "report-a-problem",
    category: "费用与售后",
    title: "遇到问题如何反馈？",
    summary: "在对应内容或订单中提交说明，尽量附上页面、编号和发生时间。",
    keywords: "内容 服务 问题 举报 异常 反馈 联系 客服",
    answer:
      "优先在对应订单或内容中提交问题说明。请写清页面、订单编号、发生时间和已经看到的状态；正式客服渠道以平台配置为准。",
    steps: [
      "记录发生问题的页面或订单。",
      "准备订单编号、发生时间和具体现象。",
      "在对应入口提交反馈或举报。",
      "保留提交后的记录，等待后续处理。",
    ],
  },
];

export function getHelpArticle(slug: string | undefined): HelpArticle | undefined {
  return helpArticles.find((article) => article.slug === slug);
}
