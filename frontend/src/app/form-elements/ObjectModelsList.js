import React, { Component } from 'react';
import { Modal } from 'react-bootstrap';
import {
  deleteObjectPassport,
  fetchObjects,
  updateObjectPassport,
} from '../../api/objects';

const PROTECTION_LABELS = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const DEPTH_SECTIONS = [
  {
    key: 'physical',
    title: '1. Физический уровень',
    controls: [
      ['securityGuard', 'Наличие охраны'],
      ['checkpoint', 'Наличие КПП'],
      ['cctv', 'Видеонаблюдение'],
      ['visitorLog', 'Журнал посещений'],
      ['contractorControl', 'Контроль подрядчиков'],
      ['serverRoomProtection', 'Охрана серверных помещений'],
      ['accessCards', 'Электронные пропуска'],
      ['biometrics', 'Биометрия'],
      ['zoneSeparation', 'Разграничение зон доступа'],
      ['keyStorageControl', 'Контроль хранения ключей'],
      ['lockedRacks', 'Закрытые стойки'],
      ['temperatureSensors', 'Датчики температуры'],
      ['fireSuppression', 'Пожаротушение'],
      ['backupPower', 'Резервное питание'],
      ['upsGenerators', 'UPS/генераторы'],
    ],
  },
  {
    key: 'perimeter',
    title: '2. Периметровая защита',
    controls: [
      ['firewall', 'Firewall'],
      ['dmz', 'DMZ'],
      ['nat', 'NAT'],
      ['proxy', 'Прокси'],
      ['vpn', 'VPN'],
      ['publishedPortsControl', 'Контроль опубликованных портов'],
      ['remoteAccessControl', 'Контроль удаленного доступа'],
      ['webServicesProtection', 'Защита веб-сервисов'],
      ['mailGatewayProtection', 'Защита почтовых шлюзов'],
      ['idsIps', 'IDS/IPS'],
      ['anomalyDetection', 'Анализ аномалий'],
    ],
    details: [
      ['firewallDetails', 'Firewall: оборудование/ПО'],
      ['vpnDetails', 'VPN: уточнение'],
      ['idsIpsDetails', 'IDS/IPS: уточнение'],
    ],
  },
  {
    key: 'network',
    title: '3. Сетевой уровень',
    controls: [
      ['vlan', 'VLAN'],
      ['segmentation', 'Сегментация'],
      ['criticalSegmentIsolation', 'Изоляция критических сегментов'],
      ['acl', 'ACL'],
      ['routingControl', 'Контроль маршрутизации'],
      ['switchProtection', 'Защищенность коммутаторов'],
      ['netflow', 'NetFlow'],
      ['trafficAnalysis', 'Анализ трафика'],
      ['anomalyMonitoring', 'Мониторинг аномалий'],
    ],
    details: [['networkEquipment', 'Сетевое оборудование']],
  },
  {
    key: 'endpoints',
    title: '4. Уровень конечных устройств',
    controls: [
      ['antivirus', 'Антивирус'],
      ['edrXdr', 'EDR/XDR'],
      ['osUpdates', 'Обновления ОС'],
      ['softwareControl', 'Контроль ПО'],
      ['hardening', 'Hardening серверов'],
      ['disableUnusedServices', 'Отключение ненужных служб'],
      ['patchManagement', 'Управление патчами'],
      ['mdm', 'MDM'],
      ['diskEncryption', 'Шифрование'],
      ['remoteWipe', 'Удаленное стирание'],
      ['usbControl', 'Контроль USB'],
    ],
    details: [['edrXdrDetails', 'EDR/XDR: уточнение']],
  },
  {
    key: 'applications',
    title: '5. Уровень приложений',
    controls: [
      ['waf', 'WAF'],
      ['owaspControls', 'Защита от OWASP Top 10'],
      ['inputValidation', 'Проверка входных данных'],
      ['secureSdlc', 'Secure SDLC'],
      ['codeReview', 'Code review'],
      ['sastDast', 'SAST/DAST'],
      ['pentest', 'Pentest'],
      ['vulnerabilityScanning', 'Vulnerability scanning'],
      ['remediationSla', 'Сроки устранения уязвимостей'],
    ],
    details: [['appSecurityStack', 'Стек защиты приложений']],
  },
  {
    key: 'iam',
    title: '6. Уровень идентификации и доступа (IAM)',
    controls: [
      ['mfa', 'MFA'],
      ['passwordPolicy', 'Политика паролей'],
      ['sso', 'SSO'],
      ['rbac', 'RBAC'],
      ['leastPrivilege', 'Минимальные привилегии'],
      ['segregationOfDuties', 'Segregation of duties'],
      ['userLifecycle', 'Жизненный цикл пользователей'],
      ['terminatedUserDisable', 'Отключение уволенных сотрудников'],
      ['serviceAccountControl', 'Контроль сервисных аккаунтов'],
    ],
    details: [['iamSystem', 'IAM-система']],
  },
  {
    key: 'data',
    title: '7. Уровень данных',
    controls: [
      ['storageEncryption', 'Шифрование хранения данных'],
      ['backup', 'Резервное копирование'],
      ['dataAccessControl', 'Контроль доступа к данным'],
      ['tls', 'TLS'],
      ['protectedChannels', 'Защищенные каналы передачи'],
      ['dataClassification', 'Классификация данных'],
      ['personalDataHandling', 'Контроль персональных данных'],
      ['tradeSecretHandling', 'Контроль коммерческой тайны'],
    ],
    details: [['backupStorageLocation', 'Хранение резервных копий']],
  },
  {
    key: 'monitoringResponse',
    title: '8. Мониторинг и реагирование',
    controls: [
      ['centralizedLogs', 'Централизованный сбор логов'],
      ['siem', 'SIEM'],
      ['eventCorrelation', 'Корреляция событий'],
      ['irProcedures', 'IR-процедуры'],
      ['playbooks', 'Playbooks'],
      ['soc', 'SOC'],
      ['threatIntel', 'Threat Intelligence'],
      ['incidentInvestigation', 'Расследование инцидентов'],
      ['retrospectiveAnalysis', 'Ретроспективный анализ'],
    ],
    details: [['siemDetails', 'SIEM: уточнение']],
  },
  {
    key: 'governance',
    title: '9. Организационный уровень',
    controls: [
      ['securityPolicies', 'Политики ИБ'],
      ['regulations', 'Регламенты'],
      ['standards', 'Стандарты'],
      ['awarenessTraining', 'Awareness training'],
      ['phishingSimulations', 'Phishing simulations'],
      ['riskAssessment', 'Risk assessment'],
      ['compliance', 'Compliance'],
      ['contractorAudit', 'Аудит подрядчиков'],
    ],
  },
];

