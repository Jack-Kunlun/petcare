import heroCommunity from "../../assets/brand/hero-community-companion-miniapp-v1.png";
import heroProfessional from "../../assets/brand/hero-professional-care-miniapp-v1.png";
import heroTrusted from "../../assets/brand/hero-trusted-care-miniapp-v1.png";

export interface HomeBanner {
  /** 稳定的轮播项标识。 */
  id: string;
  /** Miniapp 打包后的本地品牌图片。 */
  image: string;
  /** 轮播主标题。 */
  title: string;
  /** 轮播辅助说明。 */
  subtitle: string;
  /** 单一主行动文案。 */
  actionLabel: string;
  /** 主行动对应的一级 Tab 路径。 */
  actionPath: string;
}

export interface HomeService {
  /** 进行中服务的稳定标识。 */
  id: string;
  /** 宠物头像的本地图片地址。 */
  petAvatar: string;
  /** 宠物展示名称。 */
  petName: string;
  /** 宠物品种说明。 */
  petBreed: string;
  /** 当前服务类型与执行轮次。 */
  serviceType: string;
  /** 当前宠托师展示名称。 */
  caregiverName: string;
  /** 取值 0 到 100 的服务完成百分比。 */
  progress: number;
  /** 预计完成时间。 */
  estimatedTime: string;
}

export interface HomeBounty {
  /** 悬赏稳定标识。 */
  id: string;
  /** 宠物类型。 */
  petType: string;
  /** 宠物缩略图的本地图片地址。 */
  image: string;
  /** 服务类型。 */
  serviceType: string;
  /** 服务需求摘要。 */
  description: string;
  /** 格式化后的悬赏价格。 */
  price: string;
  /** 格式化后的距离。 */
  distance: string;
  /** 服务持续时间。 */
  duration: string;
  /** 是否展示紧急标记。 */
  urgent: boolean;
}

export interface HomeArticle {
  /** 文章稳定标识。 */
  id: string;
  /** 文章缩略图的本地图片地址。 */
  image: string;
  /** 文章标题。 */
  title: string;
  /** 浏览次数。 */
  views: number;
  /** ISO 日期格式的发布日期。 */
  publishDate: string;
  /** 文章分类。 */
  category: string;
}

export interface HomePost {
  /** 帖子稳定标识。 */
  id: string;
  /** 作者头像的本地图片地址。 */
  authorAvatar: string;
  /** 作者展示名称。 */
  authorName: string;
  /** 相对发布时间。 */
  publishedAt: string;
  /** 作者发布位置。 */
  location: string;
  /** 帖子正文。 */
  content: string;
  /** 帖子媒体的本地图片地址；没有媒体时为空。 */
  image: string | null;
  /** 点赞数量。 */
  likes: number;
  /** 评论数量。 */
  comments: number;
}

export const HOME_BANNERS: readonly HomeBanner[] = [
  {
    id: "professional-care",
    image: heroProfessional,
    title: "毛孩子 · 专业上门宠物服务",
    subtitle: "每一次照护，都有清晰记录",
    actionLabel: "立即预约服务",
    actionPath: "/pages/bounty/index",
  },
  {
    id: "trusted-care",
    image: heroTrusted,
    title: "每一次托付，都值得信赖",
    subtitle: "认证宠托师，服务进度安心可见",
    actionLabel: "查看附近服务",
    actionPath: "/pages/bounty/index",
  },
  {
    id: "community-companion",
    image: heroCommunity,
    title: "和同城宠友一起成长",
    subtitle: "分享真实经验，遇见可靠伙伴",
    actionLabel: "探索宠物社区",
    actionPath: "/pages/community/index",
  },
];

export const HOME_ONGOING_SERVICE: HomeService = {
  id: "service-1",
  petAvatar: heroCommunity,
  petName: "咪咪",
  petBreed: "英短蓝猫",
  serviceType: "上门喂养 · 第 2 次服务",
  caregiverName: "林小雨",
  progress: 65,
  estimatedTime: "12:30",
};

export const HOME_BOUNTIES: readonly HomeBounty[] = [
  {
    id: "bounty-1",
    petType: "猫咪",
    image: heroCommunity,
    serviceType: "上门喂养",
    description: "需要每天上门喂两只猫并清理猫砂",
    price: "¥50/天",
    distance: "1.5km",
    duration: "3天",
    urgent: true,
  },
  {
    id: "bounty-2",
    petType: "狗狗",
    image: heroProfessional,
    serviceType: "遛狗服务",
    description: "每天早晚各遛一次，每次 30 分钟",
    price: "¥35/次",
    distance: "2.0km",
    duration: "7天",
    urgent: false,
  },
  {
    id: "bounty-3",
    petType: "猫咪",
    image: heroTrusted,
    serviceType: "宠物寄养",
    description: "出差一周，需要寄养一只英短蓝猫",
    price: "¥80/天",
    distance: "3.2km",
    duration: "7天",
    urgent: false,
  },
];

export const HOME_ARTICLES: readonly HomeArticle[] = [
  {
    id: "article-1",
    image: heroCommunity,
    title: "猫咪日常护理指南：从梳毛到剪指甲",
    views: 2340,
    publishDate: "2026-07-15",
    category: "健康",
  },
  {
    id: "article-2",
    image: heroProfessional,
    title: "新手养狗必看：幼犬喂养注意事项",
    views: 1856,
    publishDate: "2026-07-14",
    category: "喂养",
  },
  {
    id: "article-3",
    image: heroTrusted,
    title: "如何训练狗狗定点上厕所？",
    views: 3120,
    publishDate: "2026-07-13",
    category: "行为",
  },
  {
    id: "article-4",
    image: heroCommunity,
    title: "宠物夏季防暑降温小贴士",
    views: 1567,
    publishDate: "2026-07-12",
    category: "健康",
  },
];

export const HOME_POSTS: readonly HomePost[] = [
  {
    id: "post-1",
    authorAvatar: heroCommunity,
    authorName: "小萌",
    publishedAt: "2小时前",
    location: "静安区",
    content: "今天带我家布偶体验了第一次上门喂养，照护记录很清楚，也收到了不少照片和视频。",
    image: heroCommunity,
    likes: 42,
    comments: 8,
  },
  {
    id: "post-2",
    authorAvatar: heroProfessional,
    authorName: "大壮",
    publishedAt: "5小时前",
    location: "浦东新区",
    content: "周末带狗狗去宠物公园玩，遇到了许多新伙伴，也积累了新的社交经验。",
    image: heroProfessional,
    likes: 67,
    comments: 15,
  },
  {
    id: "post-3",
    authorAvatar: heroTrusted,
    authorName: "小美",
    publishedAt: "昨天",
    location: "徐汇区",
    content: "分享一个实用的猫咪梳毛技巧：顺着毛发生长方向轻轻梳理，过程会更舒适。",
    image: null,
    likes: 89,
    comments: 23,
  },
];
