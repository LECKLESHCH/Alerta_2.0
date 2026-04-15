import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ObjectEntity } from './object.schema';

export interface CreateObjectPayload {
  objectName: string;
  objectType: string;
  criticalityClass: string;
  industry: string;
  subIndustry?: string;
  region?: string;
  ownerUnit?: string;
  businessCriticality: number;
  impactConfidentiality: number;
  impactIntegrity: number;
  impactAvailability: number;
  downtimeTolerance?: string;
  attackSurface: number;
  remoteAccessLevel: number;
  integrationLevel?: string;
  internetExposed?: boolean;
  contractorAccess?: boolean;
  userInteractionDependency?: boolean;
  isIcs?: boolean;
  segmentationLevel: number;
  legacyShare: number;
  cloudPresence: number;
  securityMaturity: string;
  monitoringMaturity: string;
  patchMaturity: string;
  comments?: string;
}

@Injectable()
export class ObjectService {
  constructor(
    @InjectModel(ObjectEntity.name)
    private readonly objectModel: Model<ObjectEntity>,
  ) {}

  async create(payload: CreateObjectPayload) {
    const created = await this.objectModel.create({
      ...payload,
      subIndustry: payload.subIndustry ?? '',
      region: payload.region ?? '',
      ownerUnit: payload.ownerUnit ?? '',
      downtimeTolerance: payload.downtimeTolerance ?? '',
      integrationLevel: payload.integrationLevel ?? '',
      comments: payload.comments ?? '',
      internetExposed: Boolean(payload.internetExposed),
      contractorAccess: Boolean(payload.contractorAccess),
      userInteractionDependency: Boolean(payload.userInteractionDependency),
      isIcs: Boolean(payload.isIcs),
    });

    return created.toObject();
  }

  async findAll() {
    return this.objectModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async removeById(id: string) {
    return this.objectModel.findByIdAndDelete(id).lean().exec();
  }
}
