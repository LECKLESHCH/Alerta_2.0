import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class ReferenceCveCvssMetric {
  @Prop({ default: '' })
  version: string;

  @Prop({ default: 0 })
  baseScore: number;

  @Prop({ default: '' })
  baseSeverity: string;

  @Prop({ default: '' })
  vectorString: string;

  @Prop({ default: '' })
  attackVector: string;

  @Prop({ default: '' })
  attackComplexity: string;

  @Prop({ default: '' })
  privilegesRequired: string;

  @Prop({ default: '' })
  userInteraction: string;
}

const ReferenceCveCvssMetricSchema = SchemaFactory.createForClass(
  ReferenceCveCvssMetric,
);

@Schema({ timestamps: true, collection: 'reference_cves' })
export class ReferenceCve {
  @Prop({ required: true, unique: true, index: true })
  cveId: string;

  @Prop({ default: '' })
  sourceIdentifier: string;

  @Prop({ default: '' })
  vulnStatus: string;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  @Prop({ type: Date, default: null })
  lastModifiedAt: Date | null;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [String], default: [] })
  cwes: string[];

  @Prop({ type: [String], default: [] })
  cpes: string[];

  @Prop({ type: [String], default: [] })
  vendors: string[];

  @Prop({ type: [String], default: [] })
  products: string[];

  @Prop({ type: [String], default: [] })
  references: string[];

  @Prop({ type: ReferenceCveCvssMetricSchema, default: null })
  cvss: ReferenceCveCvssMetric | null;

  @Prop({ default: false })
  hasKev: boolean;
}

export type ReferenceCveDocument = ReferenceCve & Document;
export const ReferenceCveSchema = SchemaFactory.createForClass(ReferenceCve);
