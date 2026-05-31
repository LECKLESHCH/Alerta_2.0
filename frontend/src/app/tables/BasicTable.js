import React, { Component } from 'react';
import { ProgressBar } from 'react-bootstrap';
import { fetchArticles } from '../../api/articles';
import { fetchObjects } from '../../api/objects';
import { fetchAllModelThreats } from '../../api/modelThreats';
import {
  buildObjectThreatMatches,
  formatRiskPercent,
  formatThreatDate,
  getRiskBadgeClass,
  getRiskLabel,
  getRiskProgressVariant,
  summarizeObjectRisk,
} from '../../utils/matchingMatrix';
import {
  getThreatCategoryLabel,
  getThreatSubcategoryLabel,
} from '../../utils/threatLabels';
import { buildInterpretationMeta } from '../../utils/interpretation';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function formatScore(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
}

function getSeverityBadgeClass(severity) {
  switch (normalizeText(severity)) {
    case 'critical':
    case 'high':
      return 'badge badge-danger';
    case 'medium':
      return 'badge badge-warning';
    case 'low':
      return 'badge badge-success';
    default:
      return 'badge badge-info';
  }
}

function getSeverityLabel(severity) {
  switch (normalizeText(severity)) {
    case 'critical':
      return 'Критический';
    case 'high':
      return 'Высокий';
    case 'medium':
      return 'Средний';
    case 'low':
      return 'Низкий';
    default:
      return 'Нет данных';
  }
}

const LEVEL_LABELS = {
  physical: 'Физический (L1)',
  perimeter: 'Периметр (L2)',
  network: 'Сеть (L3)',
  endpoints: 'Endpoints (L4)',
  applications: 'Приложения (L5)',
  iam: 'IAM (L6)',
  data: 'Данные (L7)',
  monitoringResponse: 'Мониторинг (L8)',
  governance: 'Оргуровень (L9)',
  organizational: 'Оргуровень (L9)',
};

const CONTROL_LABELS = {
  securityGuard: 'Охрана',
  checkpoint: 'КПП',
  cctv: 'Видеонаблюдение',
  visitorLog: 'Журнал посещений',
  contractorControl: 'Контроль подрядчиков',
  serverRoomProtection: 'Защита серверной',
  accessCards: 'Электронные пропуска',
  biometrics: 'Биометрия',
  zoneSeparation: 'Разграничение зон доступа',
  keyStorageControl: 'Контроль хранения ключей',
  lockedRacks: 'Закрытые стойки',
  temperatureSensors: 'Датчики температуры',
  fireSuppression: 'Пожаротушение',
  backupPower: 'Резервное питание',
  upsGenerators: 'UPS/генераторы',
  firewall: 'Firewall',
  dmz: 'DMZ',
  nat: 'NAT',
  proxy: 'Прокси',
  vpn: 'VPN',
  publishedPortsControl: 'Контроль опубликованных портов',
  remoteAccessControl: 'Контроль удаленного доступа',
  webServicesProtection: 'Защита веб-сервисов',
  mailGatewayProtection: 'Защита почтового шлюза',
  idsIps: 'IDS/IPS',
  anomalyDetection: 'Обнаружение аномалий',
  vlan: 'VLAN',
  segmentation: 'Сегментация сети',
  criticalSegmentIsolation: 'Изоляция критических сегментов',
  acl: 'ACL',
  routingControl: 'Контроль маршрутизации',
  switchProtection: 'Защита коммутаторов',
  netflow: 'NetFlow',
  trafficAnalysis: 'Анализ трафика',
  anomalyMonitoring: 'Мониторинг аномалий',
  antivirus: 'Антивирус',
  edrXdr: 'EDR/XDR',
  osUpdates: 'Обновления ОС',
  softwareControl: 'Контроль ПО',
  hardening: 'Hardening',
  disableUnusedServices: 'Отключение неиспользуемых сервисов',
  patchManagement: 'Управление патчами',
  mdm: 'MDM',
  diskEncryption: 'Шифрование диска',
  remoteWipe: 'Удаленное стирание',
  usbControl: 'Контроль USB',
  waf: 'WAF',
  owaspControls: 'Защита OWASP Top 10',
  inputValidation: 'Валидация входных данных',
  secureSdlc: 'Secure SDLC',
  codeReview: 'Code Review',
  sastDast: 'SAST/DAST',
  pentest: 'Pentest',
  vulnerabilityScanning: 'Сканирование уязвимостей',
  remediationSla: 'SLA на устранение',
  mfa: 'MFA',
  passwordPolicy: 'Политика паролей',
  sso: 'SSO',
  rbac: 'RBAC',
  leastPrivilege: 'Минимальные привилегии',
  segregationOfDuties: 'Разделение обязанностей',
  userLifecycle: 'Жизненный цикл пользователей',
  terminatedUserDisable: 'Отключение уволенных пользователей',
  serviceAccountControl: 'Контроль сервисных аккаунтов',
  storageEncryption: 'Шифрование хранения',
  backup: 'Резервное копирование',
  dataAccessControl: 'Контроль доступа к данным',
  tls: 'TLS',
  protectedChannels: 'Защищенные каналы',
  dataClassification: 'Классификация данных',
  personalDataHandling: 'Обработка персональных данных',
  tradeSecretHandling: 'Коммерческая тайна',
  centralizedLogs: 'Централизованный сбор логов',
  siem: 'SIEM',
  eventCorrelation: 'Корреляция событий',
  irProcedures: 'Процедуры реагирования',
  playbooks: 'Playbooks',
  soc: 'SOC',
  threatIntel: 'Threat Intelligence',
  incidentInvestigation: 'Расследование инцидентов',
  retrospectiveAnalysis: 'Ретроспективный анализ',
  securityPolicies: 'Политики ИБ',
  regulations: 'Регламенты',
  standards: 'Стандарты',
  awarenessTraining: 'Обучение персонала',
  phishingSimulations: 'Фишинг-симуляции',
  riskAssessment: 'Оценка рисков',
  compliance: 'Compliance',
  contractorAudit: 'Аудит подрядчиков',
};

