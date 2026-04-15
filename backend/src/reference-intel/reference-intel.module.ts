import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferenceCve, ReferenceCveSchema } from './reference-cve.schema';
import { ReferenceIntelService } from './reference-intel.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReferenceCve.name, schema: ReferenceCveSchema },
    ]),
  ],
  providers: [ReferenceIntelService],
  exports: [MongooseModule, ReferenceIntelService],
})
export class ReferenceIntelModule {}
