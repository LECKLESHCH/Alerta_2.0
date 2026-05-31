import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
class DepthSection {
  @Prop({ type: Object, default: {} })
  controls: Record<string, unknown>;
}

@Schema({ _id: false })
class DefenceInDepth {
  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  physical: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  perimeter: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  network: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  endpoints: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  applications: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  iam: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  data: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  monitoringResponse: DepthSection;

  @Prop({ type: DepthSection, default: () => ({ controls: {} }) })
  governance: DepthSection;
}

const DefenceInDepthSchema = SchemaFactory.createForClass(DefenceInDepth);

@Schema({ timestamps: true, collection: 'model_object' })
export class ModelObjectEntity {
  @Prop({ required: true, trim: true })
  objectName: string;

  @Prop({ required: true, trim: true })
  objectType: string;

  @Prop({ required: true, trim: true })
  industry: string;

  @Prop({ default: '', trim: true })
  subIndustry: string;

  @Prop({ default: '', trim: true })
  region: string;

  @Prop({ default: '', trim: true })
  ownerUnit: string;

  @Prop({ required: true, enum: ['high', 'medium', 'low'], default: 'medium' })
  protectionLevel: 'high' | 'medium' | 'low';

  @Prop({ default: '', trim: true })
  comments: string;

  @Prop({ type: DefenceInDepthSchema, default: () => ({}) })
  depth: DefenceInDepth;
}

export type ModelObjectDocument = ModelObjectEntity & Document;
export const ModelObjectSchema = SchemaFactory.createForClass(ModelObjectEntity);