function getLevelLabel(levelKey) {
  return LEVEL_LABELS[levelKey] || levelKey;
}

function humanizeControlKey(controlKey) {
  const [level, control] = String(controlKey || '').split('.');
  const controlLabel = CONTROL_LABELS[control] || String(control || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!controlLabel) return controlKey;
  return `${getLevelLabel(level)} / ${controlLabel}`;
}

function EmptyState({ text }) {
  return (
    <div className="border rounded px-4 py-5 text-center text-muted" style={{ fontSize: '0.98rem' }}>
      {text}
    </div>
  );
}

class BasicTable extends Component {
  state = {
    threatItems: [],
    objectItems: [],
    isLoading: true,
    error: '',
    selectedObjectId: '',
    expandedMatchKey: null,
  };

  componentDidMount() {
    this.loadMatrixData();
  }

  async fetchAllThreats() {
    try {
      const modelThreats = await fetchAllModelThreats();
      if (modelThreats.length) {
        return modelThreats.sort((left, right) => {
          const leftDate = new Date(left.publishedAt || 0).getTime();
          const rightDate = new Date(right.publishedAt || 0).getTime();
          return rightDate - leftDate;
        });
      }
    } catch {
      // fallback to old threats pipeline
    }

    const items = [];
    const limit = 100;
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await fetchArticles({
        page,
        limit,
        type: 'threat',
        includeText: 0,
      });

      const pageItems = Array.isArray(response.items) ? response.items : [];
      items.push(...pageItems);
      totalPages = response.meta?.totalPages || 1;
      page += 1;
    }

