import React, { Component } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { fetchArticles } from '../../api/articles';
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

function formatDateTime(value) {
  const date = safeDate(value);
  if (!date) {
    return 'Нет даты';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
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
  const topSources = collectTopGroups(sortedArticles, (article) => article.source || 'Не указан', 3);
  const peakDay = [...timeline].sort((left, right) => right.threats - left.threats || right.total - left.total)[0];
  const latestArticle = sortedArticles[0] || null;
  const avgConfidence = average(threats.map((article) => safeNumber(article.llm_confidence)));

  return {
    total: sortedArticles.length,
    threats,
    timeline,
    severityRows,
    topCategories,
    topSources,
    peakDay,
    latestArticle,
    avgConfidence,
  };
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

  async fetchAllArticles() {
    const pageSize = 200;
    let page = 1;
    let totalPages = 1;
    const allArticles = [];

    while (page <= totalPages) {
      const { items, meta } = await fetchArticles({
        page,
        limit: pageSize,
        includeText: 0,
      });

      if (Array.isArray(items) && items.length) {
        allArticles.push(...items);
      }

      totalPages =
        meta && Number.isInteger(meta.totalPages) && meta.totalPages > 0
          ? meta.totalPages
          : 1;

      page += 1;
    }

    return allArticles;
  }

  async loadArticles() {
    try {
      const articles = await this.fetchAllArticles();
      this.setState({ articles, loading: false, error: null });
    } catch (error) {
      this.setState({
        loading: false,
        error: `Не удалось получить данные из backend (${API_ENDPOINTS.articles()}).`,
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
      topSources,
      peakDay,
      latestArticle,
      avgConfidence,
    } = buildChartData(articles);

    const lineChartData = {
      labels: timeline.map((item) => item.label),
      datasets: [
        {
          label: 'Все сигналы',
          data: timeline.map((item) => item.total),
          borderColor: '#4b7bec',
          backgroundColor: 'rgba(75, 123, 236, 0.12)',
          pointBackgroundColor: '#4b7bec',
          fill: true,
        },
        {
          label: 'Угрозы',
          data: timeline.map((item) => item.threats),
          borderColor: '#ff5c7a',
          backgroundColor: 'rgba(255, 92, 122, 0.06)',
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

        <div className="card grid-margin">
          <div className="card-body alerta-signals-hero">
            <div>
              <p className="alerta-signals-kicker">Последние {DAY_WINDOW} дней</p>
              <h4 className="card-title mb-2">Короткая картина потока</h4>
              <p className="text-muted mb-0">
                Один главный тренд по ленте, один структурный срез по угрозам и справа только то,
                что реально помогает быстро понять обстановку.
              </p>
            </div>
            <div className="alerta-signals-stats">
              <div className="alerta-signals-stat">
                <span className="alerta-signals-stat__label">Всего материалов</span>
                <strong>{total}</strong>
              </div>
              <div className="alerta-signals-stat">
                <span className="alerta-signals-stat__label">Доля угроз</span>
                <strong>{formatRatio(threatShare)}</strong>
              </div>
              <div className="alerta-signals-stat">
                <span className="alerta-signals-stat__label">Пик по угрозам</span>
                <strong>{peakThreats}</strong>
              </div>
              <div className="alerta-signals-stat">
                <span className="alerta-signals-stat__label">Средний confidence</span>
                <strong>{avgConfidence.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-xl-8 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start mb-3">
                  <div>
                    <h4 className="card-title mb-1">Тренд публикаций и угроз</h4>
                    <p className="text-muted mb-0">Главный график без лишних режимов и дублирования.</p>
                  </div>
                  <div className="alerta-signals-chip">Пик: {peakLabel}</div>
                </div>
                <div className="alerta-signals-chart-lg">
                  <Line data={lineChartData} options={this.lineOptions} />
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title mb-3">Фокус смены</h4>
                <div className="alerta-signals-aside">
                  <div className="alerta-signals-focus">
                    <span className="alerta-signals-focus__label">Самый активный день</span>
                    <strong>{peakLabel}</strong>
                    <span className="text-muted">{peakThreats} угроз в выборке дня</span>
                  </div>

                  <div className="alerta-signals-focus">
                    <span className="alerta-signals-focus__label">Последний материал</span>
                    <strong>{latestArticle ? latestArticle.source || 'Источник не указан' : 'Нет данных'}</strong>
                    <span className="text-muted">{latestArticle ? formatDateTime(latestArticle.publishedAt || latestArticle.extracted_at) : 'Нет даты'}</span>
                  </div>

                  <div className="alerta-signals-mini-list">
                    <h6 className="mb-3">Источники в фокусе</h6>
                    {topSources.map((item) => (
                      <div className="alerta-signals-mini-list__item" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="alerta-signals-mini-list">
                    <h6 className="mb-3">Высокий приоритет по дням</h6>
                    {timeline
                      .filter((item) => item.highPriority > 0)
                      .slice(-4)
                      .reverse()
                      .map((item) => (
                        <div className="alerta-signals-mini-list__item" key={item.key}>
                          <span>{item.label}</span>
                          <strong>{item.highPriority}</strong>
                        </div>
                      ))}
                    {!timeline.some((item) => item.highPriority > 0) ? (
                      <p className="text-muted mb-0">Критичные и high угрозы за окно пока не выделяются.</p>
                    ) : null}
                  </div>
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
