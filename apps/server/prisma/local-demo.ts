import { Logger } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { ConfigService } from "../src/config/config.service";
import { PrismaClient } from "../src/generated/prisma/client";
import { cleanupLocalDemoData, seedLocalDemoData } from "../src/seed/seed-local-demo";

const configService = new ConfigService();
const logger = new Logger("LocalDemoData");
const action = process.argv[2];
const prisma = new PrismaClient({
  adapter: new PrismaPg(
    { connectionString: configService.databaseUrl },
    { schema: configService.databaseSchema },
  ),
});

async function main(): Promise<void> {
  if (configService.nodeEnv !== "development") {
    throw new Error("本地样例数据只允许在 NODE_ENV=development 时操作");
  }

  if (action === "seed") {
    const summary = await seedLocalDemoData(prisma);

    logger.log(`本地样例数据已写入：${JSON.stringify(summary)}`);

    return;
  }

  if (action === "cleanup") {
    const summary = await cleanupLocalDemoData(prisma);

    logger.log(`本地样例数据已清理：${JSON.stringify(summary)}`);

    return;
  }

  throw new Error("必须指定 seed 或 cleanup");
}

main()
  .catch((error: unknown) => {
    logger.error("本地样例数据操作失败", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
