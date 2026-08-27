import {
  ADMIN_CONTENT_POST_STATUS,
  CLASSROOM_ARTICLE_CATEGORY,
  NOTIFICATION_TYPE,
  PET_GENDER,
  PET_SPECIES,
} from "@petcare/shared-types";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { encodeArticleBody } from "../modules/content/classroom-article-content";

export const LOCAL_DEMO_IDS = {
  users: ["00000000-0000-4000-8000-000000000101", "00000000-0000-4000-8000-000000000102"],
  pets: ["00000000-0000-4000-8000-000000000201", "00000000-0000-4000-8000-000000000202"],
  posts: [
    "00000000-0000-4000-8000-000000000301",
    "00000000-0000-4000-8000-000000000302",
    "00000000-0000-4000-8000-000000000303",
  ],
  comments: ["00000000-0000-4000-8000-000000000401"],
  likes: ["00000000-0000-4000-8000-000000000402"],
  articles: [
    "00000000-0000-4000-8000-000000000501",
    "00000000-0000-4000-8000-000000000502",
    "00000000-0000-4000-8000-000000000503",
  ],
  notifications: ["00000000-0000-4000-8000-000000000601", "00000000-0000-4000-8000-000000000602"],
} as const;

export interface LocalDemoSeedSummary {
  users: number;
  pets: number;
  posts: number;
  comments: number;
  likes: number;
  articles: number;
  notifications: number;
}

const OWNER_ID = LOCAL_DEMO_IDS.users[0];
const READER_ID = LOCAL_DEMO_IDS.users[1];
const FEATURED_POST_ID = LOCAL_DEMO_IDS.posts[0];

