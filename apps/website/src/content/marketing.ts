export type MarketingImage = {
  src: string;
  alt: string;
};

export type MarketingItem = {
  label?: string;
  title: string;
  description: string;
  href?: string;
  image?: MarketingImage;
};

export type MarketingSection =
  | {
      kind: "cards";
      id: string;
      eyebrow: string;
      title: string;
      description: string;
      tone?: "white" | "soft" | "dark";
      items: MarketingItem[];
    }
  | {
      kind: "split";
      id: string;
      eyebrow: string;
      title: string;
      description: string;
      tone?: "white" | "soft" | "dark";
      image: MarketingImage;
      action?: { label: string; href: string };
    }
  | {
      kind: "timeline";
      id: string;
      eyebrow: string;
      title: string;
      description: string;
      tone?: "white" | "soft" | "dark";
      items: MarketingItem[];
    }
  | {
      kind: "note";
      id: string;
      eyebrow: string;
      title: string;
      description: string;
      tone?: "white" | "soft" | "dark";
    };

export type MarketingPage = {
  title: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroImage?: MarketingImage;
  heroActions?: Array<{ label: string; href: string; secondary?: boolean }>;
  sections: MarketingSection[];
  cta?: { eyebrow: string; title: string; description: string; href: string; label: string };
};

const heroImage: MarketingImage = {
  src: "/brand/hero-community-companion-desktop-v1.webp",
  alt: "猫和狗在自然光下安心相伴",
};

const petRecordImage: MarketingImage = {
  src: "/brand/pet-life-feeding.jpg",
  alt: "宠物在日常生活中的状态记录",
};

const careImage: MarketingImage = {
  src: "/brand/pet-life-grooming.jpg",
  alt: "主人在家中照顾宠物",
};

const storiesImage: MarketingImage = {
  src: "/brand/pet-life-playing.jpg",
  alt: "宠物在户外自在互动",
};

