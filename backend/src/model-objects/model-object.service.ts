import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ModelObjectEntity } from './model-object.schema';

export interface CreateModelObjectPayload {
  objectName: string;
  objectType: string;
  industry: string;
  subIndustry?: string;
  region?: string;
  ownerUnit?: string;
  protectionLevel: 'high' | 'medium' | 'low';
  comments?: string;
  depth?: Record<string, unknown>;
}

const DEFAULT_DEPTH_TEMPLATE = {
  physical: { controls: {} },
  perimeter: { controls: {} },
  network: { controls: {} },
  endpoints: { controls: {} },
  applications: { controls: {} },
  iam: { controls: {} },
  data: { controls: {} },
  monitoringResponse: { controls: {} },
  governance: { controls: {} },
};

const DEFAULT_OBJECT_MODELS: CreateModelObjectPayload[] = [
  {
    objectName: 'Эталон: высокий уровень защиты',
    objectType: 'ЦОД',
    industry: 'Энергетика',
    protectionLevel: 'high',
    region: 'Москва',
    ownerUnit: 'Служба ИБ',
    comments: 'Профиль с сильной эшелонированной защитой и зрелыми процессами.',
    depth: {
      physical: { controls: { securityGuard: true, cctv: true, lockedRacks: true } },
      perimeter: {
        controls: { firewall: true, dmz: true, vpn: true, idsIps: true },
        firewallDetails: 'FortiGate 200F',
        vpnDetails: 'IPsec + MFA',
        idsIpsDetails: 'Suricata',
      },
      network: { controls: { vlan: true, segmentation: true, acl: true, netflow: true }, networkEquipment: 'Cisco Catalyst 9300, Juniper EX4300' },
      endpoints: { controls: { antivirus: true, edrXdr: true, patchManagement: true }, edrXdrDetails: 'Microsoft Defender for Endpoint' },
      applications: {
        controls: { waf: true, secureSdlc: true, sastDast: true },
        appSecurityStack: 'NGINX + ModSecurity, SonarQube',
      },
      iam: { controls: { mfa: true, rbac: true, leastPrivilege: true }, iamSystem: 'AD + Entra ID' },
      data: { controls: { storageEncryption: true, backup: true, tls: true }, backupStorageLocation: 'Offline backup + отдельный сегмент' },
      monitoringResponse: { controls: { siem: true, irProcedures: true, soc: true }, siemDetails: 'MaxPatrol SIEM' },
      governance: { controls: { securityPolicies: true, riskAssessment: true, compliance: true } },
    },
  },
  {
    objectName: 'Эталон: средний уровень защиты',
    objectType: 'Сервисный портал',
    industry: 'Телеком',
    protectionLevel: 'medium',
    region: 'Санкт-Петербург',
    ownerUnit: 'ИТ-департамент',
    comments: 'Сбалансированный профиль: базовые контуры работают, но есть зоны усиления.',
    depth: {
      physical: { controls: { securityGuard: true, cctv: true, lockedRacks: false } },
      perimeter: {
        controls: { firewall: true, dmz: false, vpn: true, idsIps: false },
        firewallDetails: 'UserGate C100',
        vpnDetails: 'OpenVPN',
      },
      network: { controls: { vlan: true, segmentation: true, acl: true, netflow: false }, networkEquipment: 'MikroTik CCR + TP-Link L2' },
      endpoints: { controls: { antivirus: true, edrXdr: false, patchManagement: true }, edrXdrDetails: '' },
      applications: { controls: { waf: false, secureSdlc: true, sastDast: false }, appSecurityStack: 'SonarQube (basic)' },
      iam: { controls: { mfa: true, rbac: true, leastPrivilege: true }, iamSystem: 'AD DS' },
      data: { controls: { storageEncryption: true, backup: true, tls: true }, backupStorageLocation: 'NAS в отдельной подсети' },
      monitoringResponse: { controls: { siem: false, irProcedures: true, soc: false }, siemDetails: '' },
      governance: { controls: { securityPolicies: true, riskAssessment: true, compliance: false } },
    },
  },
  {
    objectName: 'Эталон: низкий уровень защиты',
    objectType: 'АРМ оператора',
    industry: 'Промышленность',
    protectionLevel: 'low',
    region: 'Региональный филиал',
    ownerUnit: 'Производственный отдел',
    comments: 'Упрощенный профиль: минимальные меры, высокий остаточный риск.',
    depth: {
      physical: { controls: { securityGuard: false, cctv: false, lockedRacks: false } },
      perimeter: { controls: { firewall: true, dmz: false, vpn: false, idsIps: false }, firewallDetails: 'SOHO firewall', vpnDetails: '' },
      network: { controls: { vlan: false, segmentation: false, acl: false, netflow: false }, networkEquipment: 'Неинвентаризировано' },
      endpoints: { controls: { antivirus: true, edrXdr: false, patchManagement: false }, edrXdrDetails: '' },
      applications: { controls: { waf: false, secureSdlc: false, sastDast: false }, appSecurityStack: '' },
      iam: { controls: { mfa: false, rbac: false, leastPrivilege: false }, iamSystem: '' },
      data: { controls: { storageEncryption: false, backup: true, tls: true }, backupStorageLocation: 'Локальный диск' },
      monitoringResponse: { controls: { siem: false, irProcedures: false, soc: false }, siemDetails: '' },
      governance: { controls: { securityPolicies: false, riskAssessment: false, compliance: false } },
    },
  },
];

