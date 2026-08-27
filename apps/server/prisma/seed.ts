import { Logger } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "../src/config/config.service";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedInitialData } from "../src/seed/seed-initial-data";
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
    phone: configService.defaultAdminPhone,
    password: configService.defaultAdminPassword,
    nickname: "系统管理员",
  });

  const administrator = await prisma.user.findUniqueOrThrow({
    where: { phone: configService.defaultAdminPhone },
    select: { id: true },
  });

  await seedWebsiteContent(prisma, administrator.id);
}

main()
  .then(() => {
    logger.log("默认管理员、权限目录和官网内容初始化完成");
  })
  .catch((error: unknown) => {
    logger.error("默认数据初始化失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
