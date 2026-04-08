import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ThreatPredictorService } from '../src/threat-predictor/threat-predictor.service';

async function testRagPipeline() {
  const articleId = '696df23438b7e665defced06'; // Реальный ID, найденный ранее

  console.log('🚀 Starting RAG Pipeline Test...');
  console.log(`📄 Target Article ID: ${articleId}`);

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const service = app.get(ThreatPredictorService);

    console.log('✅ App Context initialized. Service retrieved.');

    const result = await service.predict(articleId);

    console.log('\n🏁 Pipeline Finished. Result:');
    console.log(JSON.stringify(result, null, 2));

    await app.close();
  } catch (error) {
    console.error('\n❌ Error during pipeline execution:');
    console.error(error);
    process.exit(1);
  }
}

void testRagPipeline();
