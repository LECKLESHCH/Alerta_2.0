import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ModelObjectController } from './model-object.controller';
import { ModelObjectEntity, ModelObjectSchema } from './model-object.schema';
import { ModelObjectService } from './model-object.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ModelObjectEntity.name, schema: ModelObjectSchema },
    ]),
  ],
  controllers: [ModelObjectController],
  providers: [ModelObjectService],
  exports: [ModelObjectService],
})
export class ModelObjectModule {}