export const marketingPages: Record<string, MarketingPage> = {
  product: {
    title: "产品能力 | PetCare 宠伴",
    description: "了解 PetCare 的宠物档案、内容、社区、服务订单与安全能力。",
    eyebrow: "PetCare 产品能力",
    heroTitle: "从记录宠物，到协作完成一次照顾",
    heroDescription: "PetCare 把宠物档案、养宠内容、社区互动和服务流程放在同一个清晰的使用路径里。",
    heroImage,
    heroActions: [
      { label: "查看服务流程", href: "/service-flow" },
      { label: "打开微信小程序", href: "/miniapp", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "product-pillars",
        eyebrow: "六项核心能力",
        title: "每一项能力，都对应一个真实使用场景",
        description: "从个人资料开始，逐步连接内容、社区、服务和账务记录。",
        tone: "soft",
        items: [
          {
            label: "01",
            title: "宠物档案",
            description: "集中维护宠物基础资料、习惯、照片和健康备注。",
          },
          {
            label: "02",
            title: "宠物课堂",
            description: "按主题阅读养宠知识、服务指南和平台规则。",
          },
          {
            label: "03",
            title: "社区互动",
            description: "分享宠物日常，参与审核通过的内容和互动。",
          },
          {
            label: "04",
            title: "悬赏服务",
            description: "发布照顾需求，明确服务范围、时间和交付结果。",
          },
          {
            label: "05",
            title: "订单与 SOP",
            description: "把服务步骤、过程记录和完成状态组织在一个订单里。",
          },
          { label: "06", title: "支付与结算", description: "记录订单支付、退款、收入和结算状态。" },
        ],
      },
      {
        kind: "split",
        id: "product-continuity",
        eyebrow: "连续的使用路径",
        title: "从一张照片开始，到一份可回看的服务记录",
        description:
          "宠物资料、服务图片、SOP 步骤和消息通知都有明确归属，用户可以在不同阶段回到同一条记录继续处理。",
        image: petRecordImage,
        action: { label: "了解宠物主人端", href: "/for-pet-owners" },
      },
      {
        kind: "note",
        id: "product-status",
        eyebrow: "能力状态",
        title: "已开放、体验开放和配置后启用会分别说明",
        description:
          "账号、宠物档案、课堂和社区属于已开放能力；悬赏、订单、资格、SOP 和支付流程提供体验链路；真实商户支付、结算和提现需要经营主体与账户配置完成后启用。",
        tone: "dark",
      },
    ],
  },
  "for-pet-owners": {
    title: "宠物主人 | PetCare 宠伴",
    description: "了解宠物主人如何记录宠物、发布需求、跟进服务并参与社区。",
    eyebrow: "宠物主人",
    heroTitle: "把对它的牵挂，变成看得见的日常",
    heroDescription: "从宠物档案到服务完成，主人可以持续查看资料、进度、消息和服务记录。",
    heroImage: petRecordImage,
    heroActions: [
      { label: "查看悬赏服务", href: "/rewards" },
      { label: "打开微信小程序", href: "/miniapp", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "owner-capabilities",
        eyebrow: "主人端能力",
        title: "日常、内容和服务，都从宠物档案开始",
        description: "只维护本人宠物资料，让每次记录都有清楚的归属。",
        items: [
          { title: "创建宠物档案", description: "记录基础信息、生活习惯、照片和重要备注。" },
          { title: "发布照顾需求", description: "描述时间、地点、服务内容和希望的交付结果。" },
          { title: "跟进服务进度", description: "查看订单状态、服务步骤、图片和消息通知。" },
          { title: "参与宠物社区", description: "分享日常内容，浏览审核通过的动态并参与互动。" },
        ],
      },
      {
        kind: "timeline",
        id: "owner-journey",
        eyebrow: "主人使用路径",
        title: "每一步都有明确结果",
        description: "页面会围绕当前步骤展示下一项操作，减少来回寻找。",
        tone: "soft",
        items: [
          { title: "记录宠物", description: "先建立完整的宠物资料和照片记录。" },
          { title: "发布需求", description: "写清楚服务时间、内容和特殊注意事项。" },
          { title: "确认服务", description: "查看服务者信息、订单范围和服务步骤。" },
          { title: "查看过程", description: "在订单中接收图片、SOP 状态和消息更新。" },
          { title: "完成评价", description: "确认服务结果并留下可回看的评价记录。" },
        ],
      },
      {
        kind: "split",
        id: "owner-record",
        eyebrow: "持续可查",
        title: "重要的资料，不再散落在聊天记录里",
        description: "宠物资料、服务过程和图片按宠物与订单归档，后续查看时能快速找到上下文。",
        image: careImage,
        action: { label: "查看安全与保障", href: "/trust" },
      },
    ],
    cta: {
      eyebrow: "从一次记录开始",
      title: "先为它建立一份清楚的档案",
      description: "打开小程序，开始记录宠物的资料和日常。",
      href: "/miniapp",
      label: "开始使用",
    },
  },
  "for-providers": {
    title: "服务者 | PetCare 宠伴",
    description: "了解服务者如何申请资格、执行 SOP、提交记录并查看收入。",
    eyebrow: "服务者",
    heroTitle: "让每一次服务，都有步骤、有记录、有依据",
    heroDescription: "服务者从资格申请开始，在订单中确认范围、执行 SOP、提交服务证据并完成交付。",
    heroImage: careImage,
    heroActions: [
      { label: "查看服务流程", href: "/service-flow" },
      { label: "了解支付与结算", href: "/payments", secondary: true },
    ],
    sections: [
      {
        kind: "timeline",
        id: "provider-journey",
        eyebrow: "服务者路径",
        title: "从申请资格，到完成一次可审计的服务",
        description: "每个阶段都有对应的页面状态和交付记录。",
        tone: "soft",
        items: [
          { title: "提交资格", description: "填写服务范围、经验和必要资料，等待平台审核。" },
          { title: "确认订单", description: "了解宠物资料、服务时间、地点和注意事项。" },
          { title: "执行 SOP", description: "按照订单步骤完成照顾、沟通和过程记录。" },
          { title: "提交证据", description: "上传服务图片、备注和完成状态。" },
          { title: "完成交付", description: "由主人确认结果，订单进入收入记录。" },
        ],
      },
      {
        kind: "cards",
        id: "provider-tools",
        eyebrow: "服务工具",
        title: "把经验变成稳定的服务过程",
        description: "订单、SOP 和收入记录相互关联，方便复盘和持续改进。",
        items: [
          { title: "资格与范围", description: "明确可以承接的服务类型和可用时间。" },
          { title: "订单工作台", description: "集中查看待处理、进行中和已完成的服务。" },
          { title: "SOP 记录", description: "按步骤完成任务，减少关键环节遗漏。" },
          { title: "只读收入", description: "查看订单收入、账务变化和当前结算状态。" },
        ],
      },
      {
        kind: "note",
        id: "provider-status",
        eyebrow: "资格和收入状态",
        title: "资格审核与真实出款以平台配置为准",
        description:
          "体验环境可以查看申请、订单和账务流程；真实商户支付、结算和提现需要主体、账户及相关配置完成。",
        tone: "dark",
      },
    ],
  },
  rewards: {
    title: "悬赏服务 | PetCare 宠伴",
    description: "了解 PetCare 悬赏服务从发布需求到完成订单的完整流程。",
    eyebrow: "悬赏服务",
    heroTitle: "把一次临时照顾，变成一条清楚的服务流程",
    heroDescription: "主人发布需求，服务者确认范围，双方在订单中完成沟通、服务、记录和评价。",
    heroImage: storiesImage,
    heroActions: [
      { label: "查看完整流程", href: "/service-flow" },
      { label: "查看支付说明", href: "/payments", secondary: true },
    ],
    sections: [
      {
        kind: "timeline",
        id: "reward-flow",
        eyebrow: "订单主流程",
        title: "从需求到交付，每个节点都可回看",
        description: "订单将需求、沟通、服务证据和完成状态放在同一条记录里。",
        items: [
          { title: "发布需求", description: "说明宠物情况、服务时间、地点和期望结果。" },
          { title: "服务响应", description: "查看服务者资料、服务范围和可用时间。" },
          { title: "确认订单", description: "确认服务内容、费用、时间和双方责任。" },
          { title: "服务执行", description: "按 SOP 完成照顾，并上传过程记录。" },
          { title: "完成评价", description: "确认结果，处理异常并留下服务评价。" },
        ],
        tone: "soft",
      },
      {
        kind: "cards",
        id: "reward-safeguards",
        eyebrow: "订单保障",
        title: "让双方都知道现在进行到哪一步",
        description: "状态、记录和责任边界比装饰性的承诺更重要。",
        items: [
          { title: "范围清楚", description: "订单明确服务内容、时间、地点和注意事项。" },
          { title: "过程留痕", description: "关键步骤和图片记录与订单关联。" },
          { title: "异常可反馈", description: "出现问题时可以提交说明并保留处理记录。" },
          { title: "结果可确认", description: "服务完成后由订单双方确认结果。" },
        ],
      },
      {
        kind: "note",
        id: "reward-payment",
        eyebrow: "支付说明",
        title: "订单流程可以体验，真实收款和出款另有配置条件",
        description:
          "当前体验环境支持订单与支付回调流程；真实收款、退款、结算与提现将在经营主体、商户账户和出款配置完成后启用。",
        tone: "dark",
      },
    ],
  },
  payments: {
    title: "支付与结算 | PetCare 宠伴",
    description: "了解 PetCare 的支付、退款、账务、结算和提现状态。",
    eyebrow: "支付与结算",
    heroTitle: "每一笔订单，都有清楚的账务状态",
    heroDescription: "支付、退款、收入和结算分别记录，订单状态与账务状态不会混在一起。",
    heroImage: petRecordImage,
    heroActions: [
      { label: "查看悬赏服务", href: "/rewards" },
      { label: "查看安全保障", href: "/trust", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "payment-states",
        eyebrow: "账务能力",
        title: "从订单支付，到只读收入记录",
        description: "用户看到的是清楚的状态，后台保留完整的审计关系。",
        items: [
          { title: "订单支付", description: "支付请求与订单绑定，记录订单应付状态。" },
          { title: "回调处理", description: "支付结果通过回调进入订单和账务状态。" },
          { title: "退款处理", description: "退款申请、结果和订单状态保持关联。" },
          { title: "不可变账务", description: "收入和账务记录保留变更关系，方便核对。" },
          { title: "只读收入", description: "服务者可以查看收入来源和当前可结算状态。" },
          { title: "结算准备", description: "主体、账户和手续费规则配置后再启用真实出款。" },
        ],
        tone: "soft",
      },
      {
        kind: "split",
        id: "payment-boundary",
        eyebrow: "边界清楚",
        title: "体验流程和真实资金流分开管理",
        description:
          "体验环境可以验证订单、回调和账务展示；真实资金流需要经营主体、商户账户、退款责任和出款渠道全部配置完成。",
        image: careImage,
        action: { label: "查看平台规则", href: "/platform-rules" },
      },
      {
        kind: "note",
        id: "payment-status",
        eyebrow: "当前状态",
        title: "真实收款和提现不会被体验状态伪装",
        description:
          "页面保持正常的订单展示，但真实收款、退款、结算与提现仍以平台主体、商户和出款配置为准。",
        tone: "dark",
      },
    ],
  },
  trust: {
    title: "安全与保障 | PetCare 宠伴",
    description: "了解 PetCare 如何管理宠物资料、图片、资格、服务记录和社区内容。",
    eyebrow: "安全与保障",
    heroTitle: "让每一次记录，都有清楚的归属和边界",
    heroDescription: "从资料权限到服务证据，PetCare 用可追溯的状态和明确的责任边界保护日常记录。",
    heroImage: careImage,
    heroActions: [
      { label: "查看隐私政策", href: "/privacy" },
      { label: "阅读帮助中心", href: "/help", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "trust-pillars",
        eyebrow: "五个保障层次",
        title: "把安全写进每个流程节点",
        description: "安全不是一个口号，而是权限、记录和异常处理的组合。",
        items: [
          { title: "资料归属", description: "宠物资料按账户和宠物关系维护，避免跨账户访问。" },
          { title: "媒体保护", description: "照片和服务文件使用受控地址和访问边界。" },
          { title: "资格审核", description: "服务者资格与可承接范围有明确审核状态。" },
          { title: "过程记录", description: "订单步骤、图片、备注和消息保持关联。" },
          { title: "内容治理", description: "社区内容支持审核、举报、下架和互动边界。" },
        ],
      },
      {
        kind: "split",
        id: "trust-records",
        eyebrow: "可追溯",
        title: "重要操作都有上下文",
        description:
          "删除、修改、审核和订单状态变化都与对应的账户、宠物或订单关联，便于核对问题发生在哪里。",
        image: petRecordImage,
        action: { label: "阅读隐私政策", href: "/privacy" },
        tone: "soft",
      },
    ],
  },
  "service-flow": {
    title: "服务流程 | PetCare 宠伴",
    description: "从发布需求到完成服务，了解 PetCare 的订单和 SOP 流程。",
    eyebrow: "服务流程",
    heroTitle: "先把流程说清楚，再开始一次服务",
    heroDescription: "主人和服务者在同一条订单记录中确认范围、执行步骤、上传证据并完成交付。",
    heroImage: storiesImage,
    heroActions: [
      { label: "查看悬赏服务", href: "/rewards" },
      { label: "了解服务者", href: "/for-providers", secondary: true },
    ],
    sections: [
      {
        kind: "timeline",
        id: "service-flow-timeline",
        eyebrow: "七个阶段",
        title: "每一步都对应一个明确状态",
        description: "让双方知道下一步做什么，也知道什么时候可以确认完成。",
        items: [
          { title: "需求发布", description: "主人写清楚宠物情况、服务时间和交付结果。" },
          { title: "服务响应", description: "服务者查看需求，确认服务范围和可用时间。" },
          { title: "订单确认", description: "双方确认服务内容、费用、时间和注意事项。" },
          { title: "支付处理", description: "订单进入支付流程并记录支付结果。" },
          { title: "SOP 执行", description: "服务者按步骤完成服务并提交过程记录。" },
          { title: "结果确认", description: "主人查看记录，确认服务结果或提交异常。" },
          { title: "账务记录", description: "订单收入进入只读账务和后续结算状态。" },
        ],
        tone: "soft",
      },
      {
        kind: "note",
        id: "service-flow-boundary",
        eyebrow: "服务边界",
        title: "平台记录流程，双方确认结果",
        description:
          "平台提供订单、SOP、消息和记录工具；实际服务内容、责任边界和异常处理以订单约定与平台规则为准。",
        tone: "dark",
      },
    ],
  },
  stories: {
    title: "社区故事 | PetCare 宠伴",
    description: "看看宠物日常、养宠经验和陪伴故事如何被记录下来。",
    eyebrow: "社区故事",
    heroTitle: "普通的一天，也值得被认真记录",
    heroDescription: "从一张照片、一段文字和一次互动开始，留下属于宠物和家人的生活片段。",
    heroImage: storiesImage,
    heroActions: [
      { label: "阅读宠物课堂", href: "/articles" },
      { label: "了解平台规则", href: "/platform-rules", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "story-types",
        eyebrow: "内容方向",
        title: "记录生活，也分享有用的经验",
        description: "社区内容以真实、尊重和可回看为基础。",
        items: [
          {
            title: "宠物日常",
            description: "记录吃饭、散步、休息和成长中的小事。",
            image: petRecordImage,
          },
          {
            title: "养宠经验",
            description: "分享照顾宠物时真正有帮助的方法和观察。",
            image: careImage,
          },
          {
            title: "陪伴故事",
            description: "留下人与宠物之间值得记住的相处片段。",
            image: storiesImage,
          },
        ],
      },
      {
        kind: "split",
        id: "story-governance",
        eyebrow: "社区边界",
        title: "真实内容，也需要明确的社区规则",
        description:
          "公开内容会经过审核，用户可以举报不合适的内容；图片、文字和互动都遵守平台规则与隐私边界。",
        image: careImage,
        action: { label: "阅读平台规则", href: "/platform-rules" },
        tone: "soft",
      },
    ],
  },
  miniapp: {
    title: "微信小程序 | PetCare 宠伴",
    description: "从微信小程序开始使用 PetCare 的宠物档案、内容和服务能力。",
    eyebrow: "微信小程序",
    heroTitle: "从一次记录开始，进入 PetCare",
    heroDescription: "在小程序中管理宠物资料、阅读宠物课堂、参与社区并使用服务流程。",
    heroImage,
    heroActions: [
      { label: "查看使用路径", href: "/service-flow" },
      { label: "查看帮助中心", href: "/help", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "miniapp-entry",
        eyebrow: "小程序入口",
        title: "适合从这些事情开始",
        description: "先完成一项记录，再逐步使用更多能力。",
        items: [
          { title: "建立宠物档案", description: "记录宠物的基本资料、习惯和照片。" },
          { title: "阅读宠物课堂", description: "按分类找到养宠知识和服务指南。" },
          { title: "浏览社区内容", description: "查看审核通过的宠物日常和经验分享。" },
          { title: "体验服务流程", description: "查看悬赏、订单、SOP 和账务状态。" },
        ],
      },
      {
        kind: "note",
        id: "miniapp-availability",
        eyebrow: "入口配置",
        title: "小程序二维码和正式入口以发布配置为准",
        description:
          "官网已经准备好小程序入口页面；正式二维码、主体信息和商业功能开关配置完成后，可以直接替换入口内容。",
        tone: "dark",
      },
    ],
  },
  about: {
    title: "关于 PetCare | PetCare 宠伴",
    description: "了解 PetCare 的产品理念、服务边界和建设方向。",
    eyebrow: "关于 PetCare",
    heroTitle: "让宠物生活被看见，也让每一次服务有依据",
    heroDescription: "PetCare 从宠物档案和日常内容开始，逐步连接社区、服务流程和可追溯的记录。",
    heroImage,
    heroActions: [
      { label: "了解产品能力", href: "/product" },
      { label: "联系我们", href: "/contact", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "about-principles",
        eyebrow: "产品原则",
        title: "先把基础记录做好，再连接更复杂的服务",
        description: "PetCare 关注真实使用路径和可验证的状态。",
        items: [
          { title: "记录清楚", description: "让宠物资料、图片和服务过程都有明确归属。" },
          { title: "流程透明", description: "让每个角色知道当前状态和下一步操作。" },
          { title: "边界诚实", description: "已开放、体验开放和待配置能力分别说明。" },
        ],
      },
      {
        kind: "split",
        id: "about-story",
        eyebrow: "我们正在建设什么",
        title: "一个围绕宠物日常逐步成长的产品",
        description:
          "从个人宠物资料到服务协作，PetCare 以真实页面、明确状态和可回看的记录为基础持续完善。",
        image: storiesImage,
        action: { label: "查看当前能力", href: "/product" },
        tone: "soft",
      },
    ],
  },
  contact: {
    title: "联系我们 | PetCare 宠伴",
    description: "向 PetCare 提交产品反馈、服务问题和合作咨询。",
    eyebrow: "联系我们",
    heroTitle: "把问题和建议，交给我们继续改进",
    heroDescription: "你可以通过小程序帮助入口反馈使用问题，也可以了解产品和服务边界。",
    heroImage: storiesImage,
    heroActions: [
      { label: "打开帮助中心", href: "/help" },
      { label: "打开微信小程序", href: "/miniapp", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "contact-topics",
        eyebrow: "反馈类型",
        title: "告诉我们你遇到了什么",
        description: "清楚的问题描述和相关订单信息，有助于更快定位问题。",
        items: [
          { title: "产品反馈", description: "页面、功能、操作路径和使用体验建议。" },
          { title: "订单问题", description: "悬赏、服务、SOP、评价和异常处理问题。" },
          { title: "内容与隐私", description: "文章、社区内容、图片和隐私相关反馈。" },
          { title: "合作咨询", description: "服务合作、平台合作和产品方向咨询。" },
        ],
      },
      {
        kind: "note",
        id: "contact-entry",
        eyebrow: "当前联系入口",
        title: "优先通过小程序帮助中心提交问题",
        description:
          "正式客服渠道和合作邮箱将在平台配置完成后补充。提交问题时请尽量说明页面、订单编号和发生时间。",
        tone: "dark",
      },
    ],
  },
  articles: {
    title: "宠物课堂 | PetCare 宠伴",
    description: "阅读 PetCare 的养宠知识、服务指南和平台规则。",
    eyebrow: "宠物课堂",
    heroTitle: "把有用的养宠知识，放在需要的时候",
    heroDescription: "从日常照顾、行为观察到服务流程，按主题找到更清楚的说明。",
    heroImage: careImage,
    heroActions: [
      { label: "查看帮助中心", href: "/help" },
      { label: "了解产品能力", href: "/product", secondary: true },
    ],
    sections: [
      {
        kind: "cards",
        id: "classroom-topics",
        eyebrow: "内容方向",
        title: "四类内容，覆盖从日常到服务的使用场景",
        description: "正式文章上线后会按主题持续补充，页面结构保持不变。",
        items: [
          { title: "日常照顾", description: "饮食、清洁、休息和日常状态观察。" },
          { title: "行为与健康", description: "用更容易理解的方式认识宠物行为和健康信号。" },
          { title: "服务指南", description: "了解悬赏、订单、SOP 和服务记录的使用方法。" },
          { title: "平台规则", description: "阅读社区、服务、支付和隐私相关的公开说明。" },
        ],
        tone: "soft",
      },
      {
        kind: "note",
        id: "classroom-publishing",
        eyebrow: "内容状态",
        title: "文章内容会独立更新，不影响官网主结构",
        description: "官网导航和页面布局由代码维护，文章正文可以按发布流程逐步补充。",
        tone: "dark",
      },
    ],
  },
};
