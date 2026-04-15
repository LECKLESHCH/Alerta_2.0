import React, { Component } from 'react';
import { ProgressBar } from 'react-bootstrap';
import { fetchArticles } from '../../api/articles';
import { fetchObjects } from '../../api/objects';
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

function EmptyState({ text }) {
  return (
    <div className="border rounded px-4 py-5 text-center text-muted">
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
  };

  componentDidMount() {
    this.loadMatrixData();
  }

  async fetchAllThreats() {
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
    this.setState({ selectedObjectId: objectId });
  };

  renderThreatProfiles(threatItems) {
    if (!threatItems.length) {
      return <EmptyState text="После загрузки угроз из сбора здесь появится актуальный реестр профилей." />;
    }

    return (
      <div className="table-responsive">
        <table className="table table-hover text-white">
          <thead>
            <tr>
              <th>Профиль угрозы</th>
              <th>Категория</th>
              <th>Интерпретация</th>
              <th>Severity</th>
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
                    <div className="text-muted small">
                      {getThreatSubcategoryLabel(item.subcategory)}
                    </div>
                  </td>
                  <td>{getThreatCategoryLabel(item.category, 'Без категории')}</td>
                  <td>
                    <div>
                      <span className={interpretation.groundingBadgeClass}>
                        {interpretation.groundingLabel}
                      </span>
                    </div>
                    <div className="text-muted small mt-1">
                      {interpretation.primaryReference
                        ? `${interpretation.primaryReference.reference_id} · ${interpretation.matchCount}`
                        : interpretation.isNovel
                          ? 'нет эталона'
                          : interpretation.groundingPercent}
                    </div>
                  </td>
                  <td>
                    <span className={getSeverityBadgeClass(item.severity)}>
                      {item.severity || 'n/a'}
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
        <table className="table table-hover text-white">
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
                    <div className="text-muted small">{item.region || item.industry}</div>
                  </td>
                  <td>
                    <div>{item.objectType}</div>
                    <div className="text-muted small">
                      {item.criticalityClass} | {item.industry}
                    </div>
                  </td>
                  <td>
                    <span className="d-block">high: {summary.highCount}</span>
                    <span className="text-muted small">
                      avg: {formatRiskPercent(summary.averageScore)}
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
            <h4 className="card-title mb-2">
              Анализ для объекта {selectedObject.objectName}
            </h4>
            <p className="card-description mb-0">
              Риски считаются на лету при открытии вкладки и не сохраняются в БД.
            </p>
          </div>
          <div className="d-flex flex-wrap">
            <div className="mr-4 mb-2">
              <div className="text-muted small">Высокий риск</div>
              <div className="h4 mb-0">{summary.highCount}</div>
            </div>
            <div className="mr-4 mb-2">
              <div className="text-muted small">Средний риск</div>
              <div className="h4 mb-0">{summary.mediumCount}</div>
            </div>
            <div className="mb-2">
              <div className="text-muted small">Средний индекс</div>
              <div className="h4 mb-0">{formatRiskPercent(summary.averageScore)}</div>
            </div>
          </div>
        </div>

        <div className="border rounded p-3 mb-4">
          <div className="row">
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="text-muted small">Тип объекта</div>
              <div>{selectedObject.objectType}</div>
            </div>
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="text-muted small">Класс значимости</div>
              <div>{selectedObject.criticalityClass}</div>
            </div>
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="text-muted small">Отрасль</div>
              <div>{selectedObject.industry}</div>
            </div>
            <div className="col-md-3">
              <div className="text-muted small">Критичность бизнеса</div>
              <div>{formatScore(selectedObject.businessCriticality)}</div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-striped text-white">
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
              {matches.slice(0, 12).map((item) => {
                const interpretation = buildInterpretationMeta(item.threat);

                return (
                  <tr key={item.threat._id || item.threat.url} className="text-white">
                    <td>
                      <div className="font-weight-medium">{item.threat.title}</div>
                      <div className="text-muted small">
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
                      <div className="text-muted small mt-1">
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
                        <span className="text-muted small">
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
                        item.reasons.map((reason, index) => (
                          <div key={`${item.threat._id || item.threat.url}-${index}`} className="text-muted small mb-1">
                            {reason}
                          </div>
                        ))
                      ) : (
                        <span className="text-muted small">
                          Базовый риск сформирован по severity, экспозиции и зрелости защиты.
                        </span>
                      )}
                      <div className="text-muted small mt-2">
                        {item.threat.interpretation_summary || 'Эталонная опора пока не сформирована.'}
                      </div>
                      <div className="text-muted small mt-1">
                        Совпадений найдено: {interpretation.matchCount}
                      </div>
                    </td>
                    <td>
                      <div className="text-muted small">
                        threat {formatRiskPercent(item.threatIntensity)}
                      </div>
                      <div className="text-muted small">
                        relevance {formatRiskPercent(item.relevanceScore)}
                      </div>
                      <div className="text-muted small">
                        exposure {formatRiskPercent(item.exposureScore)}
                      </div>
                      <div className="text-muted small">
                        weakness {formatRiskPercent(item.weaknessScore)}
                      </div>
                    </td>
                  </tr>
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
                <h6 className="text-muted mb-2">Профили угроз</h6>
                <h3 className="mb-0">{threatItems.length}</h3>
                <p className="text-muted mb-0">
                  Текущие threat-записи из базы после сбора и нормализации.
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h6 className="text-muted mb-2">Модели объектов</h6>
                <h3 className="mb-0">{objectItems.length}</h3>
                <p className="text-muted mb-0">
                  Доступные паспорта КИИ для расчёта сопоставления.
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h6 className="text-muted mb-2">Высокий риск для выбранного объекта</h6>
                <h3 className="mb-0">
                  {selectedObject ? summarizeObjectRisk(matches).highCount : 0}
                </h3>
                <p className="text-muted mb-0">
                  На лету по формуле severity + fit + экспозиция + критичность.
                </p>
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
            <div className="col-lg-6 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h4 className="card-title">Текущие профили угроз</h4>
                  <p className="card-description">
                    Поток статей, уже преобразованных в структурированные угрозы.
                  </p>
                  {this.renderThreatProfiles(threatItems)}
                </div>
              </div>
            </div>

            <div className="col-lg-6 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h4 className="card-title">Совпадение угроз с объектами</h4>
                  <p className="card-description">
                    Выбери модель объекта, чтобы ниже увидеть релевантные угрозы и уровень риска.
                  </p>
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
