import { Logger } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "../src/config/config.service";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedInitialData } from "../src/seed/seed-initial-data";
import { seedSystemSettings } from "../src/seed/seed-system-settings";

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

  await seedSystemSettings(prisma, administrator.id);
}

main()
  .then(() => {
    logger.log("默认管理员、超级管理员角色和系统设置初始化完成");
  })
  .catch((error: unknown) => {
    logger.error("默认数据初始化失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