function getControlValue(item, sectionKey, key) {
  const section = item?.depth?.[sectionKey];
  if (!section || typeof section !== 'object') {
    return false;
  }
  if (typeof section[key] === 'boolean') {
    return section[key];
  }
  if (section.controls && typeof section.controls[key] === 'boolean') {
    return section.controls[key];
  }
  return false;
}

function getDetailValue(item, sectionKey, key) {
  const section = item?.depth?.[sectionKey];
  if (!section || typeof section !== 'object') {
    return '';
  }
  const value = section[key];
  return typeof value === 'string' ? value.trim() : '';
}

function buildEditableDepth(item) {
  const depth = {};
  DEPTH_SECTIONS.forEach((section) => {
    const nextSection = {};
    section.controls.forEach(([key]) => {
      nextSection[key] = getControlValue(item, section.key, key);
    });
    (section.details || []).forEach(([key]) => {
      nextSection[key] = getDetailValue(item, section.key, key);
    });
    depth[section.key] = nextSection;
  });
  return depth;
}

function formatDate(value) {
  if (!value) return 'Черновик';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Черновик';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EmptyState() {
  return (
    <div className="border rounded px-4 py-5 text-center text-muted">
      Список моделей пока пуст. Добавь паспорт КИИ, и он появится здесь.
    </div>
  );
}

class ObjectModelsList extends Component {
  state = {
    items: [],
    isLoading: true,
    error: '',
    search: '',
    typeFilter: 'all',
    industryFilter: 'all',
    sortOrder: 'newest',
    deletingId: '',
    expandedId: '',
    isEditOpen: false,
    editingId: '',
    editForm: {
      objectName: '',
      objectType: '',
      industry: '',
      subIndustry: '',
      region: '',
      ownerUnit: '',
      protectionLevel: 'medium',
      comments: '',
      depth: {},
    },
    savingEdit: false,
  };

