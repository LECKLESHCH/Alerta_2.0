import React, { Component } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { VectorMap } from 'react-jvectormap';
import { API_ENDPOINTS } from '../../api/endpoints';
import { fetchArticles } from '../../api/articles';
import { getThreatCategoryLabel } from '../../utils/threatLabels';
const SEVERITY_SCORES = {
  critical: 1,
  high: 0.8,
  medium: 0.5,
  low: 0.2,
};
const COUNTRY_CODE_MAP = {
  russia: 'RU',
  россия: 'RU',
  russian: 'RU',
  usa: 'US',
  us: 'US',
  'united states': 'US',
  сша: 'US',
  germany: 'DE',
  германия: 'DE',
  china: 'CN',
  китай: 'CN',
  india: 'IN',
  индия: 'IN',
  ukraine: 'UA',
  украина: 'UA',
  iran: 'IR',
  иран: 'IR',
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  великобритания: 'GB',
};
const COUNTRY_LABELS = {
  RU: 'Россия',
  US: 'США',
  DE: 'Германия',
  CN: 'Китай',
  IN: 'Индия',
  UA: 'Украина',
  IR: 'Иран',
  GB: 'Великобритания',
};

function normalizeCountry(country) {
  if (!country) {
    return null;
  }

  const normalized = String(country).trim().toLowerCase();
  return COUNTRY_CODE_MAP[normalized] || null;
}

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatScore(value) {
  return value.toFixed(2);
}