/** Seeds a small, identifiable local dataset without touching operator-owned rows. */
export async function seedLocalDemoData(prisma: PrismaClient): Promise<LocalDemoSeedSummary> {
  const articleBodies = await Promise.all([
    encodeArticleBody(
      "<h2>先观察，再调整</h2><p>换粮建议分阶段完成，并持续观察食欲、饮水和排便变化。</p>",
      async () => new Map(),
    ),
    encodeArticleBody(
      "<h2>把护理变成日常</h2><p>定期梳毛、检查耳朵和牙齿，比临时突击更容易发现细小变化。</p>",
      async () => new Map(),
    ),
    encodeArticleBody(
      "<h2>短时、稳定、可重复</h2><p>训练从简单口令开始，及时奖励正确行为，避免一次练习过久。</p>",
      async () => new Map(),
    ),
  ]);

  await prisma.$transaction(async (transaction) => {
    await transaction.user.upsert({
      where: { id: OWNER_ID },
      update: {
        phone: "18800000101",
        username: "local_demo_owner",
        nickname: "本地示例铲屎官",
        userType: "pet_owner",
        status: "active",
      },
      create: {
        id: OWNER_ID,
        phone: "18800000101",
        username: "local_demo_owner",
        nickname: "本地示例铲屎官",
        userType: "pet_owner",
        status: "active",
      },
    });
    await transaction.user.upsert({
      where: { id: READER_ID },
      update: {
        phone: "18800000102",
        username: "local_demo_reader",
        nickname: "本地示例宠友",
        userType: "pet_owner",
        status: "active",
      },
      create: {
        id: READER_ID,
        phone: "18800000102",
        username: "local_demo_reader",
        nickname: "本地示例宠友",
        userType: "pet_owner",
        status: "active",
      },
    });
    await transaction.userProfile.upsert({
      where: { userId: OWNER_ID },
      update: { address: "本地开发环境", bio: "用于验证宠物档案与社区页面的可清理样例账号。" },
      create: {
        userId: OWNER_ID,
        address: "本地开发环境",
        bio: "用于验证宠物档案与社区页面的可清理样例账号。",
      },
    });
    await transaction.userProfile.upsert({
      where: { userId: READER_ID },
      update: { address: "本地开发环境", bio: "用于验证互动状态的可清理样例账号。" },
      create: {
        userId: READER_ID,
        address: "本地开发环境",
        bio: "用于验证互动状态的可清理样例账号。",
      },
    });

    const pets = [
      {
        id: LOCAL_DEMO_IDS.pets[0],
        ownerId: OWNER_ID,
        name: "团子",
        species: PET_SPECIES.CAT,
        breed: "中华田园猫",
        gender: PET_GENDER.FEMALE,
        birthDate: new Date("2023-05-12T00:00:00.000Z"),
        weight: 4.3,
        sterilized: true,
        habits: "喜欢晒太阳，陌生环境会先躲一会儿。",
        allergies: null,
        tabooFoods: "葡萄、巧克力",
        photos: [],
      },
      {
        id: LOCAL_DEMO_IDS.pets[1],
        ownerId: OWNER_ID,
        name: "可乐",
        species: PET_SPECIES.DOG,
        breed: "柯基",
        gender: PET_GENDER.MALE,
        birthDate: new Date("2022-10-03T00:00:00.000Z"),
        weight: 11.8,
        sterilized: true,
        habits: "每天早晚散步，见到熟人会摇尾巴。",
        allergies: "鸡肉不耐受",
        tabooFoods: null,
        photos: [],
      },
    ] satisfies Prisma.PetUncheckedCreateInput[];

    await Promise.all(
      pets.map((pet) =>
        transaction.pet.upsert({ where: { id: pet.id! }, update: pet, create: pet }),
      ),
    );

    const posts = [
      {
        id: FEATURED_POST_ID,
        authorId: OWNER_ID,
        content: "[本地示例] 傍晚带可乐沿河散步，回家后团子已经在门口等我们了。",
        mediaUrls: [],
        tags: ["本地示例"],
        likesCount: 1,
        commentsCount: 1,
        sharesCount: 0,
        status: ADMIN_CONTENT_POST_STATUS.PUBLISHED,
        moderationReason: null,
        createdAt: new Date("2026-08-27T10:30:00.000Z"),
      },
      {
        id: LOCAL_DEMO_IDS.posts[1],
        authorId: READER_ID,
        content: "[本地示例] 今天给猫抓板换了位置，终于找到了它最喜欢的窗边角落。",
        mediaUrls: [],
        tags: ["本地示例"],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        status: ADMIN_CONTENT_POST_STATUS.PUBLISHED,
        moderationReason: null,
        createdAt: new Date("2026-08-27T08:20:00.000Z"),
      },
      {
        id: LOCAL_DEMO_IDS.posts[2],
        authorId: OWNER_ID,
        content: "[本地示例] 记录一次顺利的换粮：七天逐步调整，食欲和排便都保持稳定。",
        mediaUrls: [],
        tags: ["本地示例"],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        status: ADMIN_CONTENT_POST_STATUS.PUBLISHED,
        moderationReason: null,
        createdAt: new Date("2026-08-26T12:10:00.000Z"),
      },
    ] satisfies Prisma.PostUncheckedCreateInput[];

    await Promise.all(
      posts.map((post) =>
        transaction.post.upsert({ where: { id: post.id! }, update: post, create: post }),
      ),
    );

    const comment = {
      id: LOCAL_DEMO_IDS.comments[0],
      postId: FEATURED_POST_ID,
      commenterId: READER_ID,
      content: "[本地示例] 这种平静的小日常最治愈。",
      status: "published",
      moderationReason: null,
      createdAt: new Date("2026-08-27T10:40:00.000Z"),
    } satisfies Prisma.CommentUncheckedCreateInput;

    await transaction.comment.upsert({
      where: { id: comment.id },
      update: comment,
      create: comment,
    });

    const like = {
      id: LOCAL_DEMO_IDS.likes[0],
      postId: FEATURED_POST_ID,
      userId: READER_ID,
      createdAt: new Date("2026-08-27T10:41:00.000Z"),
    } satisfies Prisma.CommunityPostLikeUncheckedCreateInput;

    await transaction.communityPostLike.upsert({
      where: { id: like.id },
      update: like,
      create: like,
    });

    const articles = [
      {
        id: LOCAL_DEMO_IDS.articles[0],
        category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
        title: "[本地示例] 七天换粮观察清单",
        summary: "用简单记录判断宠物是否适应新粮。",
        coverUrl: null,
        content: articleBodies[0].storedContent,
        status: "published",
        authorId: OWNER_ID,
        publishedAt: new Date("2026-08-27T07:00:00.000Z"),
      },
      {
        id: LOCAL_DEMO_IDS.articles[1],
        category: CLASSROOM_ARTICLE_CATEGORY.HEALTH_MANAGEMENT,
        title: "[本地示例] 每周家庭护理检查",
        summary: "从毛发、耳朵、牙齿到精神状态的轻量检查。",
        coverUrl: null,
        content: articleBodies[1].storedContent,
        status: "published",
        authorId: OWNER_ID,
        publishedAt: new Date("2026-08-26T07:00:00.000Z"),
      },
      {
        id: LOCAL_DEMO_IDS.articles[2],
        category: CLASSROOM_ARTICLE_CATEGORY.BEHAVIOR_TRAINING,
        title: "[本地示例] 新手口令训练节奏",
        summary: "把训练拆成短时、稳定、可重复的小步骤。",
        coverUrl: null,
        content: articleBodies[2].storedContent,
        status: "published",
        authorId: READER_ID,
        publishedAt: new Date("2026-08-25T07:00:00.000Z"),
      },
    ] satisfies Prisma.ClassroomArticleUncheckedCreateInput[];

    await Promise.all(
      articles.map((article) =>
        transaction.classroomArticle.upsert({
          where: { id: article.id! },
          update: article,
          create: article,
        }),
      ),
    );

    const notifications = [
      {
        id: LOCAL_DEMO_IDS.notifications[0],
        userId: OWNER_ID,
        type: NOTIFICATION_TYPE.COMMUNITY_LIKE,
        title: "本地示例互动",
        content: "本地示例宠友赞了你的动态",
        referenceId: FEATURED_POST_ID,
        deduplicationKey: "local-demo:community-like:featured",
        isRead: false,
        createdAt: new Date("2026-08-27T10:41:00.000Z"),
      },
      {
        id: LOCAL_DEMO_IDS.notifications[1],
        userId: OWNER_ID,
        type: NOTIFICATION_TYPE.COMMUNITY_COMMENT,
        title: "本地示例评论",
        content: "本地示例宠友评论了你的动态",
        referenceId: FEATURED_POST_ID,
        deduplicationKey: "local-demo:community-comment:featured",
        isRead: false,
        createdAt: new Date("2026-08-27T10:40:00.000Z"),
      },
    ] satisfies Prisma.NotificationUncheckedCreateInput[];

    await Promise.all(
      notifications.map((notification) =>
        transaction.notification.upsert({
          where: { id: notification.id! },
          update: notification,
          create: notification,
        }),
      ),
    );
  });

  return localDemoSeedSummary();
}

