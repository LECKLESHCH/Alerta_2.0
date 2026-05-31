import React, { Component } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { fetchAllModelThreats } from '../../api/modelThreats';
import { API_ENDPOINTS } from '../../api/endpoints';
import { getThreatCategoryLabel } from '../../utils/threatLabels';

const DAY_WINDOW = 14;
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'n/a'];
const SEVERITY_META = {
  critical: { label: 'Критические', color: '#ff5c7a' },
  high: { label: 'Высокие', color: '#ff8a3d' },
  medium: { label: 'Средние', color: '#ffd166' },
  low: { label: 'Низкие', color: '#2dd4bf' },
  'n/a': { label: 'Без уровня', color: '#6c7293' },
};

const LEVEL_ORDER = [
  'physical',
  'perimeter',
  'network',
  'endpoints',
  'applications',
  'iam',
  'data',
  'monitoringResponse',
  'governance',
  'organizational',
];

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

function safeDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(date);
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

function formatRatio(value) {
  return `${Math.round(value * 100)}%`;
}

function normalizeSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return SEVERITY_META[normalized] ? normalized : 'n/a';
}

function sortByDateDesc(items) {
  return [...items].sort((left, right) => {
    const leftDate = safeDate(left.publishedAt || left.extracted_at);
    const rightDate = safeDate(right.publishedAt || right.extracted_at);
    return (rightDate ? rightDate.getTime() : 0) - (leftDate ? leftDate.getTime() : 0);
  });
}

function collectTopGroups(items, getKey, limit) {
  const groups = items.reduce((accumulator, item) => {
    const key = getKey(item);
    if (!key) {
      return accumulator;
    }

    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(groups)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function buildTimeline(articles) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: DAY_WINDOW }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (DAY_WINDOW - index - 1));
    return {
      key: formatDayKey(date),
      label: formatDayLabel(date),
      total: 0,
      threats: 0,
      highPriority: 0,
    };
  });

  const daysMap = days.reduce((accumulator, day) => {
    accumulator[day.key] = day;
    return accumulator;
  }, {});

  articles.forEach((article) => {
    const date = safeDate(article.publishedAt || article.extracted_at);
    if (!date) {
      return;
    }

    const bucket = daysMap[formatDayKey(startOfDay(date))];
    if (!bucket) {
      return;
    }

    bucket.total += 1;
    if (article.type === 'threat') {
      bucket.threats += 1;
      if (normalizeSeverity(article.severity) === 'critical' || normalizeSeverity(article.severity) === 'high') {
        bucket.highPriority += 1;
      }
    }
  });

  return days;
}

function buildSeverityRows(threats) {
  const counts = threats.reduce(
    (accumulator, article) => {
      const bucket = normalizeSeverity(article.severity);
      accumulator[bucket] += 1;
      return accumulator;
    },
    { critical: 0, high: 0, medium: 0, low: 0, 'n/a': 0 },
  );

  return SEVERITY_ORDER.map((key) => ({
    key,
    label: SEVERITY_META[key].label,
    color: SEVERITY_META[key].color,
    count: counts[key],
  })).filter((item) => item.count > 0);
}

function buildChartData(articles) {
  const sortedArticles = sortByDateDesc(articles);
  const threats = sortedArticles.filter((article) => article.type === 'threat');
  const timeline = buildTimeline(sortedArticles);
  const severityRows = buildSeverityRows(threats);
  const topCategories = collectTopGroups(
    threats,
    (article) => {
      const label = getThreatCategoryLabel(article.category, '');
      return label === 'Не указана' ? null : label;
    },
    5,
  );
  const peakDay = [...timeline].sort((left, right) => right.threats - left.threats || right.total - left.total)[0];
  const avgConfidence = average(threats.map((article) => safeNumber(article.llm_confidence)));
  const protectionMatrix = buildProtectionLevelMatrix(threats);
  const sourceSeverityRows = buildSourceSeverityRows(threats);

  return {
    total: sortedArticles.length,
    threats,
    timeline,
    severityRows,
    topCategories,
    peakDay,
    avgConfidence,
    protectionMatrix,
    sourceSeverityRows,
  };
}

