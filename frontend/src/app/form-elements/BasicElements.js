import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import { Collapse } from 'react-bootstrap';
import { createObjectPassport } from '../../api/objects';

const objectTypes = [
  'АСУ ТП',
  'ЦОД',
  'Сервисный портал',
  'Сегмент сети',
  'АРМ оператора',
  'Система мониторинга',
];

const industries = [
  'Энергетика',
  'Транспорт',
  'Финансы',
  'Госсектор',
  'Телеком',
  'Промышленность',
];

const protectionLevels = [
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
];
const initialFormState = {
  objectName: '',
  objectType: 'ЦОД',
  protectionLevel: 'medium',
  industry: 'Энергетика',
  region: '',
  ownerUnit: '',
  comments: '',
  depth: {
    physical: {
      securityGuard: true,
      checkpoint: true,
      cctv: true,
      visitorLog: true,
      contractorControl: true,
      serverRoomProtection: true,
      accessCards: true,
      biometrics: false,
      zoneSeparation: true,
      keyStorageControl: true,
      lockedRacks: true,
      temperatureSensors: true,
      fireSuppression: true,
      backupPower: true,
      upsGenerators: true,
    },
    perimeter: {
      firewall: true,
      firewallDetails: '',
      dmz: true,
      nat: true,
      proxy: true,
      vpn: true,
      vpnDetails: '',
      publishedPortsControl: true,
      remoteAccessControl: true,
      webServicesProtection: true,
      mailGatewayProtection: true,
      idsIps: true,
      idsIpsDetails: '',
      anomalyDetection: true,
    },
    network: {
      vlan: true,
      segmentation: true,
      criticalSegmentIsolation: true,
      acl: true,
      routingControl: true,
      switchProtection: true,
      netflow: true,
      trafficAnalysis: true,
      anomalyMonitoring: true,
      networkEquipment: '',
    },
    endpoints: {
      antivirus: true,
      edrXdr: true,
      edrXdrDetails: '',
      osUpdates: true,
      softwareControl: true,
      hardening: true,
      disableUnusedServices: true,
      patchManagement: true,
      mdm: false,
      diskEncryption: true,
      remoteWipe: false,
      usbControl: true,
    },
    applications: {
      waf: true,
      owaspControls: true,
      inputValidation: true,
      secureSdlc: true,
      codeReview: true,
      sastDast: true,
      pentest: true,
      vulnerabilityScanning: true,
      remediationSla: true,
      appSecurityStack: '',
    },
    iam: {
      mfa: true,
      passwordPolicy: true,
      sso: false,
      rbac: true,
      leastPrivilege: true,
      segregationOfDuties: true,
      userLifecycle: true,
      terminatedUserDisable: true,
      serviceAccountControl: true,
      iamSystem: '',
    },
    data: {
      storageEncryption: true,
      backup: true,
      dataAccessControl: true,
      tls: true,
      protectedChannels: true,
      dataClassification: true,
      personalDataHandling: true,
      tradeSecretHandling: true,
      backupStorageLocation: '',
    },
    monitoringResponse: {
      centralizedLogs: true,
      siem: true,
      siemDetails: '',
      eventCorrelation: true,
      irProcedures: true,
      playbooks: true,
      soc: true,
      threatIntel: false,
      incidentInvestigation: true,
      retrospectiveAnalysis: true,
    },
    governance: {
      securityPolicies: true,
      regulations: true,
      standards: true,
      awarenessTraining: true,
      phishingSimulations: true,
      riskAssessment: true,
      compliance: true,
      contractorAudit: true,
    },
  },
};

function renderOptions(items) {
  return items.map((item) => (
    <option key={item} value={item}>
      {item}
    </option>
  ));
}

function SectionCard({ title, children }) {
  return (
    <div className="card">
      <div className="card-body">
        <h4 className="card-title">{title}</h4>
        {children}
      </div>
    </div>
  );
}

function CheckItem({
  checked,
  onToggle,
  label,
  details,
  onDetailsChange,
  detailsPlaceholder,
}) {
  return (
    <div className="mb-1">
      <div className="form-check">
        <label className="form-check-label text-white">
          <input
            type="checkbox"
            className="form-check-input"
            checked={checked}
            onChange={onToggle}
          />
          {label}
          <i className="input-helper"></i>
        </label>
      </div>
      {checked && typeof details === 'string' ? (
        <div className="mt-1 pl-4">
          <Form.Control
            type="text"
            value={details}
            onChange={onDetailsChange}
            placeholder={detailsPlaceholder}
          />
        </div>
      ) : null}
    </div>
  );
}

