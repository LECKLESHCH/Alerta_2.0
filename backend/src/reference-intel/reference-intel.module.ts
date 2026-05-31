import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferenceCve, ReferenceCveSchema } from './reference-cve.schema';
import { ReferenceIntelService } from './reference-intel.service';
import { ReferenceIntelController } from './reference-intel.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ReferenceCve.name, schema: ReferenceCveSchema },
    ]),
  ],
  controllers: [ReferenceIntelController],
  providers: [ReferenceIntelService],
  exports: [MongooseModule, ReferenceIntelService],
})
export class ReferenceIntelModule {}
