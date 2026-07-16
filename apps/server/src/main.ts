import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS配置（从环境变量读取）
  const allowedOrigins = configService.allowedOrigins.split(",").map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Swagger文档（仅开发环境启用）
  if (configService.nodeEnv !== "production") {
    const config = new DocumentBuilder()
      .setTitle("PetCare API")
      .setDescription("PetCare宠伴平台API文档")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup("api-docs", app, document);
  }

  const port = configService.port;

  await app.listen(port);
}

bootstrap();
