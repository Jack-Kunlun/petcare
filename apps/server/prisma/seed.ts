import { Logger } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "../src/config/config.service";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedInitialData } from "../src/seed/seed-initial-data";
import { seedSopConfiguration } from "../src/seed/seed-sop-config";
import { seedWebsiteContent } from "../src/seed/seed-website-content";

const configService = new ConfigService();
const logger = new Logger("PrismaSeed");
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: configService.databaseUrl },
    { schema: configService.databaseSchema },
  ),
});

async function main(): Promise<void> {
  await seedInitialData(prisma, {
    username: configService.defaultAdminUsername,
    password: configService.defaultAdminPassword,
    nickname: "系统管理员",
  });

  const administrator = await prisma.user.findUniqueOrThrow({
    where: { username: configService.defaultAdminUsername },
    select: { id: true },
  });

  await seedWebsiteContent(prisma, administrator.id);
  await seedSopConfiguration(prisma, administrator.id);
}

main()
  .then(() => {
    logger.log("默认管理员、权限目录、官网内容和基础 SOP 初始化完成");
  })
  .catch((error: unknown) => {
    logger.error("默认数据初始化失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
