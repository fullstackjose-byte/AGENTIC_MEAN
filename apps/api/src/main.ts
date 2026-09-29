import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureOpenApi } from './openapi.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:4200'],
    exposedHeaders: ['X-Correlation-Id'],
  });
  configureOpenApi(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