/** Removes only rows reserved by the local demo seed. */
export async function cleanupLocalDemoData(prisma: PrismaClient): Promise<LocalDemoSeedSummary> {
  return prisma.$transaction(async (transaction) => {
    const notifications = await transaction.notification.deleteMany({
      where: { id: { in: [...LOCAL_DEMO_IDS.notifications] } },
    });
    const likes = await transaction.communityPostLike.deleteMany({
      where: { id: { in: [...LOCAL_DEMO_IDS.likes] } },
    });
    const comments = await transaction.comment.deleteMany({
      where: { id: { in: [...LOCAL_DEMO_IDS.comments] } },
    });
    const posts = await transaction.post.deleteMany({
      where: { id: { in: [...LOCAL_DEMO_IDS.posts] } },
    });
    const pets = await transaction.pet.deleteMany({
      where: { id: { in: [...LOCAL_DEMO_IDS.pets] } },
    });
    const articles = await transaction.classroomArticle.deleteMany({
      where: { id: { in: [...LOCAL_DEMO_IDS.articles] } },
    });

    await transaction.userProfile.deleteMany({
      where: { userId: { in: [...LOCAL_DEMO_IDS.users] } },
    });
    const users = await transaction.user.deleteMany({
      where: { id: { in: [...LOCAL_DEMO_IDS.users] } },
    });

    return {
      users: users.count,
      pets: pets.count,
      posts: posts.count,
      comments: comments.count,
      likes: likes.count,
      articles: articles.count,
      notifications: notifications.count,
    };
  });
}

function localDemoSeedSummary(): LocalDemoSeedSummary {
  return {
    users: LOCAL_DEMO_IDS.users.length,
    pets: LOCAL_DEMO_IDS.pets.length,
    posts: LOCAL_DEMO_IDS.posts.length,
    comments: LOCAL_DEMO_IDS.comments.length,
    likes: LOCAL_DEMO_IDS.likes.length,
    articles: LOCAL_DEMO_IDS.articles.length,
    notifications: LOCAL_DEMO_IDS.notifications.length,
  };
}
