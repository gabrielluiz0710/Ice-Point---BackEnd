import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // [B1] ValidationPipe global — ativa todos os decorators dos DTOs (@IsString, @IsEnum, @Min, etc.)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Remove campos não declarados no DTO automaticamente
      forbidNonWhitelisted: true, // Rejeita requisições com campos extras não declarados
      transform: true,           // Converte tipos automaticamente (string → number, etc.)
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:5173', //  Local
      'https://ice-point-front-end.vercel.app', // Produção
      'https://www.icepoint.com.br',
      'https://icepoint.com.br',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3000;

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
