import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Personal Finance API')
    .setDescription(
      'API para controle de fluxo de caixa e análise de investimentos via Telegram',
    )
    .setVersion('1.0')
    .addTag('expenses', 'Gestão de despesas')
    .addTag('investments', 'Gestão de investimentos e ativos')
    .addTag('market', 'Integração com dados de mercado')
    .addTag('telegram', 'Interface com bot do Telegram')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