function buildProtectionLevelMatrix(threats) {
  const levels = Array.from(
    new Set(
      LEVEL_ORDER.filter((level) =>
        threats.some((item) => Array.isArray(item.targeted_levels) && item.targeted_levels.includes(level)),
      ),
    ),
  );
  const visibleLevels = levels.length ? levels : LEVEL_ORDER.slice(0, 9);
  const severityKeys = ['high', 'medium', 'low'];
  const matrix = {};
  visibleLevels.forEach((level) => {
    matrix[level] = { high: 0, medium: 0, low: 0 };
  });

  threats.forEach((item) => {
    const severity = normalizeSeverity(item.severity);
    if (!severityKeys.includes(severity)) return;
    const targetedLevels = Array.isArray(item.targeted_levels) ? item.targeted_levels : [];
    targetedLevels.forEach((level) => {
      if (!matrix[level]) return;
      matrix[level][severity] += 1;
    });
  });

  const maxCell = Math.max(
    1,
    ...visibleLevels.flatMap((level) =>
      severityKeys.map((severity) => matrix[level][severity]),
    ),
  );

  return { levels: visibleLevels, severityKeys, matrix, maxCell };
}

function buildSourceSeverityRows(threats) {
  const groups = {};
  threats.forEach((item) => {
    const source = item.source || 'Не указан';
    if (!groups[source]) {
      groups[source] = { high: 0, medium: 0, low: 0, total: 0 };
    }
    const severity = normalizeSeverity(item.severity);
    if (severity === 'high' || severity === 'critical') groups[source].high += 1;
    else if (severity === 'medium') groups[source].medium += 1;
    else if (severity === 'low') groups[source].low += 1;
    groups[source].total += 1;
  });

  return Object.entries(groups)
    .map(([source, value]) => ({ source, ...value }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);
}

export class ChartJs extends Component {
  state = {
    articles: [],
    loading: true,
    error: null,
  };

  lineOptions = {
    maintainAspectRatio: false,
    legend: {
      display: true,
      labels: {
        fontColor: '#aab4d0',
        boxWidth: 12,
      },
    },
    tooltips: {
      mode: 'index',
      intersect: false,
    },
    elements: {
      line: {
        tension: 0.35,
      },
      point: {
        radius: 3,
        hoverRadius: 5,
      },
    },
    scales: {
      yAxes: [
        {
          ticks: {
            beginAtZero: true,
            fontColor: '#6c7293',
            precision: 0,
          },
          gridLines: {
            color: 'rgba(108, 114, 147, 0.12)',
          },
        },
      ],
      xAxes: [
        {
          ticks: {
            fontColor: '#6c7293',
          },
          gridLines: {
            display: false,
          },
        },
      ],
    },
  };

  barOptions = {
    maintainAspectRatio: false,
    legend: {
      display: false,
    },
    scales: {
      yAxes: [
        {
          ticks: {
            beginAtZero: true,
            fontColor: '#6c7293',
            precision: 0,
          },
          gridLines: {
            color: 'rgba(108, 114, 147, 0.12)',
          },
        },
      ],
      xAxes: [
        {
          ticks: {
            fontColor: '#6c7293',
          },
          gridLines: {
            display: false,
          },
        },
      ],
    },
  };

  stackedBarOptions = {
    maintainAspectRatio: false,
    legend: {
      display: true,
      labels: {
        fontColor: '#aab4d0',
      },
    },
    scales: {
      yAxes: [
        {
          stacked: true,
          ticks: {
            beginAtZero: true,
            fontColor: '#6c7293',
            precision: 0,
          },
          gridLines: {
            color: 'rgba(108, 114, 147, 0.12)',
          },
        },
      ],
      xAxes: [
        {
          stacked: true,
          ticks: {
            fontColor: '#6c7293',
          },
          gridLines: {
            display: false,
          },
        },
      ],
    },
  };

  doughnutOptions = {
    maintainAspectRatio: false,
    cutoutPercentage: 72,
    legend: {
      display: false,
    },
    elements: {
      arc: {
        borderWidth: 0,
      },
    },
  };

  componentDidMount() {
    this.loadArticles();
  }

  async loadArticles() {
    try {
      const articles = await fetchAllModelThreats();
      this.setState({ articles, loading: false, error: null });
    } catch (error) {
      this.setState({
        loading: false,
        error: `Не удалось получить данные из backend (${API_ENDPOINTS.modelThreatsBySource('web')}).`,
      });
    }
  }

  renderStateCard(title, message) {
    return (
      <div className="card">
        <div className="card-body">
          <h4 className="card-title">{title}</h4>
          <p className="text-muted mb-0">{message}</p>
        </div>
      </div>
    );
  }

  render() {
    const { articles, loading, error } = this.state;

    if (loading) {
      return this.renderStateCard('Динамика сигналов', 'Загружаю публикации и собираю временной профиль потока...');
    }

    if (error) {
      return this.renderStateCard('Динамика сигналов', error);
    }

    if (!articles.length) {
      return this.renderStateCard('Динамика сигналов', 'В базе пока нет публикаций. После первого прохода краулера здесь появится динамика.');
    }

    const {
      total,
      threats,
      timeline,
      severityRows,
      topCategories,
      peakDay,
      avgConfidence,
      protectionMatrix,
      sourceSeverityRows,
    } = buildChartData(articles);

    const lineChartData = {
      labels: timeline.map((item) => item.label),
      datasets: [
        {
          label: 'Все угрозы',
          data: timeline.map((item) => item.threats),
          borderColor: '#00c2ff',
          backgroundColor: 'rgba(0, 194, 255, 0.14)',
          pointBackgroundColor: '#00c2ff',
          fill: true,
        },
        {
          label: 'Высокий приоритет (high/critical)',
          data: timeline.map((item) => item.highPriority),
          borderColor: '#ff5c7a',
          backgroundColor: 'rgba(255, 92, 122, 0.08)',
          pointBackgroundColor: '#ff5c7a',
          fill: false,
        },
      ],
    };

    const categoryChartData = {
      labels: topCategories.map((item) => item.label),
      datasets: [
        {
          data: topCategories.map((item) => item.count),
          backgroundColor: ['#4b7bec', '#00c2ff', '#2dd4bf', '#ffd166', '#ff8a3d'],
          borderRadius: 8,
          maxBarThickness: 32,
        },
      ],
    };

    const severityChartData = {
      labels: severityRows.map((item) => item.label),
      datasets: [
        {
          data: severityRows.map((item) => item.count),
          backgroundColor: severityRows.map((item) => item.color),
        },
      ],
    };

    const threatShare = total ? threats.length / total : 0;
    const peakThreats = peakDay ? peakDay.threats : 0;
    const peakLabel = peakDay ? peakDay.label : 'н/д';

    const sourceSeverityChartData = {
      labels: sourceSeverityRows.map((item) => item.source),
      datasets: [
        {
          label: 'Высокий',
          data: sourceSeverityRows.map((item) => item.high),
          backgroundColor: '#ff5c7a',
          borderRadius: 6,
          maxBarThickness: 34,
        },
        {
          label: 'Средний',
          data: sourceSeverityRows.map((item) => item.medium),
          backgroundColor: '#ffd166',
          borderRadius: 6,
          maxBarThickness: 34,
        },
        {
          label: 'Низкий',
          data: sourceSeverityRows.map((item) => item.low),
          backgroundColor: '#2dd4bf',
          borderRadius: 6,
          maxBarThickness: 34,
        },
      ],
    };

    return (
      <div className="alerta-signals-page">
        <div className="page-header">
          <h3 className="page-title">Динамика сигналов</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>Метрики риска</a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">Динамика сигналов</li>
            </ol>
          </nav>
        </div>

        <div className="row mb-3">
          <div className="col-md-6 col-xl-3 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h6 className="mb-2 text-white h5">Всего угроз</h6>
                <h3 className="mb-0">{threats.length}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-6 col-xl-3 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h6 className="mb-2 text-white h5">Доля угроз</h6>
                <h3 className="mb-0">{formatRatio(threatShare)}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-6 col-xl-3 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h6 className="mb-2 text-white h5">Пик high/critical</h6>
                <h3 className="mb-0">{peakThreats}</h3>
                <div className="text-muted mt-1">{peakLabel}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6 col-xl-3 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h6 className="mb-2 text-white h5">Средний confidence</h6>
                <h3 className="mb-0">{avgConfidence.toFixed(2)}</h3>
                <div className="text-muted mt-1">по угрозам за окно</div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-xl-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start mb-3">
                  <div>
                    <h4 className="card-title mb-1">Тренд угроз и приоритетных угроз</h4>
                    <p className="text-muted mb-0">Без новостного потока: только динамика выявленных угроз.</p>
                  </div>
                  <div className="alerta-signals-chip">Пик: {peakLabel}</div>
                </div>
                <div className="alerta-signals-chart-lg">
                  <Line data={lineChartData} options={this.lineOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-xl-7 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title mb-3">Матрица угроз по уровням защиты</h4>
                <div className="table-responsive">
                  <table className="table table-bordered text-white mb-0">
                    <thead>
                      <tr>
                        <th>Уровень эшелонированной защиты</th>
                        <th className="text-center text-danger">Высокий</th>
                        <th className="text-center text-warning">Средний</th>
                        <th className="text-center text-success">Низкий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {protectionMatrix.levels.map((level) => (
                        <tr key={level}>
                          <td className="font-weight-medium">{LEVEL_LABELS[level] || level}</td>
                          {protectionMatrix.severityKeys.map((severity) => {
                            const value = protectionMatrix.matrix[level][severity];
                            const alpha = value > 0 ? Math.max(0.14, value / protectionMatrix.maxCell) : 0;
                            const color =
                              severity === 'high'
                                ? `rgba(220, 53, 69, ${alpha})`
                                : severity === 'medium'
                                  ? `rgba(255, 193, 7, ${alpha})`
                                  : `rgba(40, 167, 69, ${alpha})`;
                            return (
                              <td
                                key={`${level}-${severity}`}
                                className="text-center font-weight-bold"
                                style={{ backgroundColor: color }}
                              >
                                {value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-5 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title mb-3">Источники × уровень опасности</h4>
                <div className="alerta-signals-chart-md">
                  <Bar data={sourceSeverityChartData} options={this.stackedBarOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-xl-7 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start mb-3">
                  <div>
                    <h4 className="card-title mb-1">Топ категорий угроз</h4>
                    <p className="text-muted mb-0">Показываем только доминирующие направления, чтобы не распыляться.</p>
                  </div>
                </div>
                <div className="alerta-signals-chart-md">
                  <Bar data={categoryChartData} options={this.barOptions} />
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-5 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title mb-3">Распределение по severity</h4>
                <div className="alerta-signals-severity">
                  <div className="alerta-signals-chart-sm">
                    <Doughnut data={severityChartData} options={this.doughnutOptions} />
                  </div>
                  <div className="alerta-signals-severity-list">
                    {severityRows.length ? severityRows.map((item) => (
                      <div className="alerta-signals-severity-row" key={item.key}>
                        <span className="alerta-signals-severity-row__label">
                          <i style={{ backgroundColor: item.color }} />
                          {item.label}
                        </span>
                        <strong>{item.count}</strong>
                      </div>
                    )) : (
                      <p className="text-muted mb-0">Записей типа threat пока недостаточно для среза.</p>
                    )}
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

export default ChartJs;
