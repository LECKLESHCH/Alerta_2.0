import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'objects' })
export class ObjectEntity {
  @Prop({ required: true, trim: true })
  objectName: string;

  @Prop({ required: true, trim: true })
  objectType: string;

  @Prop({ required: true, trim: true })
  criticalityClass: string;

  @Prop({ required: true, trim: true })
  industry: string;

  @Prop({ default: '', trim: true })
  subIndustry: string;

  @Prop({ default: '', trim: true })
  region: string;

  @Prop({ default: '', trim: true })
  ownerUnit: string;

  @Prop({ required: true, min: 0, max: 1 })
  businessCriticality: number;

  @Prop({ required: true, min: 0, max: 1 })
  impactConfidentiality: number;

  @Prop({ required: true, min: 0, max: 1 })
  impactIntegrity: number;

  @Prop({ required: true, min: 0, max: 1 })
  impactAvailability: number;

  @Prop({ default: '', trim: true })
  downtimeTolerance: string;

  @Prop({ required: true, min: 0, max: 1 })
  attackSurface: number;

  @Prop({ required: true, min: 0, max: 1 })
  remoteAccessLevel: number;

  @Prop({ default: '', trim: true })
  integrationLevel: string;

  @Prop({ default: false })
  internetExposed: boolean;

  @Prop({ default: false })
  contractorAccess: boolean;

  @Prop({ default: false })
  userInteractionDependency: boolean;

  @Prop({ default: false })
  isIcs: boolean;

  @Prop({ required: true, min: 0, max: 1 })
  segmentationLevel: number;

  @Prop({ required: true, min: 0, max: 1 })
  legacyShare: number;

  @Prop({ required: true, min: 0, max: 1 })
  cloudPresence: number;

  @Prop({ required: true, trim: true })
  securityMaturity: string;

  @Prop({ required: true, trim: true })
  monitoringMaturity: string;

  @Prop({ required: true, trim: true })
  patchMaturity: string;

  @Prop({ default: '', trim: true })
  comments: string;
}

export type ObjectDocument = ObjectEntity & Document;
export const ObjectSchema = SchemaFactory.createForClass(ObjectEntity);
