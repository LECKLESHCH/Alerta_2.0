import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ObjectController } from './object.controller';
import { ObjectEntity, ObjectSchema } from './object.schema';
import { ObjectService } from './object.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ObjectEntity.name, schema: ObjectSchema },
    ]),
  ],
  controllers: [ObjectController],
  providers: [ObjectService],
  exports: [ObjectService],
})
export class ObjectModule {}
