#!/usr/bin/env node
/* eslint-disable no-console */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/alerta';

const rootEnvPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  const lines = fs.readFileSync(rootEnvPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
}

const payloads = [
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
      applications: { controls: { waf: true, secureSdlc: true, sastDast: true }, appSecurityStack: 'NGINX + ModSecurity, SonarQube' },
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

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || MONGO_URI);
  const collection = mongoose.connection.collection('model_object');
  let upserted = 0;
  const legacyUnset = {
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

  for (const item of payloads) {
    await collection.updateOne(
      { objectName: item.objectName },
      {
        $set: {
          ...item,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
        $unset: legacyUnset,
      },
      { upsert: true },
    );
    upserted += 1;
  }

  const total = await collection.countDocuments({});
  console.log(`model_object seeded: ${upserted}, total records: ${total}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Failed to seed model_object:', error);
  await mongoose.disconnect();
  process.exit(1);
});