const LEGACY_MODEL_FIELDS_UNSET = {
  criticalityClass: '',
  businessCriticality: '',
  impactConfidentiality: '',
  impactIntegrity: '',
  impactAvailability: '',
  attackSurface: '',
  remoteAccessLevel: '',
  segmentationLevel: '',
  legacyShare: '',
  cloudPresence: '',
  securityMaturity: '',
  monitoringMaturity: '',
  patchMaturity: '',
};

@Injectable()
export class ModelObjectService {
  constructor(
    @InjectModel(ModelObjectEntity.name)
    private readonly modelObjectModel: Model<ModelObjectEntity>,
  ) {}

  async create(payload: CreateModelObjectPayload) {
    const created = await this.modelObjectModel.create({
      ...payload,
      protectionLevel: payload.protectionLevel ?? 'medium',
      subIndustry: payload.subIndustry ?? '',
      region: payload.region ?? '',
      ownerUnit: payload.ownerUnit ?? '',
      comments: payload.comments ?? '',
      depth: this.normalizeDepth(payload.depth),
    });

    return created.toObject();
  }

  async findAll() {
    return this.modelObjectModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async removeById(id: string) {
    return this.modelObjectModel.findByIdAndDelete(id).lean().exec();
  }

  async updateById(id: string, payload: Partial<CreateModelObjectPayload>) {
    const patch: Record<string, unknown> = {};

    if (typeof payload.objectName === 'string') {
      patch.objectName = payload.objectName.trim();
    }
    if (typeof payload.objectType === 'string') {
      patch.objectType = payload.objectType.trim();
    }
    if (typeof payload.industry === 'string') {
      patch.industry = payload.industry.trim();
    }
    if (typeof payload.subIndustry === 'string') {
      patch.subIndustry = payload.subIndustry.trim();
    }
    if (typeof payload.region === 'string') {
      patch.region = payload.region.trim();
    }
    if (typeof payload.ownerUnit === 'string') {
      patch.ownerUnit = payload.ownerUnit.trim();
    }
    if (typeof payload.protectionLevel === 'string') {
      patch.protectionLevel = payload.protectionLevel;
    }
    if (typeof payload.comments === 'string') {
      patch.comments = payload.comments;
    }
    if (payload.depth && typeof payload.depth === 'object') {
      patch.depth = this.normalizeDepth(payload.depth);
    }

    return this.modelObjectModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean()
      .exec();
  }

  async seedDefaults() {
    const result = [];
    for (const item of DEFAULT_OBJECT_MODELS) {
      const upserted = await this.modelObjectModel
        .findOneAndUpdate(
          { objectName: item.objectName },
          {
            $set: {
              ...item,
              depth: this.normalizeDepth(item.depth),
            },
            $unset: LEGACY_MODEL_FIELDS_UNSET,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        )
        .lean()
        .exec();
      result.push(upserted);
    }
    return result;
  }

  private normalizeDepth(
    depth: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!depth || typeof depth !== 'object') {
      return DEFAULT_DEPTH_TEMPLATE;
    }

    const normalized: Record<string, unknown> = { ...DEFAULT_DEPTH_TEMPLATE };
    for (const key of Object.keys(DEFAULT_DEPTH_TEMPLATE)) {
      const section = depth[key];
      if (section && typeof section === 'object') {
        normalized[key] = section;
      }
    }
    return normalized;
  }
}
