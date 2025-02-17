// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 허용 (Next.js가 localhost:3000 또는 3005에서 동작한다고 가정)
  app.enableCors({
    origin: true, // or ['http://localhost:3000', 'http://localhost:3005']
  });

  await app.listen(4000);
  console.log(`Nest application successfully started on port 4000`);
}
bootstrap();