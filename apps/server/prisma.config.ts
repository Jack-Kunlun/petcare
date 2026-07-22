import { defineConfig } from "prisma/config";
import { ConfigService } from "./src/config/config.service";

const configService = new ConfigService();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: configService.databaseUrl,
  },
});