  componentDidMount() {
    this.loadObjects();
  }

  async loadObjects() {
    this.setState({ isLoading: true, error: '' });
    try {
      const response = await fetchObjects();
      this.setState({ items: Array.isArray(response) ? response : [], isLoading: false });
    } catch (error) {
      this.setState({
        items: [],
        isLoading: false,
        error: error.message || 'Не удалось загрузить список моделей объекта.',
      });
    }
  }

  handleFilterChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value });
  };

  handleEditChange = (event) => {
    const { name, value } = event.target;
    this.setState((prev) => ({
      editForm: {
        ...prev.editForm,
        [name]: value,
      },
    }));
  };

  handleDepthControlChange = (sectionKey, key, checked) => {
    this.setState((prev) => ({
      editForm: {
        ...prev.editForm,
        depth: {
          ...prev.editForm.depth,
          [sectionKey]: {
            ...(prev.editForm.depth[sectionKey] || {}),
            [key]: checked,
          },
        },
      },
    }));
  };

  handleDepthDetailChange = (sectionKey, key, value) => {
    this.setState((prev) => ({
      editForm: {
        ...prev.editForm,
        depth: {
          ...prev.editForm.depth,
          [sectionKey]: {
            ...(prev.editForm.depth[sectionKey] || {}),
            [key]: value,
          },
        },
      },
    }));
  };

  toggleExpand = (id) => {
    this.setState((prev) => ({ expandedId: prev.expandedId === id ? '' : id }));
  };

  openEdit = (item) => {
    this.setState({
      isEditOpen: true,
      editingId: item._id,
      editForm: {
        objectName: item.objectName || '',
        objectType: item.objectType || '',
        industry: item.industry || '',
        subIndustry: item.subIndustry || '',
        region: item.region || '',
        ownerUnit: item.ownerUnit || '',
        protectionLevel: item.protectionLevel || 'medium',
        comments: item.comments || '',
        depth: buildEditableDepth(item),
      },
    });
  };

  closeEdit = () => {
    this.setState({ isEditOpen: false, editingId: '', savingEdit: false });
  };

  saveEdit = async () => {
    const { editingId, editForm } = this.state;
    const normalizedDepth = {};
    DEPTH_SECTIONS.forEach((section) => {
      const values = editForm.depth?.[section.key] || {};
      const controls = {};
      section.controls.forEach(([key]) => {
        controls[key] = Boolean(values[key]);
      });
      const sectionPayload = { controls };
      (section.details || []).forEach(([key]) => {
        sectionPayload[key] = typeof values[key] === 'string' ? values[key] : '';
      });
      normalizedDepth[section.key] = sectionPayload;
    });

    this.setState({ savingEdit: true, error: '' });
    try {
      await updateObjectPassport(editingId, {
        objectName: editForm.objectName,
        objectType: editForm.objectType,
        industry: editForm.industry,
        subIndustry: editForm.subIndustry,
        region: editForm.region,
        ownerUnit: editForm.ownerUnit,
        protectionLevel: editForm.protectionLevel,
        comments: editForm.comments,
        depth: normalizedDepth,
      });
      await this.loadObjects();
      this.closeEdit();
    } catch (error) {
      this.setState({
        savingEdit: false,
        error: error.message || 'Не удалось сохранить изменения модели.',
      });
    }
  };

  handleDelete = async (item) => {
    if (!window.confirm(`Удалить модель "${item.objectName}"?`)) return;
    this.setState({ deletingId: item._id, error: '' });
    try {
      await deleteObjectPassport(item._id);
      this.setState((prev) => ({
        items: prev.items.filter((current) => current._id !== item._id),
        deletingId: '',
      }));
    } catch (error) {
      this.setState({
        deletingId: '',
        error: error.message || 'Не удалось удалить модель объекта.',
      });
    }
  };

  getFilteredItems() {
    const { items, search, typeFilter, industryFilter, sortOrder } = this.state;
    const q = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const searchSpace = [
        item.objectName,
        item.objectType,
        item.industry,
        item.subIndustry,
        item.region,
        item.ownerUnit,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        (!q || searchSpace.includes(q)) &&
        (typeFilter === 'all' || item.objectType === typeFilter) &&
        (industryFilter === 'all' || item.industry === industryFilter)
      );
    });
    return filtered.sort((a, b) => {
      const left = new Date(a.createdAt || 0).getTime();
      const right = new Date(b.createdAt || 0).getTime();
      return sortOrder === 'oldest' ? left - right : right - left;
    });
  }

  renderExpanded(item) {
    return (
      <div className="pt-2">
        <div className="row">
          {DEPTH_SECTIONS.map((section) => (
            <div className="col-xl-4 col-md-6 mb-3" key={section.key}>
              <div className="border rounded h-100 p-3">
                <div className="font-weight-bold mb-2">{section.title}</div>
                {section.controls.map(([key, label]) => (
                  <div className="d-flex justify-content-between small mb-1" key={key}>
                    <span>{label}</span>
                    <span className={getControlValue(item, section.key, key) ? 'text-success' : 'text-muted'}>
                      {getControlValue(item, section.key, key) ? 'Да' : 'Нет'}
                    </span>
                  </div>
                ))}
                {(section.details || []).map(([key, label]) => {
                  const value = getDetailValue(item, section.key, key);
                  if (!value) return null;
                  return (
                    <div className="small mt-2" key={key}>
                      <div className="text-muted">{label}</div>
                      <div className="text-white">{value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  render() {
    const {
      items,
      isLoading,
      error,
      search,
      typeFilter,
      industryFilter,
      sortOrder,
      deletingId,
      expandedId,
      isEditOpen,
      editForm,
      savingEdit,
    } = this.state;

    const filteredItems = this.getFilteredItems();
    const typeOptions = Array.from(new Set(items.map((item) => item.objectType).filter(Boolean)));
    const industryOptions = Array.from(new Set(items.map((item) => item.industry).filter(Boolean)));

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Список моделей</h3>
        </div>

        <div className="card">
          <div className="card-body">
            <h4 className="card-title">Модели объектов</h4>
            <div className="border rounded px-3 px-xl-4 py-3 mb-4">
              <div className="row">
                <div className="col-12 col-xl-4 mb-3">
                  <label className="mb-2 text-muted small d-block">Поиск по модели</label>
                  <input type="text" className="form-control" name="search" value={search} onChange={this.handleFilterChange} />
                </div>
                <div className="col-12 col-md-6 col-xl-3 mb-3">
                  <label className="mb-2 text-muted small d-block">Тип объекта</label>
                  <select className="form-control" name="typeFilter" value={typeFilter} onChange={this.handleFilterChange}>
                    <option value="all">Все типы</option>
                    {typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="col-12 col-md-6 col-xl-3 mb-3">
                  <label className="mb-2 text-muted small d-block">Отрасль</label>
                  <select className="form-control" name="industryFilter" value={industryFilter} onChange={this.handleFilterChange}>
                    <option value="all">Все отрасли</option>
                    {industryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="col-12 col-xl-2 mb-3">
                  <label className="mb-2 text-muted small d-block">Сортировка</label>
                  <select className="form-control" name="sortOrder" value={sortOrder} onChange={this.handleFilterChange}>
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="text-muted">{isLoading ? 'Загружаем модели...' : `Найдено моделей: ${filteredItems.length}`}</div>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={() => this.loadObjects()}>Обновить</button>
            </div>

            {error ? <div className="alert alert-warning">{error}</div> : null}

            {isLoading ? (
              <div className="text-muted">Загрузка списка моделей...</div>
            ) : filteredItems.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="table-responsive">
                <table className="table text-white">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}></th>
                      <th>Модель</th>
                      <th>Тип</th>
                      <th>Отрасль</th>
                      <th>Регион</th>
                      <th>Уровень защиты</th>
                      <th>Обновлено</th>
                      <th className="text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <React.Fragment key={item._id}>
                        <tr className="text-white">
                          <td>
                            <button type="button" className="btn btn-outline-light btn-sm px-2 py-1" onClick={() => this.toggleExpand(item._id)}>
                              <i className={`mdi ${expandedId === item._id ? 'mdi-chevron-up' : 'mdi-chevron-down'}`}></i>
                            </button>
                          </td>
                          <td>
                            <div className="font-weight-bold">{item.objectName}</div>
                            <div className="text-muted small">{item.subIndustry || 'Подотрасль не указана'}</div>
                          </td>
                          <td>{item.objectType}</td>
                          <td>{item.industry}</td>
                          <td>{item.region || 'Не указан'}</td>
                          <td>{PROTECTION_LABELS[item.protectionLevel] || 'Средний'}</td>
                          <td>{formatDate(item.updatedAt || item.createdAt)}</td>
                          <td className="text-right">
                            <button type="button" className="btn btn-outline-info btn-sm mr-2" onClick={() => this.openEdit(item)}>Редактировать</button>
                            <button type="button" className="btn btn-outline-danger btn-sm" disabled={deletingId === item._id} onClick={() => this.handleDelete(item)}>
                              {deletingId === item._id ? 'Удаляем...' : 'Удалить'}
                            </button>
                          </td>
                        </tr>
                        {expandedId === item._id && (
                          <tr>
                            <td colSpan={8}>{this.renderExpanded(item)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <Modal show={isEditOpen} onHide={this.closeEdit} dialogClassName="modal-xl" centered>
          <Modal.Header className="bg-dark border-secondary text-light">
            <Modal.Title>Редактирование модели объекта</Modal.Title>
            <button type="button" className="close text-light ml-auto" onClick={this.closeEdit}><span>&times;</span></button>
          </Modal.Header>
          <Modal.Body className="bg-dark text-light">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label>Наименование объекта</label>
                <input className="form-control" name="objectName" value={editForm.objectName} onChange={this.handleEditChange} />
              </div>
              <div className="col-md-6 mb-3">
                <label>Тип объекта</label>
                <input className="form-control" name="objectType" value={editForm.objectType} onChange={this.handleEditChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label>Отрасль</label>
                <input className="form-control" name="industry" value={editForm.industry} onChange={this.handleEditChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label>Подотрасль</label>
                <input className="form-control" name="subIndustry" value={editForm.subIndustry} onChange={this.handleEditChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label>Уровень защиты</label>
                <select className="form-control" name="protectionLevel" value={editForm.protectionLevel} onChange={this.handleEditChange}>
                  <option value="high">Высокий</option>
                  <option value="medium">Средний</option>
                  <option value="low">Низкий</option>
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label>Регион</label>
                <input className="form-control" name="region" value={editForm.region} onChange={this.handleEditChange} />
              </div>
              <div className="col-md-6 mb-3">
                <label>Подразделение</label>
                <input className="form-control" name="ownerUnit" value={editForm.ownerUnit} onChange={this.handleEditChange} />
              </div>
              <div className="col-12 mb-3">
                <label>Комментарии</label>
                <textarea className="form-control" rows={3} name="comments" value={editForm.comments} onChange={this.handleEditChange} />
              </div>
              <div className="col-12">
                <label className="mb-2">Уровни эшелонированной защиты</label>
                <div className="row">
                  {DEPTH_SECTIONS.map((section) => (
                    <div className="col-xl-4 col-md-6 mb-3" key={`edit-${section.key}`}>
                      <div className="border rounded p-3 h-100">
                        <div className="font-weight-bold mb-2">{section.title}</div>
                        {section.controls.map(([key, label]) => (
                          <div className="form-check mb-1" key={`edit-${section.key}-${key}`}>
                            <label className="form-check-label text-white">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={Boolean(editForm.depth?.[section.key]?.[key])}
                                onChange={(event) =>
                                  this.handleDepthControlChange(
                                    section.key,
                                    key,
                                    event.target.checked,
                                  )
                                }
                              />
                              {label}
                              <i className="input-helper"></i>
                            </label>
                          </div>
                        ))}
                        {(section.details || []).map(([key, label]) => (
                          <div className="mt-2" key={`edit-${section.key}-${key}-detail`}>
                            <label className="small text-muted mb-1 d-block">{label}</label>
                            <input
                              type="text"
                              className="form-control"
                              value={editForm.depth?.[section.key]?.[key] || ''}
                              onChange={(event) =>
                                this.handleDepthDetailChange(
                                  section.key,
                                  key,
                                  event.target.value,
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="bg-dark border-secondary">
            <button type="button" className="btn btn-outline-light" onClick={this.closeEdit}>Отмена</button>
            <button type="button" className="btn btn-primary" onClick={this.saveEdit} disabled={savingEdit}>
              {savingEdit ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default ObjectModelsList;
