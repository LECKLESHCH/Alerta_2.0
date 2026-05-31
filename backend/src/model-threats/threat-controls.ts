export type ThreatSourceType = 'web' | 'tg' | 'forum';

export interface ThreatControlSection {
  key: string;
  controls: string[];
  details?: string[];
}

export const THREAT_CONTROL_SECTIONS: ThreatControlSection[] = [
  {
    key: 'physical',
    controls: [
      'securityGuard',
      'checkpoint',
      'cctv',
      'visitorLog',
      'contractorControl',
      'serverRoomProtection',
      'accessCards',
      'biometrics',
      'zoneSeparation',
      'keyStorageControl',
      'lockedRacks',
      'temperatureSensors',
      'fireSuppression',
      'backupPower',
      'upsGenerators',
    ],
  },
  {
    key: 'perimeter',
    controls: [
      'firewall',
      'dmz',
      'nat',
      'proxy',
      'vpn',
      'publishedPortsControl',
      'remoteAccessControl',
      'webServicesProtection',
      'mailGatewayProtection',
      'idsIps',
      'anomalyDetection',
    ],
    details: ['firewallDetails', 'vpnDetails', 'idsIpsDetails'],
  },
  {
    key: 'network',
    controls: [
      'vlan',
      'segmentation',
      'criticalSegmentIsolation',
      'acl',
      'routingControl',
      'switchProtection',
      'netflow',
      'trafficAnalysis',
      'anomalyMonitoring',
    ],
    details: ['networkEquipment'],
  },
  {
    key: 'endpoints',
    controls: [
      'antivirus',
      'edrXdr',
      'osUpdates',
      'softwareControl',
      'hardening',
      'disableUnusedServices',
      'patchManagement',
      'mdm',
      'diskEncryption',
      'remoteWipe',
      'usbControl',
    ],
    details: ['edrXdrDetails'],
  },
  {
    key: 'applications',
    controls: [
      'waf',
      'owaspControls',
      'inputValidation',
      'secureSdlc',
      'codeReview',
      'sastDast',
      'pentest',
      'vulnerabilityScanning',
      'remediationSla',
    ],
    details: ['appSecurityStack'],
  },
  {
    key: 'iam',
    controls: [
      'mfa',
      'passwordPolicy',
      'sso',
      'rbac',
      'leastPrivilege',
      'segregationOfDuties',
      'userLifecycle',
      'terminatedUserDisable',
      'serviceAccountControl',
    ],
    details: ['iamSystem'],
  },
  {
    key: 'data',
    controls: [
      'storageEncryption',
      'backup',
      'dataAccessControl',
      'tls',
      'protectedChannels',
      'dataClassification',
      'personalDataHandling',
      'tradeSecretHandling',
    ],
    details: ['backupStorageLocation'],
  },
  {
    key: 'monitoringResponse',
    controls: [
      'centralizedLogs',
      'siem',
      'eventCorrelation',
      'irProcedures',
      'playbooks',
      'soc',
      'threatIntel',
      'incidentInvestigation',
      'retrospectiveAnalysis',
    ],
    details: ['siemDetails'],
  },
  {
    key: 'governance',
    controls: [
      'securityPolicies',
      'regulations',
      'standards',
      'awarenessTraining',
      'phishingSimulations',
      'riskAssessment',
      'compliance',
      'contractorAudit',
    ],
  },
];

export function buildFlatControlKeys(): string[] {
  const keys: string[] = [];
  for (const section of THREAT_CONTROL_SECTIONS) {
    for (const control of section.controls) {
      keys.push(`${section.key}.${control}`);
    }
  }
  return keys;
}
