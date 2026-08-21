import { Module, Global } from "@nestjs/common";
import { ConfigService } from "./config.service";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [ConfigService, RedisService],
  exports: [ConfigService, RedisService],
})
export class ConfigModule {}