function chunkByColumns(items, columns = 3) {
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

export class BasicElements extends Component {
  state = {
    form: { ...initialFormState },
    openDepthRows: {
      row1: false,
      row2: false,
      row3: false,
    },
    isSaving: false,
    saveError: '',
    saveSuccess: '',
    savedObjectId: '',
  };

  handleInputChange = (event) => {
    const { name, type, checked, value } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        [name]: type === 'range' ? Number(nextValue) : nextValue,
      },
      saveError: '',
      saveSuccess: '',
    }));
  };

  handleDepthToggle = (section, key) => {
    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        depth: {
          ...prevState.form.depth,
          [section]: {
            ...prevState.form.depth[section],
            [key]: !prevState.form.depth[section][key],
          },
        },
      },
    }));
  };

  handleDepthDetails = (section, key, value) => {
    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        depth: {
          ...prevState.form.depth,
          [section]: {
            ...prevState.form.depth[section],
            [key]: value,
          },
        },
      },
    }));
  };

  getDepthRow(section) {
    const rowMap = {
      physical: 'row1',
      perimeter: 'row1',
      network: 'row1',
      endpoints: 'row2',
      applications: 'row2',
      iam: 'row2',
      data: 'row3',
      monitoringResponse: 'row3',
      governance: 'row3',
    };
    return rowMap[section] || 'row1';
  }

  toggleDepthSection = (section) => {
    const row = this.getDepthRow(section);
    this.setState((prevState) => ({
      openDepthRows: {
        ...prevState.openDepthRows,
        [row]: !prevState.openDepthRows[row],
      },
    }));
  };

  buildDepthSummary = () => {
    const { depth } = this.state.form;
    return JSON.stringify(depth, null, 2);
  };

  handleReset = () => {
    this.setState({
      form: { ...initialFormState },
      isSaving: false,
      saveError: '',
      saveSuccess: '',
      savedObjectId: '',
    });
  };

  handleSubmit = async (event) => {
    event.preventDefault();
    this.setState({
      isSaving: true,
      saveError: '',
      saveSuccess: '',
      savedObjectId: '',
    });

    try {
      const payload = {
        objectName: this.state.form.objectName,
        objectType: this.state.form.objectType,
        industry: this.state.form.industry,
        region: this.state.form.region,
        ownerUnit: this.state.form.ownerUnit,
        protectionLevel: this.state.form.protectionLevel,
        depth: this.state.form.depth,
        comments: [
          this.state.form.comments.trim(),
          '',
          '--- Defence in Depth (structured draft) ---',
          this.buildDepthSummary(),
        ]
          .filter(Boolean)
          .join('\n'),
      };

      const saved = await createObjectPassport(payload);
      this.setState({
        isSaving: false,
        saveError: '',
        saveSuccess: 'Паспорт КИИ сохранён в базе данных.',
        savedObjectId: saved?._id || '',
      });
    } catch (error) {
      this.setState({
        isSaving: false,
        saveError: error.message || 'Не удалось сохранить паспорт КИИ.',
        saveSuccess: '',
        savedObjectId: '',
      });
    }
  };

  renderDepthCard(title, sectionKey, items) {
    const rowKey = this.getDepthRow(sectionKey);
    const isOpen = this.state.openDepthRows[rowKey];
    const orderedItems = [
      ...items.filter((item) => !item.detailsKey),
      ...items.filter((item) => item.detailsKey),
    ];
    const rows = chunkByColumns(orderedItems, 1);

    return (
      <div className="col-lg-4 col-md-6 grid-margin stretch-card" key={sectionKey}>
        <div className="card w-100">
          <div
            className="card-body d-flex flex-column p-0"
            style={{ minHeight: '100%' }}
          >
            <button
              type="button"
              className="btn btn-link text-left w-100 d-flex align-items-center justify-content-between px-3 py-3"
              style={{ textDecoration: 'none' }}
              onClick={() => this.toggleDepthSection(sectionKey)}
            >
              <h5 className="mb-0 text-white">{title}</h5>
              <i className={`mdi ${isOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'} text-white`}></i>
            </button>
            <Collapse in={isOpen}>
              <div className="px-3 pb-3 pt-0">
                {rows.map((row, rowIndex) => (
                  <div className="row" key={`${sectionKey}-${rowIndex}`}>
                    {row.map((item) => (
                      <div className="col-12 mb-1" key={`${sectionKey}-${item.key}`}>
                        <CheckItem
                          checked={this.state.form.depth[sectionKey][item.key]}
                          onToggle={() => this.handleDepthToggle(sectionKey, item.key)}
                          label={item.label}
                          details={
                            item.detailsKey
                              ? this.state.form.depth[sectionKey][item.detailsKey]
                              : undefined
                          }
                          onDetailsChange={
                            item.detailsKey
                              ? (event) =>
                                  this.handleDepthDetails(
                                    sectionKey,
                                    item.detailsKey,
                                    event.target.value,
                                  )
                              : undefined
                          }
                          detailsPlaceholder={item.detailsPlaceholder}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Collapse>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { form, isSaving, saveError, saveSuccess, savedObjectId } = this.state;

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Паспорт объекта КИИ</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Модель объекта
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Паспорт объекта КИИ
              </li>
            </ol>
          </nav>
        </div>

        <Form onSubmit={this.handleSubmit}>
          <div className="row">
            <div className="col-12 grid-margin">
              <SectionCard title="Профиль объекта">
                <div className="row">
                  <div className="col-md-6">
                    <Form.Group>
                      <label htmlFor="objectName">Наименование объекта</label>
                      <Form.Control
                        type="text"
                        id="objectName"
                        name="objectName"
                        value={form.objectName}
                        onChange={this.handleInputChange}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-6">
                    <Form.Group>
                      <label htmlFor="objectType">Тип объекта</label>
                      <select
                        className="form-control alerta-filter-control alerta-object-select"
                        id="objectType"
                        name="objectType"
                        value={form.objectType}
                        onChange={this.handleInputChange}
                      >
                        {renderOptions(objectTypes)}
                      </select>
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group>
                      <label htmlFor="industry">Отрасль</label>
                      <select
                        className="form-control alerta-filter-control alerta-object-select"
                        id="industry"
                        name="industry"
                        value={form.industry}
                        onChange={this.handleInputChange}
                      >
                        {renderOptions(industries)}
                      </select>
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group>
                      <label htmlFor="protectionLevel">Уровень защиты</label>
                      <select
                        className="form-control alerta-filter-control alerta-object-select"
                        id="protectionLevel"
                        name="protectionLevel"
                        value={form.protectionLevel}
                        onChange={this.handleInputChange}
                      >
                        {protectionLevels.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group>
                      <label htmlFor="region">Регион</label>
                      <Form.Control
                        type="text"
                        id="region"
                        name="region"
                        value={form.region}
                        onChange={this.handleInputChange}
                      />
                    </Form.Group>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="col-12">
              <div className="row">
                {this.renderDepthCard('1. Физический уровень', 'physical', [
              { key: 'securityGuard', label: 'Наличие охраны' },
              { key: 'checkpoint', label: 'Наличие КПП' },
              { key: 'cctv', label: 'Видеонаблюдение' },
              { key: 'visitorLog', label: 'Журнал посещений' },
              { key: 'contractorControl', label: 'Контроль подрядчиков' },
              { key: 'serverRoomProtection', label: 'Охрана серверных помещений' },
              { key: 'accessCards', label: 'Электронные пропуска' },
              { key: 'biometrics', label: 'Биометрия' },
              { key: 'zoneSeparation', label: 'Разграничение зон доступа' },
              { key: 'keyStorageControl', label: 'Контроль хранения ключей' },
              { key: 'lockedRacks', label: 'Закрытые стойки' },
              { key: 'temperatureSensors', label: 'Датчики температуры' },
              { key: 'fireSuppression', label: 'Пожаротушение' },
              { key: 'backupPower', label: 'Резервное питание' },
              { key: 'upsGenerators', label: 'UPS/генераторы' },
                ])}

                {this.renderDepthCard('2. Периметровая защита', 'perimeter', [
              { key: 'firewall', label: 'Firewall', detailsKey: 'firewallDetails', detailsPlaceholder: 'Например: Cisco ASA, FortiGate, UserGate' },
              { key: 'dmz', label: 'DMZ' },
              { key: 'nat', label: 'NAT' },
              { key: 'proxy', label: 'Прокси' },
              { key: 'vpn', label: 'VPN', detailsKey: 'vpnDetails', detailsPlaceholder: 'Например: IPsec/OpenVPN + MFA' },
              { key: 'publishedPortsControl', label: 'Контроль опубликованных портов' },
              { key: 'remoteAccessControl', label: 'Контроль удаленного доступа' },
              { key: 'webServicesProtection', label: 'Защита веб-сервисов' },
              { key: 'mailGatewayProtection', label: 'Защита почтовых шлюзов' },
              { key: 'idsIps', label: 'IDS/IPS', detailsKey: 'idsIpsDetails', detailsPlaceholder: 'Например: Suricata, Snort, Kaspersky KATA' },
              { key: 'anomalyDetection', label: 'Анализ аномалий' },
                ])}

                {this.renderDepthCard('3. Сетевой уровень', 'network', [
              { key: 'vlan', label: 'VLAN' },
              { key: 'segmentation', label: 'Сегментация' },
              { key: 'criticalSegmentIsolation', label: 'Изоляция критических сегментов' },
              { key: 'acl', label: 'ACL' },
              { key: 'routingControl', label: 'Контроль маршрутизации' },
              { key: 'switchProtection', label: 'Защищенность коммутаторов' },
              { key: 'netflow', label: 'NetFlow' },
              { key: 'trafficAnalysis', label: 'Анализ трафика' },
              { key: 'anomalyMonitoring', label: 'Мониторинг аномалий' },
              {
                key: 'networkEquipment',
                label: 'Сетевое оборудование',
                detailsKey: 'networkEquipment',
                detailsPlaceholder: 'Например: Cisco Catalyst, Juniper EX, MikroTik',
              },
                ])}

                {this.renderDepthCard('4. Уровень конечных устройств', 'endpoints', [
              { key: 'antivirus', label: 'Антивирус' },
              { key: 'edrXdr', label: 'EDR/XDR', detailsKey: 'edrXdrDetails', detailsPlaceholder: 'Например: Defender for Endpoint, CrowdStrike' },
              { key: 'osUpdates', label: 'Обновления ОС' },
              { key: 'softwareControl', label: 'Контроль ПО' },
              { key: 'hardening', label: 'Hardening серверов' },
              { key: 'disableUnusedServices', label: 'Отключение ненужных служб' },
              { key: 'patchManagement', label: 'Управление патчами' },
              { key: 'mdm', label: 'MDM' },
              { key: 'diskEncryption', label: 'Шифрование' },
              { key: 'remoteWipe', label: 'Удаленное стирание' },
              { key: 'usbControl', label: 'Контроль USB' },
                ])}

                {this.renderDepthCard('5. Уровень приложений', 'applications', [
              { key: 'waf', label: 'WAF' },
              { key: 'owaspControls', label: 'Защита от OWASP Top 10' },
              { key: 'inputValidation', label: 'Проверка входных данных' },
              { key: 'secureSdlc', label: 'Secure SDLC' },
              { key: 'codeReview', label: 'Code review' },
              { key: 'sastDast', label: 'SAST/DAST' },
              { key: 'pentest', label: 'Pentest' },
              { key: 'vulnerabilityScanning', label: 'Vulnerability scanning' },
              { key: 'remediationSla', label: 'Сроки устранения уязвимостей' },
              {
                key: 'appSecurityStack',
                label: 'Стек защиты приложений',
                detailsKey: 'appSecurityStack',
                detailsPlaceholder: 'Например: NGINX+ModSecurity, SonarQube, Burp, PT AF',
              },
                ])}

                {this.renderDepthCard('6. Уровень идентификации и доступа (IAM)', 'iam', [
              { key: 'mfa', label: 'MFA' },
              { key: 'passwordPolicy', label: 'Политика паролей' },
              { key: 'sso', label: 'SSO' },
              { key: 'rbac', label: 'RBAC' },
              { key: 'leastPrivilege', label: 'Минимальные привилегии' },
              { key: 'segregationOfDuties', label: 'Segregation of duties' },
              { key: 'userLifecycle', label: 'Жизненный цикл пользователей' },
              { key: 'terminatedUserDisable', label: 'Отключение уволенных сотрудников' },
              { key: 'serviceAccountControl', label: 'Контроль сервисных аккаунтов' },
              {
                key: 'iamSystem',
                label: 'IAM-система',
                detailsKey: 'iamSystem',
                detailsPlaceholder: 'Например: Keycloak, AD/Entra ID, FreeIPA',
              },
                ])}

                {this.renderDepthCard('7. Уровень данных', 'data', [
              { key: 'storageEncryption', label: 'Шифрование хранения данных' },
              { key: 'backup', label: 'Резервное копирование' },
              { key: 'dataAccessControl', label: 'Контроль доступа к данным' },
              { key: 'tls', label: 'TLS' },
              { key: 'protectedChannels', label: 'Защищенные каналы передачи' },
              { key: 'dataClassification', label: 'Классификация данных' },
              { key: 'personalDataHandling', label: 'Контроль персональных данных' },
              { key: 'tradeSecretHandling', label: 'Контроль коммерческой тайны' },
              {
                key: 'backupStorageLocation',
                label: 'Хранение резервных копий',
                detailsKey: 'backupStorageLocation',
                detailsPlaceholder: 'Например: offline backup / отдельный сегмент / S3-compatible storage',
              },
                ])}

                {this.renderDepthCard('8. Мониторинг и реагирование', 'monitoringResponse', [
              { key: 'centralizedLogs', label: 'Централизованный сбор логов' },
              { key: 'siem', label: 'SIEM', detailsKey: 'siemDetails', detailsPlaceholder: 'Например: Splunk, ELK, QRadar, MaxPatrol SIEM' },
              { key: 'eventCorrelation', label: 'Корреляция событий' },
              { key: 'irProcedures', label: 'IR-процедуры' },
              { key: 'playbooks', label: 'Playbooks' },
              { key: 'soc', label: 'SOC' },
              { key: 'threatIntel', label: 'Threat Intelligence' },
              { key: 'incidentInvestigation', label: 'Расследование инцидентов' },
              { key: 'retrospectiveAnalysis', label: 'Ретроспективный анализ' },
                ])}

                {this.renderDepthCard('9. Организационный уровень', 'governance', [
              { key: 'securityPolicies', label: 'Политики ИБ' },
              { key: 'regulations', label: 'Регламенты' },
              { key: 'standards', label: 'Стандарты' },
              { key: 'awarenessTraining', label: 'Awareness training' },
              { key: 'phishingSimulations', label: 'Phishing simulations' },
              { key: 'riskAssessment', label: 'Risk assessment' },
              { key: 'compliance', label: 'Compliance' },
              { key: 'contractorAudit', label: 'Аудит подрядчиков' },
                ])}
              </div>
            </div>

            <div className="col-12 grid-margin">
              <SectionCard title="Комментарии">
                <Form.Group className="mb-0">
                  <Form.Control
                    as="textarea"
                    rows={5}
                    id="comments"
                    name="comments"
                    value={form.comments}
                    onChange={this.handleInputChange}
                    placeholder="Дополнительные замечания аналитика."
                  />
                </Form.Group>
              </SectionCard>
            </div>

            <div className="col-12 grid-margin">
              <div className="card">
                <div className="card-body">
                  <h4 className="card-title">Черновик паспорта</h4>
                  {saveSuccess ? (
                    <div className="alert alert-success" role="alert">
                      {saveSuccess}
                      {savedObjectId ? ` ID: ${savedObjectId}` : ''}
                    </div>
                  ) : null}
                  {saveError ? (
                    <div className="alert alert-danger" role="alert">
                      {saveError}
                    </div>
                  ) : null}
                  <div className="d-flex flex-wrap align-items-center">
                    <button
                      type="submit"
                      className="btn btn-success mr-3 mb-2 mb-sm-0"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Сохраняем...' : 'Сохранить паспорт'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={this.handleReset}
                      disabled={isSaving}
                    >
                      Очистить форму
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Form>
      </div>
    );
  }
}

export default BasicElements;