    return items.sort((left, right) => {
      const leftDate = new Date(left.publishedAt || 0).getTime();
      const rightDate = new Date(right.publishedAt || 0).getTime();
      return rightDate - leftDate;
    });
  }

  async loadMatrixData() {
    this.setState({
      isLoading: true,
      error: '',
    });

    try {
      const [threatItems, objectItems] = await Promise.all([
        this.fetchAllThreats(),
        fetchObjects(),
      ]);

      this.setState({
        threatItems,
        objectItems: Array.isArray(objectItems) ? objectItems : [],
        isLoading: false,
        selectedObjectId:
          this.state.selectedObjectId ||
          (Array.isArray(objectItems) && objectItems[0]?._id) ||
          '',
      });
    } catch (error) {
      this.setState({
        threatItems: [],
        objectItems: [],
        isLoading: false,
        selectedObjectId: '',
        error:
          error.message || 'Не удалось загрузить матрицу сопоставления.',
      });
    }
  }

  handleSelectObject = (objectId) => {
    this.setState({ selectedObjectId: objectId, expandedMatchKey: null });
  };

  toggleMatchRow = (matchKey) => {
    this.setState((prevState) => ({
      expandedMatchKey:
        prevState.expandedMatchKey === matchKey ? null : matchKey,
    }));
  };

  renderThreatProfiles(threatItems) {
    if (!threatItems.length) {
      return <EmptyState text="После загрузки угроз из сбора здесь появится актуальный реестр профилей." />;
    }

    return (
      <div className="table-responsive">
        <table className="table table-hover text-white" style={{ fontSize: '0.98rem' }}>
          <thead>
            <tr>
              <th>Профиль угрозы</th>
              <th>Категория</th>
              <th>Уровни защиты</th>
              <th>Интерпретация</th>
              <th>Уровень опасности</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {threatItems.slice(0, 10).map((item) => {
              const interpretation = buildInterpretationMeta(item);

              return (
                <tr key={item._id || item.url} className="text-white">
                  <td>
                    <div className="font-weight-medium">{item.title}</div>
                    <div className="text-muted" style={{ fontSize: '0.92rem' }}>
                      {getThreatSubcategoryLabel(item.subcategory)}
                    </div>
                  </td>
                  <td>{getThreatCategoryLabel(item.category, 'Без категории')}</td>
                  <td style={{ minWidth: 220 }}>
                    {(item.targeted_levels || []).length ? (
                      <div className="d-flex flex-wrap">
                        {(item.targeted_levels || []).slice(0, 4).map((level) => (
                          <span
                            key={`${item._id || item.url}-${level}`}
                            className="badge badge-outline-info mr-1 mb-1"
                          >
                            {getLevelLabel(level)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.92rem' }}>Не определено</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <span className={interpretation.groundingBadgeClass}>
                        {interpretation.groundingLabel}
                      </span>
                    </div>
                      <div className="text-muted mt-1" style={{ fontSize: '0.92rem' }}>
                      {interpretation.primaryReference
                        ? `${interpretation.primaryReference.reference_id} · ${interpretation.matchCount}`
                        : interpretation.isNovel
                          ? 'нет эталона'
                          : interpretation.groundingPercent}
                    </div>
                  </td>
                  <td>
                    <span className={getSeverityBadgeClass(item.severity)}>
                      {getSeverityLabel(item.severity)}
                    </span>
                  </td>
                  <td>{formatThreatDate(item.publishedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }


  renderObjectList(objectItems, selectedObjectId, threatItems) {
    if (!objectItems.length) {
      return <EmptyState text="Сначала добавь хотя бы одну модель объекта, и справа появится список для сопоставления." />;
    }

    return (
      <div className="table-responsive">
        <table className="table table-hover text-white" style={{ fontSize: '0.98rem' }}>
          <thead>
            <tr>
              <th>Модель объекта</th>
              <th>Профиль</th>
              <th>Матчей</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {objectItems.map((item) => {
              const matches = buildObjectThreatMatches(item, threatItems);
              const summary = summarizeObjectRisk(matches);
              const isSelected = item._id === selectedObjectId;

              return (
                <tr
                  key={item._id}
                  className={`text-white ${isSelected ? 'table-active' : ''}`}
                >
                  <td>
                    <div className="font-weight-medium">{item.objectName}</div>
                    <div className="text-muted" style={{ fontSize: '0.92rem' }}>{item.region || item.industry}</div>
                  </td>
                  <td>
                    <div>{item.objectType}</div>
                    <div className="text-muted" style={{ fontSize: '0.92rem' }}>
                      {item.criticalityClass} | {item.industry}
                    </div>
                  </td>
                  <td>
                    <span className="d-block">Высокий: {summary.highCount}</span>
                    <span className="text-muted" style={{ fontSize: '0.92rem' }}>
                      Средний индекс: {formatRiskPercent(summary.averageScore)}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className={isSelected ? 'btn btn-success btn-sm' : 'btn btn-outline-light btn-sm'}
                      onClick={() => this.handleSelectObject(item._id)}
                    >
                      Анализ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  renderAnalysis(selectedObject, matches) {
    if (!selectedObject) {
      return <EmptyState text="Выбери модель объекта справа, и здесь появится анализ релевантных угроз." />;
    }

    if (!matches.length) {
      return <EmptyState text="Для выбранного объекта пока не нашлось угроз типа threat." />;
    }

    const summary = summarizeObjectRisk(matches);

    return (
      <div>
        <div className="d-flex flex-wrap align-items-start justify-content-between mb-4">
          <div className="mb-3">
            <h4 className="card-title mb-2" style={{ fontSize: '1.25rem' }}>
              Анализ для объекта {selectedObject.objectName}
            </h4>
          </div>
          <div className="d-flex flex-wrap">
            <div className="mr-4 mb-2">
              <div className="text-muted" style={{ fontSize: '0.92rem' }}>Высокий риск</div>
              <div className="h4 mb-0">{summary.highCount}</div>
            </div>
            <div className="mr-4 mb-2">
              <div className="text-muted" style={{ fontSize: '0.92rem' }}>Средний риск</div>
              <div className="h4 mb-0">{summary.mediumCount}</div>
            </div>
            <div className="mb-2">
              <div className="text-muted" style={{ fontSize: '0.92rem' }}>Средний индекс</div>
              <div className="h4 mb-0">{formatRiskPercent(summary.averageScore)}</div>
            </div>
          </div>
        </div>

        <div className="border rounded p-3 mb-4">
          <div className="row">
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="text-muted" style={{ fontSize: '0.92rem' }}>Тип объекта</div>
              <div>{selectedObject.objectType}</div>
            </div>
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="text-muted" style={{ fontSize: '0.92rem' }}>Класс значимости</div>
              <div>{selectedObject.criticalityClass}</div>
            </div>
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="text-muted" style={{ fontSize: '0.92rem' }}>Отрасль</div>
              <div>{selectedObject.industry}</div>
            </div>
            <div className="col-md-3">
              <div className="text-muted" style={{ fontSize: '0.92rem' }}>Критичность</div>
              <div>{formatScore(selectedObject.businessCriticality)}</div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-striped text-white" style={{ fontSize: '0.98rem' }}>
            <thead>
              <tr>
                <th>Модель угрозы</th>
                <th>Уровень риска</th>
                <th>Интерпретация</th>
                <th>Шкала опасности</th>
                <th>Ключевые факторы</th>
                <th>Служебные метрики</th>
              </tr>
            </thead>
            <tbody>
              {matches.slice(0, 12).map((item, index) => {
                const interpretation = buildInterpretationMeta(item.threat);
                const rowKey = item.threat._id || item.threat.url || String(index);
                const isExpanded = this.state.expandedMatchKey === rowKey;
                const levels = Array.isArray(item.threat.targeted_levels)
                  ? item.threat.targeted_levels
                  : [];
                const cves = Array.isArray(item.threat.cve_mentions)
                  ? item.threat.cve_mentions
                  : [];
                const vendors = Array.isArray(item.threat.vendor_candidates)
                  ? item.threat.vendor_candidates
                  : [];
                const products = Array.isArray(item.threat.product_candidates)
                  ? item.threat.product_candidates
                  : [];

                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className="text-white"
                      role="button"
                      style={{ cursor: 'pointer' }}
                      onClick={() => this.toggleMatchRow(rowKey)}
                    >
                      <td>
                        <div className="font-weight-medium">{item.threat.title}</div>
                      <div className="text-muted" style={{ fontSize: '0.92rem' }}>
                          {getThreatCategoryLabel(item.threat.category, 'Без категории')} |{' '}
                          {getThreatSubcategoryLabel(item.threat.subcategory)}
                        </div>
                      </td>
                      <td>
                        <span className={getRiskBadgeClass(item.level)}>
                          {getRiskLabel(item.level)}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span className={interpretation.groundingBadgeClass}>
                            {interpretation.groundingLabel}
                          </span>
                        </div>
                        <div className="text-muted mt-1" style={{ fontSize: '0.92rem' }}>
                          {interpretation.primaryReference
                            ? `${interpretation.primaryReference.reference_id} · ${interpretation.matchCount}`
                            : interpretation.isNovel
                              ? 'нет эталона'
                              : interpretation.groundingPercent}
                        </div>
                      </td>
                      <td style={{ minWidth: 220 }}>
                        <div className="mb-2 d-flex justify-content-between">
                          <span className="font-weight-medium">{formatRiskPercent(item.score)}</span>
                          <span className="text-muted" style={{ fontSize: '0.92rem' }}>
                            риск {item.score.toFixed(3)}
                          </span>
                        </div>
                        <ProgressBar
                          variant={getRiskProgressVariant(item.level)}
                          now={Number((item.score * 100).toFixed(1))}
                        />
                      </td>
                      <td>
                        {item.reasons.length ? (
                          item.reasons.map((reason, reasonIndex) => (
                            <div key={`${rowKey}-${reasonIndex}`} className="text-white mb-1" style={{ fontSize: '0.95rem' }}>
                              {reason}
                            </div>
                          ))
                        ) : (
                          <span className="text-white" style={{ fontSize: '0.95rem' }}>
                            Базовый риск сформирован по уровню опасности, экспозиции и зрелости защиты.
                          </span>
                        )}
                        <div className="text-white mt-2" style={{ fontSize: '0.95rem' }}>
                          {item.threat.interpretation_summary || 'Эталонная опора пока не сформирована.'}
                        </div>
                        <div className="text-white mt-1" style={{ fontSize: '0.92rem' }}>
                          Совпадений найдено: {interpretation.matchCount}
                        </div>
                      </td>
                      <td>
                        <div className="text-white" style={{ fontSize: '0.95rem' }}>
                          Интенсивность угрозы {formatRiskPercent(item.threatIntensity)}
                        </div>
                        <div className="text-white" style={{ fontSize: '0.95rem' }}>
                          Релевантность {formatRiskPercent(item.relevanceScore)}
                        </div>
                        <div className="text-white" style={{ fontSize: '0.95rem' }}>
                          Экспозиция {formatRiskPercent(item.exposureScore)}
                        </div>
                        <div className="text-white" style={{ fontSize: '0.95rem' }}>
                          Уязвимость защиты {formatRiskPercent(item.weaknessScore)}
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="text-white">
                        <td colSpan={6} className="bg-dark">
                          <div className="py-3 px-2">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                              <h5 className="mb-0 text-white">Детализация совпадений и риска</h5>
                              <span className={getRiskBadgeClass(item.level)}>
                                {getRiskLabel(item.level)} · {formatRiskPercent(item.score)}
                              </span>
                            </div>

                            <div className="row">
                              <div className="col-lg-4 mb-3">
                                <div className="border rounded p-3 h-100">
                                  <div className="text-muted mb-2" style={{ fontSize: '1rem' }}>Метрики матчинга</div>
                                  <div className="text-white mb-1" style={{ fontSize: '1rem' }}>Релевантность: {formatRiskPercent(item.relevanceScore)}</div>
                                  <div className="text-white mb-1" style={{ fontSize: '1rem' }}>Экспозиция: {formatRiskPercent(item.exposureScore)}</div>
                                  <div className="text-white mb-1" style={{ fontSize: '1rem' }}>Уязвимость защиты: {formatRiskPercent(item.weaknessScore)}</div>
                                  <div className="text-white" style={{ fontSize: '1rem' }}>Интенсивность угрозы: {formatRiskPercent(item.threatIntensity)}</div>
                                </div>
                              </div>
                              <div className="col-lg-8 mb-3">
                                <div className="border rounded p-3 h-100">
                                  <div className="text-muted mb-2" style={{ fontSize: '1rem' }}>Совпавшие уровни защиты</div>
                                  <div className="d-flex flex-wrap">
                                    {levels.length ? levels.map((level) => (
                                      <span key={`${rowKey}-${level}`} className="badge badge-outline-info mr-1 mb-1">
                                        {getLevelLabel(level)}
                                      </span>
                                    )) : <span className="text-muted" style={{ fontSize: '1rem' }}>Не определены</span>}
                                  </div>
                                  <div className="text-muted mt-3 mb-1" style={{ fontSize: '1rem' }}>Краткое обоснование</div>
                                  <div className="text-white" style={{ fontSize: '1rem' }}>
                                    {item.reasons.length
                                      ? item.reasons.join('; ')
                                      : 'Риск рассчитан на основе интенсивности угрозы, экспозиции объекта и совпадения профилей.'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="row">
                              <div className="col-lg-6 mb-3">
                                <div className="border rounded p-3 h-100">
                                  <div className="text-muted mb-2" style={{ fontSize: '1rem' }}>
                                    Endpoint/контроли в зоне риска ({item.controlMetrics?.exposedCount || 0}/{item.controlMetrics?.targetedCount || 0})
                                  </div>
                                  {(item.controlMetrics?.exposedControls || []).length ? (
                                    (item.controlMetrics.exposedControls || []).slice(0, 12).map((control) => (
                                      <div key={`${rowKey}-exp-${control}`} className="text-white mb-1" style={{ fontSize: '1rem' }}>
                                        <span className="text-danger mr-1">●</span>
                                        {humanizeControlKey(control)}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-muted" style={{ fontSize: '1rem' }}>Явных уязвимых контролов не найдено.</div>
                                  )}
                                </div>
                              </div>
                              <div className="col-lg-6 mb-3">
                                <div className="border rounded p-3 h-100">
                                  <div className="text-muted mb-2" style={{ fontSize: '1rem' }}>Закрытые совпадающие контроли</div>
                                  {(item.controlMetrics?.mitigatedControls || []).length ? (
                                    (item.controlMetrics.mitigatedControls || []).slice(0, 12).map((control) => (
                                      <div key={`${rowKey}-mit-${control}`} className="text-white mb-1" style={{ fontSize: '1rem' }}>
                                        <span className="text-success mr-1">●</span>
                                        {humanizeControlKey(control)}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-muted" style={{ fontSize: '1rem' }}>Закрывающих контролов по этой угрозе пока нет.</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="row">
                              <div className="col-lg-4 mb-2">
                                <div className="text-muted mb-1" style={{ fontSize: '1rem' }}>CVE и индикаторы</div>
                                <div className="text-white" style={{ fontSize: '1rem' }}>
                                  {cves.slice(0, 6).join(', ') || 'CVE не обнаружены'}
                                </div>
                              </div>
                              <div className="col-lg-4 mb-2">
                                <div className="text-muted mb-1" style={{ fontSize: '1rem' }}>Вендоры/продукты</div>
                                <div className="text-white" style={{ fontSize: '1rem' }}>
                                  {[...vendors.slice(0, 4), ...products.slice(0, 4)].join(', ') || 'Нет явных совпадений'}
                                </div>
                              </div>
                              <div className="col-lg-4 mb-2">
                                <div className="text-muted mb-1" style={{ fontSize: '1rem' }}>Сигнальные термины</div>
                                <div className="text-white" style={{ fontSize: '1rem' }}>
                                  {(item.matchedSignalTerms || []).slice(0, 8).join(', ') || 'Нет совпавших терминов'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  render() {
    const { threatItems, objectItems, isLoading, error, selectedObjectId } = this.state;
    const selectedObject =
      objectItems.find((item) => item._id === selectedObjectId) || objectItems[0] || null;
    const matches = buildObjectThreatMatches(selectedObject, threatItems);

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Матрица сопоставления</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Реестр угроз
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Матрица сопоставления
              </li>
            </ol>
          </nav>
        </div>

        <div className="row mb-4">
          <div className="col-md-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-9">
                    <h6 className="mb-2 text-white h5">Профили угроз</h6>
                    <h3 className="mb-0">{threatItems.length}</h3>
                  </div>
                  <div className="col-3">
                    <div className="icon icon-box-danger">
                      <span className="mdi mdi-shield-alert icon-item"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-9">
                    <h6 className="mb-2 text-white h5">Модели объектов</h6>
                    <h3 className="mb-0">{objectItems.length}</h3>
                  </div>
                  <div className="col-3">
                    <div className="icon icon-box-info">
                      <span className="mdi mdi-domain icon-item"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-9">
                    <h6 className="mb-2 text-white h5">Высокий риск для выбранного объекта</h6>
                    <h3 className="mb-0">
                      {selectedObject ? summarizeObjectRisk(matches).highCount : 0}
                    </h3>
                  </div>
                  <div className="col-3">
                    <div className="icon icon-box-warning">
                      <span className="mdi mdi-alert-circle icon-item"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="card">
            <div className="card-body">
              <div className="text-muted">Загружаем угрозы, объекты и строим матрицу сопоставления...</div>
            </div>
          </div>
        ) : (
          <div className="row">
            <div className="col-lg-7 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h4 className="card-title">Текущие профили угроз</h4>
                  {this.renderThreatProfiles(threatItems)}
                </div>
              </div>
            </div>

            <div className="col-lg-5 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h4 className="card-title">Текущие профили объектов</h4>
                  {this.renderObjectList(objectItems, selectedObjectId, threatItems)}
                </div>
              </div>
            </div>


            <div className="col-lg-12 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  {this.renderAnalysis(selectedObject, matches)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default BasicTable;