function formatDate(value) {
  if (!value) {
    return 'Нет даты';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Нет даты';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatRelativeTime(value) {
  if (!value) {
    return 'без времени';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'без времени';
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
}

function getSeverityBadgeClass(severity) {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'badge-outline-danger';
    case 'medium':
      return 'badge-outline-warning';
    case 'low':
      return 'badge-outline-success';
    default:
      return 'badge-outline-info';
  }
}

function getTypeIconClass(type) {
  return type === 'threat' ? 'bg-danger' : 'bg-info';
}

function getStatusLabel(article) {
  if (article.type === 'threat' && (article.severity === 'critical' || article.severity === 'high')) {
    return 'Приоритет';
  }

  if (article.type === 'threat') {
    return 'Наблюдение';
  }

  return 'Новость';
}

function collectTopGroups(items, field, limit) {
  const groups = items.reduce((accumulator, item) => {
    const key = item[field] || 'Не указано';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(groups)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function buildDashboardData(articles) {
  const sortedArticles = [...articles].sort((left, right) => {
    const leftDate = new Date(left.publishedAt || left.extracted_at || 0).getTime();
    const rightDate = new Date(right.publishedAt || right.extracted_at || 0).getTime();
    return rightDate - leftDate;
  });

  const threats = sortedArticles.filter((article) => article.type === 'threat');
  const news = sortedArticles.filter((article) => article.type === 'news');
  const now = Date.now();
  const last24Hours = sortedArticles.filter((article) => {
    const timestamp = new Date(article.publishedAt || article.extracted_at || 0).getTime();
    return Number.isFinite(timestamp) && now - timestamp <= 24 * 60 * 60 * 1000;
  });
  const avgConfidence = average(threats.map((article) => safeNumber(article.llm_confidence)));
  const avgImpact = average(
    threats.map((article) =>
      average([
        safeNumber(article.impact_confidentiality),
        safeNumber(article.impact_integrity),
        safeNumber(article.impact_availability),
      ]),
    ),
  );
  const riskScore = average(
    threats.map((article) => {
      const severityScore = SEVERITY_SCORES[article.severity] || 0;
      const confidence = safeNumber(article.llm_confidence);
      const activeExploitation = safeNumber(article.active_exploitation);
      return average([severityScore, confidence, activeExploitation]);
    }),
  );
  const highSeverityRatio = threats.length
    ? threats.filter((article) => article.severity === 'high' || article.severity === 'critical').length /
      threats.length
    : 0;
  const topCategories = collectTopGroups(threats, 'category', 3).map((item) => ({
    ...item,
    label: getThreatCategoryLabel(item.label, 'Не указана'),
  }));
  const topSources = collectTopGroups(sortedArticles, 'source', 5);

  const geographyGroups = threats.reduce((accumulator, article) => {
    const code = normalizeCountry(article.country);
    if (!code) {
      return accumulator;
    }

    if (!accumulator[code]) {
      accumulator[code] = { count: 0, impactValues: [] };
    }

    accumulator[code].count += 1;
    accumulator[code].impactValues.push(
      average([
        safeNumber(article.impact_confidentiality),
        safeNumber(article.impact_integrity),
        safeNumber(article.impact_availability),
      ]),
    );
    return accumulator;
  }, {});

  const geographyRows = Object.entries(geographyGroups)
    .map(([code, metrics]) => ({
      code,
      label: COUNTRY_LABELS[code] || code,
      count: metrics.count,
      avgImpact: average(metrics.impactValues),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

  const mapData = geographyRows.reduce((accumulator, row) => {
    accumulator[row.code] = row.count;
    return accumulator;
  }, {});

  return {
    sortedArticles,
    threats,
    news,
    last24Hours,
    avgConfidence,
    avgImpact,
    riskScore,
    highSeverityRatio,
    topCategories,
    topSources,
    geographyRows,
    mapData,
  };
}

export class Dashboard extends Component {
  state = {
    articles: [],
    loading: true,
    error: null,
  };

  transactionHistoryOptions = {
    responsive: true,
    maintainAspectRatio: true,
    segmentShowStroke: false,
    cutoutPercentage: 70,
    elements: {
      arc: {
        borderWidth: 0,
      },
    },
    legend: {
      display: false,
    },
    tooltips: {
      enabled: true,
    },
  };

  componentDidMount() {
    this.loadArticles();
  }

  async loadArticles() {
    try {
      const { items: articles } = await fetchArticles({
        page: 1,
        limit: 200,
        includeText: 0,
      });
      this.setState({ articles, loading: false, error: null });
    } catch (error) {
      this.setState({
        loading: false,
        error: `Не удалось получить данные из backend (${API_ENDPOINTS.articles()}).`,
      });
    }
  }

  renderEmptyState(message) {
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title">Данные мониторинга</h4>
          <p className="text-muted mb-0">{message}</p>
        </div>
      </div>
    );
  }

  render() {
    const { articles, loading, error } = this.state;

    if (loading) {
      return this.renderEmptyState('Загружаю публикации и метрики из backend...');
    }

    if (error) {
      return this.renderEmptyState(error);
    }

    if (!articles.length) {
      return this.renderEmptyState('Backend отвечает, но в базе пока нет статей. Сначала запустите краулер.');
    }

    const {
      sortedArticles,
      threats,
      news,
      last24Hours,
      avgConfidence,
      avgImpact,
      riskScore,
      highSeverityRatio,
      topCategories,
      topSources,
      geographyRows,
      mapData,
    } = buildDashboardData(articles);

    const categoryChartData = {
      labels: topCategories.map((item) => item.label),
      datasets: [
        {
          data: topCategories.map((item) => item.count),
          backgroundColor: ['#ffab00', '#00d25b', '#fc424a'],
        },
      ],
    };

    const latestArticles = sortedArticles.slice(0, 5);
    const recentThreats = threats.slice(0, 5);

    return (
      <div>
        <div className="row">
          <div className="col-xl-3 col-sm-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-9">
                    <div className="d-flex align-items-center align-self-start">
                      <h3 className="mb-0">{sortedArticles.length}</h3>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="icon icon-box-success">
                      <span className="mdi mdi-database icon-item"></span>
                    </div>
                  </div>
                </div>
                <h6 className="text-muted font-weight-normal">Всего записей в базе</h6>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-9">
                    <div className="d-flex align-items-center align-self-start">
                      <h3 className="mb-0">{last24Hours.length}</h3>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="icon icon-box-success">
                      <span className="mdi mdi-clock-outline icon-item"></span>
                    </div>
                  </div>
                </div>
                <h6 className="text-muted font-weight-normal">Материалов за последние 24 часа</h6>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-9">
                    <div className="d-flex align-items-center align-self-start">
                      <h3 className="mb-0">{threats.length}</h3>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="icon icon-box-danger">
                      <span className="mdi mdi-shield-alert icon-item"></span>
                    </div>
                  </div>
                </div>
                <h6 className="text-muted font-weight-normal">Классифицировано как угроза</h6>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-9">
                    <div className="d-flex align-items-center align-self-start">
                      <h3 className="mb-0">{topSources.length}</h3>
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="icon icon-box-info">
                      <span className="mdi mdi-web icon-item"></span>
                    </div>
                  </div>
                </div>
                <h6 className="text-muted font-weight-normal">Активных источников в выборке</h6>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Структура угроз</h4>
                <div className="aligner-wrapper">
                  <Doughnut data={categoryChartData} options={this.transactionHistoryOptions} />
                  <div className="absolute center-content">
                    <h5 className="font-weight-normal text-center mb-2 text-white">{threats.length}</h5>
                    <p className="text-small text-muted text-center mb-0">угроз</p>
                  </div>
                </div>
                {topCategories.map((item) => (
                  <div
                    key={item.label}
                    className="bg-gray-dark d-flex d-md-block d-xl-flex flex-row py-3 px-4 px-md-3 px-xl-4 rounded mt-3"
                  >
                    <div className="text-md-center text-xl-left">
                      <h6 className="mb-1">{item.label}</h6>
                      <p className="text-muted mb-0">Количество материалов в категории</p>
                    </div>
                    <div className="align-self-center flex-grow text-right text-md-center text-xl-right py-md-2 py-xl-0">
                      <h6 className="font-weight-bold mb-0">{item.count}</h6>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-md-8 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-row justify-content-between">
                  <h4 className="card-title mb-1">Последние материалы</h4>
                  <p className="text-muted mb-1">Backend /articles</p>
                </div>
                <div className="row">
                  <div className="col-12">
                    <div className="preview-list">
                      {latestArticles.map((article) => (
                        <div className="preview-item border-bottom" key={article.url}>
                          <div className="preview-thumbnail">
                            <div className={`preview-icon ${getTypeIconClass(article.type)}`}>
                              <i className="mdi mdi-file-document"></i>
                            </div>
                          </div>
                          <div className="preview-item-content d-sm-flex flex-grow">
                            <div className="flex-grow">
                              <h6 className="preview-subject">{article.title}</h6>
                              <p className="text-muted mb-0">
                                {article.source} | {article.type || 'unclassified'} | {getThreatCategoryLabel(article.category, 'Без категории')}
                              </p>
                            </div>
                            <div className="mr-auto text-sm-right pt-2 pt-sm-0">
                              <p className="text-muted">{formatRelativeTime(article.publishedAt || article.extracted_at)}</p>
                              <p className="text-muted mb-0">
                                severity {article.severity || 'n/a'}, confidence {formatScore(safeNumber(article.llm_confidence))}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-sm-4 grid-margin">
            <div className="card">
              <div className="card-body">
                <h5>Средний confidence</h5>
                <div className="row">
                  <div className="col-8 col-sm-12 col-xl-8 my-auto">
                    <div className="d-flex d-sm-block d-md-flex align-items-center">
                      <h2 className="mb-0">{formatScore(avgConfidence)}</h2>
                    </div>
                    <h6 className="text-muted font-weight-normal">Уверенность классификации по материалам типа threat</h6>
                  </div>
                  <div className="col-4 col-sm-12 col-xl-4 text-center text-xl-right">
                    <i className="icon-lg mdi mdi-brain text-primary ml-auto"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-sm-4 grid-margin">
            <div className="card">
              <div className="card-body">
                <h5>Средний impact score</h5>
                <div className="row">
                  <div className="col-8 col-sm-12 col-xl-8 my-auto">
                    <div className="d-flex d-sm-block d-md-flex align-items-center">
                      <h2 className="mb-0">{formatScore(avgImpact)}</h2>
                    </div>
                    <h6 className="text-muted font-weight-normal">Среднее по confidentiality, integrity и availability</h6>
                  </div>
                  <div className="col-4 col-sm-12 col-xl-4 text-center text-xl-right">
                    <i className="icon-lg mdi mdi-crosshairs-gps text-danger ml-auto"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-sm-4 grid-margin">
            <div className="card">
              <div className="card-body">
                <h5>Сводный risk score</h5>
                <div className="row">
                  <div className="col-8 col-sm-12 col-xl-8 my-auto">
                    <div className="d-flex d-sm-block d-md-flex align-items-center">
                      <h2 className="mb-0">{formatScore(riskScore)}</h2>
                    </div>
                    <h6 className="text-muted font-weight-normal">
                      Учитывает severity, confidence и active exploitation. High severity: {formatScore(highSeverityRatio)}
                    </h6>
                  </div>
                  <div className="col-4 col-sm-12 col-xl-4 text-center text-xl-right">
                    <i className="icon-lg mdi mdi-shield-alert text-success ml-auto"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-12 grid-margin">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Последние классифицированные записи</h4>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Источник</th>
                        <th>Тип</th>
                        <th>Категория</th>
                        <th>Severity</th>
                        <th>Страна</th>
                        <th>Дата</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedArticles.slice(0, 8).map((article) => (
                        <tr key={article.url}>
                          <td>{article.source}</td>
                          <td>{article.type || 'n/a'}</td>
                          <td>{getThreatCategoryLabel(article.category, 'Без категории')}</td>
                          <td>
                            <div className={`badge ${getSeverityBadgeClass(article.severity)}`}>
                              {article.severity || 'n/a'}
                            </div>
                          </td>
                          <td>{article.country || 'Не указано'}</td>
                          <td>{formatDate(article.publishedAt || article.extracted_at)}</td>
                          <td>{getStatusLabel(article)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-12 col-xl-7 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-row justify-content-between">
                  <h4 className="card-title">Топ источников</h4>
                  <p className="text-muted mb-1 small">По текущей выборке</p>
                </div>
                <div className="preview-list">
                  {topSources.map((source) => (
                    <div className="preview-item border-bottom" key={source.label}>
                      <div className="preview-item-content d-flex flex-grow">
                        <div className="flex-grow">
                          <div className="d-flex d-md-block d-xl-flex justify-content-between">
                            <h6 className="preview-subject">{source.label}</h6>
                            <p className="text-muted text-small">{source.count} записей</p>
                          </div>
                          <p className="text-muted">
                            Доля в потоке: {formatScore(source.count / sortedArticles.length)}. Новостей: {news.length}, угроз: {threats.length}.
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-12 col-xl-5 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Приоритетные угрозы</h4>
                <div className="preview-list">
                  {recentThreats.length ? (
                    recentThreats.map((article) => (
                      <div className="preview-item border-bottom" key={article.url}>
                        <div className="preview-item-content d-flex flex-grow">
                          <div className="flex-grow">
                            <div className="d-flex d-md-block d-xl-flex justify-content-between">
                              <h6 className="preview-subject">{article.title}</h6>
                              <p className="text-muted text-small">{article.severity || 'n/a'}</p>
                            </div>
                            <p className="text-muted">
                              {getThreatCategoryLabel(article.category, 'Без категории')} | exploit {formatScore(safeNumber(article.active_exploitation))} |
                              impact {formatScore(
                                average([
                                  safeNumber(article.impact_confidentiality),
                                  safeNumber(article.impact_integrity),
                                  safeNumber(article.impact_availability),
                                ]),
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0">В текущей базе пока нет записей типа threat.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">География угроз</h4>
                <div className="row">
                  <div className="col-md-5">
                    <div className="table-responsive">
                      <table className="table">
                        <tbody>
                          {geographyRows.length ? (
                            geographyRows.map((row) => (
                              <tr key={row.code}>
                                <td>
                                  <i className={`flag-icon flag-icon-${row.code.toLowerCase()}`}></i>
                                </td>
                                <td>{row.label}</td>
                                <td className="text-right">{row.count} угроз</td>
                                <td className="text-right font-weight-medium">impact {formatScore(row.avgImpact)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="text-muted">
                                В текущих записях пока недостаточно данных по странам.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="col-md-7">
                    <div id="audience-map" className="vector-map"></div>
                    <VectorMap
                      map={'world_mill'}
                      backgroundColor="transparent"
                      panOnDrag={true}
                      containerClassName="dashboard-vector-map"
                      focusOn={{
                        x: 0.5,
                        y: 0.5,
                        scale: 1,
                        animate: true,
                      }}
                      series={{
                        regions: [
                          {
                            scale: ['#3d3c3c', '#f2f2f2'],
                            normalizeFunction: 'polynomial',
                            values: mapData,
                          },
                        ],
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Dashboard;
