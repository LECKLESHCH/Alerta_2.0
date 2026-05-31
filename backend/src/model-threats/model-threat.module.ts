import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ModelObjectEntity, ModelObjectSchema } from '../model-objects/model-object.schema';
import {
  ModelThreatForumSchema,
  ModelThreatTgSchema,
  ModelThreatWebSchema,
} from './model-threat.schema';
import { ModelThreatController } from './model-threat.controller';
import { ModelThreatService } from './model-threat.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'ModelThreatWeb', schema: ModelThreatWebSchema },
      { name: 'ModelThreatTg', schema: ModelThreatTgSchema },
      { name: 'ModelThreatForum', schema: ModelThreatForumSchema },
      { name: ModelObjectEntity.name, schema: ModelObjectSchema },
    ]),
  ],
  controllers: [ModelThreatController],
  providers: [ModelThreatService],
  exports: [ModelThreatService],
})
export class ModelThreatModule {}
