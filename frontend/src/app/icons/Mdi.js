import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import { Bar, Line } from 'react-chartjs-2';

const reportKinds = [
  'Ежедневная аналитическая сводка',
  'Недельный обзор угроз',
  'Отчет по объекту КИИ',
  'Экспресс-оценка инцидентной обстановки',
];

const audiences = [
  'Руководитель SOC',
  'Руководство организации',
  'Техническая команда',
  'Куратор объекта КИИ',
];

const sectionCatalog = [
  { key: 'summary', label: 'Резюме', hint: 'Короткий вывод для руководителя.' },
  { key: 'landscape', label: 'Текущая обстановка', hint: 'Что происходит в потоке сигналов.' },
  { key: 'priority', label: 'Приоритетные угрозы', hint: 'Критичное и high за период.' },
  { key: 'ttp', label: 'TTP и паттерны', hint: 'Наблюдаемые техники и сценарии.' },
  { key: 'sources', label: 'Источники и география', hint: 'Откуда пришли сигналы и где активность.' },
  { key: 'recommendations', label: 'Рекомендации', hint: 'Что делать дальше.' },
  { key: 'appendix', label: 'Приложение', hint: 'Список материалов и ссылки.' },
];

const previewMetrics = [
  { label: 'Сигналов за окно', value: '47', accent: 'info' },
  { label: 'High / critical', value: '12', accent: 'danger' },
  { label: 'Доминирующая категория', value: 'Эксплуатация уязвимостей', accent: 'warning' },
  { label: 'Основной источник', value: 'The Hacker News', accent: 'success' },
];

const trendChartData = {
  labels: ['01.04', '03.04', '05.04', '07.04', '09.04', '11.04', '13.04', '15.04'],
  datasets: [
    {
      label: 'Все сигналы',
      data: [14, 18, 17, 24, 22, 28, 26, 19],
      borderColor: '#3366cc',
      backgroundColor: 'rgba(51, 102, 204, 0.1)',
      fill: false,
      borderWidth: 2,
    },
    {
      label: 'Угрозы',
      data: [5, 7, 6, 11, 9, 12, 10, 8],
      borderColor: '#d64545',
      backgroundColor: 'rgba(214, 69, 69, 0.08)',
      fill: false,
      borderWidth: 2,
    },
  ],
};

const categoryChartData = {
  labels: ['Экспл. уязвимостей', 'Учетные данные', 'Supply chain', 'Фишинг'],
  datasets: [
    {
      label: 'Количество материалов',
      data: [12, 9, 5, 4],
      backgroundColor: ['#3366cc', '#4f7fd8', '#7ba4ea', '#a8c3f5'],
      borderWidth: 0,
    },
  ],
};

const chartOptions = {
  maintainAspectRatio: false,
  legend: {
    display: true,
    labels: {
      fontColor: '#3d4a5c',
      boxWidth: 12,
    },
  },
  scales: {
    yAxes: [
      {
        ticks: {
          beginAtZero: true,
          precision: 0,
          fontColor: '#6b7280',
        },
        scaleLabel: {
          display: true,
          labelString: 'Количество',
          fontColor: '#6b7280',
        },
        gridLines: {
          color: '#e6eaf0',
        },
      },
    ],
    xAxes: [
      {
        ticks: {
          fontColor: '#6b7280',
        },
        scaleLabel: {
          display: true,
          labelString: 'Дата / категория',
          fontColor: '#6b7280',
        },
        gridLines: {
          display: false,
        },
      },
    ],
  },
};

const initialState = {
  reportKind: reportKinds[0],
  audience: audiences[0],
  periodMode: 'range',
  reportDate: '',
  dateFrom: '',
  dateTo: '',
  title: 'Оперативная аналитическая сводка по киберугрозам',
  subtitle: 'Контур мониторинга ALERTA 2.0',
  objectName: 'Критический сегмент сети / производственный контур',
  executiveSummary:
    'За выбранный период поток материалов сохраняет повышенную плотность. Основной фокус смещён в сторону эксплуатации уязвимостей, компрометации учётных данных и связанных с ними цепочек первичного доступа.',
  scope:
    'В отчёт включаются публикации из доверенных источников, автоматически классифицированные сигналы, а также наблюдения, имеющие отношение к профилю защищаемого объекта.',
  recommendations:
    'Проверить актуальность компенсирующих мер, актуализировать список уязвимых сервисов, выделить high-priority материалы в отдельную оперативную выборку для ручной верификации.',
  selectedSections: ['summary', 'landscape', 'priority', 'ttp', 'recommendations'],
  includeCharts: true,
  includeTable: true,
  includeExecutiveBlock: true,
};

function formatDisplayDate(value) {
  if (!value) {
    return 'не задано';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function buildPeriodLabel(state) {
  if (state.periodMode === 'single') {
    return `Дата отчета: ${formatDisplayDate(state.reportDate)}`;
  }

  const from = formatDisplayDate(state.dateFrom);
  const to = formatDisplayDate(state.dateTo);
  return `Период: ${from} - ${to}`;
}

function getSelectedSectionLabels(selectedSections) {
  return sectionCatalog
    .filter((item) => selectedSections.includes(item.key))
    .map((item) => item.label);
}

function inlineComputedStyles(sourceNode, targetNode) {
  if (!(sourceNode instanceof Element) || !(targetNode instanceof Element)) {
    return;
  }

  const computedStyle = window.getComputedStyle(sourceNode);
  const styleText = Array.from(computedStyle)
    .map((property) => `${property}:${computedStyle.getPropertyValue(property)};`)
    .join('');

  targetNode.setAttribute('style', styleText);

  const sourceChildren = Array.from(sourceNode.children);
  const targetChildren = Array.from(targetNode.children);
  sourceChildren.forEach((child, index) => {
    inlineComputedStyles(child, targetChildren[index]);
  });
}

function binaryStringFromBytes(bytes) {
  let result = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    result += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return result;
}

function base64ToUint8Array(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function buildPdfFromJpeg(imageBytes, imageWidth, imageHeight) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 28;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const x = (pageWidth - drawWidth) / 2;
  const y = pageHeight - margin - drawHeight;

  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(
      2,
    )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  objects.push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n${binaryStringFromBytes(
      imageBytes,
    )}\nendstream\nendobj\n`,
  );
  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(
    2,
  )} cm\n/Im0 Do\nQ`;
  objects.push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let index = 0; index < pdf.length; index += 1) {
    bytes[index] = pdf.charCodeAt(index) & 0xff;
  }

  return bytes;
}

async function renderNodeToCanvas(node) {
  const clone = node.cloneNode(true);
  inlineComputedStyles(node, clone);

  const sourceCanvases = Array.from(node.querySelectorAll('canvas'));
  const clonedCanvases = Array.from(clone.querySelectorAll('canvas'));
  sourceCanvases.forEach((sourceCanvas, index) => {
    const clonedCanvas = clonedCanvases[index];
    if (!clonedCanvas) {
      return;
    }

    const image = document.createElement('img');
    image.src = sourceCanvas.toDataURL('image/png');
    image.width = sourceCanvas.width;
    image.height = sourceCanvas.height;
    image.style.width = sourceCanvas.style.width || `${sourceCanvas.clientWidth}px`;
    image.style.height = sourceCanvas.style.height || `${sourceCanvas.clientHeight}px`;
    const computedStyle = window.getComputedStyle(sourceCanvas);
    image.setAttribute(
      'style',
      Array.from(computedStyle)
        .map((property) => `${property}:${computedStyle.getPropertyValue(property)};`)
        .join(''),
    );
    clonedCanvas.replaceWith(image);
  });

  const width = Math.ceil(node.scrollWidth);
  const height = Math.ceil(node.scrollHeight);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.margin = '0';

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = new Image();
  image.decoding = 'sync';

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext('2d');
  context.scale(2, 2);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function ReportSection({ title, children }) {
  return (
    <section className="alerta-report-preview__section">
      <div className="alerta-report-preview__section-head">
        <h6>{title}</h6>
      </div>
      <div className="alerta-report-preview__section-body">{children}</div>
    </section>
  );
}

export class Mdi extends Component {
  state = { ...initialState, isExportingPdf: false };

  previewPageRef = React.createRef();

  handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    this.setState({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  handleSectionToggle = (sectionKey) => {
    this.setState((prevState) => {
      const hasSection = prevState.selectedSections.includes(sectionKey);
      return {
        selectedSections: hasSection
          ? prevState.selectedSections.filter((item) => item !== sectionKey)
          : [...prevState.selectedSections, sectionKey],
      };
    });
  };

  exportPdf = async () => {
    if (!this.previewPageRef.current || this.state.isExportingPdf) {
      return;
    }

    this.setState({ isExportingPdf: true });

    try {
      const canvas = await renderNodeToCanvas(this.previewPageRef.current);
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = jpegDataUrl.split(',')[1];
      const imageBytes = base64ToUint8Array(base64);
      const pdfBytes = buildPdfFromJpeg(imageBytes, canvas.width, canvas.height);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'alerta-report.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      this.setState({ isExportingPdf: false });
    }
  };

  renderPreview() {
    const {
      title,
      subtitle,
      reportKind,
      audience,
      objectName,
      executiveSummary,
      scope,
      recommendations,
      selectedSections,
      includeCharts,
      includeTable,
      includeExecutiveBlock,
    } = this.state;

    const sectionLabels = getSelectedSectionLabels(selectedSections);

    return (
      <div className="alerta-report-preview">
        <div className="alerta-report-preview__page" ref={this.previewPageRef}>
          <div className="alerta-report-preview__hero">
            <div>
              <span className="alerta-report-preview__eyebrow">{reportKind}</span>
              <h3>{title}</h3>
              <p>{subtitle}</p>
            </div>
            <div className="alerta-report-preview__meta">
              <div>
                <span>Аудитория</span>
                <strong>{audience}</strong>
              </div>
              <div>
                <span>Объект</span>
                <strong>{objectName || 'Не указан'}</strong>
              </div>
              <div>
                <span>Окно наблюдения</span>
                <strong>{buildPeriodLabel(this.state)}</strong>
              </div>
            </div>
          </div>

          {includeExecutiveBlock ? (
            <div className="alerta-report-preview__summary">
              <h5>Ключевой вывод</h5>
              <p>{executiveSummary}</p>
            </div>
          ) : null}

          <div className="alerta-report-preview__metrics">
            {previewMetrics.map((metric) => (
              <div key={metric.label} className={`alerta-report-preview__metric alerta-report-preview__metric--${metric.accent}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <ReportSection title="Состав документа">
            <div className="alerta-report-preview__chips">
              {sectionLabels.length ? (
                sectionLabels.map((label) => <span key={label}>{label}</span>)
              ) : (
                <span>Секции пока не выбраны</span>
              )}
            </div>
          </ReportSection>

          {selectedSections.includes('summary') ? (
            <ReportSection title="Резюме">
              <p>{executiveSummary}</p>
            </ReportSection>
          ) : null}

          {selectedSections.includes('landscape') ? (
            <ReportSection title="Текущая обстановка">
              <p>{scope}</p>
              {includeCharts ? (
                <div className="alerta-report-preview__chart-block">
                  <div className="alerta-report-preview__chart-card">
                    <h6>Динамика сигналов</h6>
                    <div className="alerta-report-preview__chart-canvas">
                      <Line data={trendChartData} options={chartOptions} />
                    </div>
                  </div>
                  <div className="alerta-report-preview__chart-card">
                    <h6>Распределение по категориям</h6>
                    <div className="alerta-report-preview__chart-canvas">
                      <Bar data={categoryChartData} options={chartOptions} />
                    </div>
                  </div>
                </div>
              ) : null}
            </ReportSection>
          ) : null}

          {selectedSections.includes('priority') && includeTable ? (
            <ReportSection title="Приоритетные угрозы">
              <div className="alerta-report-preview__table">
                <div className="alerta-report-preview__table-row alerta-report-preview__table-row--head">
                  <span>Категория</span>
                  <span>Severity</span>
                  <span>Фокус</span>
                </div>
                <div className="alerta-report-preview__table-row">
                  <span>Эксплуатация уязвимостей</span>
                  <span>critical</span>
                  <span>Интернет-экспонированные сервисы</span>
                </div>
                <div className="alerta-report-preview__table-row">
                  <span>Компрометация учетных данных</span>
                  <span>high</span>
                  <span>Удалённый доступ и подрядчики</span>
                </div>
                <div className="alerta-report-preview__table-row">
                  <span>Supply chain</span>
                  <span>medium</span>
                  <span>Зависимости и обновления</span>
                </div>
              </div>
            </ReportSection>
          ) : null}

          {selectedSections.includes('ttp') ? (
            <ReportSection title="TTP и паттерны">
              <ul className="alerta-report-preview__list">
                <li>Первичный доступ через эксплуатацию публично доступных сервисов.</li>
                <li>Повторяющиеся сценарии закрепления через легитимные учетные записи.</li>
                <li>Рост интереса к боковому перемещению и обходу базовых защитных мер.</li>
              </ul>
            </ReportSection>
          ) : null}

          {selectedSections.includes('recommendations') ? (
            <ReportSection title="Рекомендации">
              <p>{recommendations}</p>
            </ReportSection>
          ) : null}
        </div>
      </div>
    );
  }

  render() {
    const {
      reportKind,
      audience,
      periodMode,
      reportDate,
      dateFrom,
      dateTo,
      title,
      subtitle,
      objectName,
      executiveSummary,
      scope,
      recommendations,
      selectedSections,
      includeCharts,
      includeTable,
      includeExecutiveBlock,
      isExportingPdf,
    } = this.state;

    return (
      <div className="alerta-report-builder-page">
        <div className="page-header">
          <h3 className="page-title">Формирование отчета</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Формирование отчета
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Конструктор документа
              </li>
            </ol>
          </nav>
        </div>

        <div className="card grid-margin">
          <div className="card-body alerta-report-builder-hero">
            <div>
              <p className="alerta-report-builder-hero__kicker">Рабочий модуль</p>
              <h4 className="card-title mb-2">Конструктор аналитического отчета</h4>
              <p className="text-muted mb-0">
                Здесь можно собрать структуру будущего документа: выбрать окно наблюдения,
                определить наполнение и сразу увидеть, как это будет выглядеть на выходе.
              </p>
            </div>
            <div className="alerta-report-builder-hero__status">
              <span>Черновик</span>
              <strong>Предпросмотр обновляется на лету</strong>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-xl-5 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Параметры отчета</h4>

                <Form.Group>
                  <label htmlFor="reportKind">Тип документа</label>
                  <select
                    className="form-control"
                    id="reportKind"
                    name="reportKind"
                    value={reportKind}
                    onChange={this.handleInputChange}
                  >
                    {reportKinds.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Form.Group>

                <Form.Group>
                  <label htmlFor="audience">Аудитория</label>
                  <select
                    className="form-control"
                    id="audience"
                    name="audience"
                    value={audience}
                    onChange={this.handleInputChange}
                  >
                    {audiences.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Form.Group>

                <div className="alerta-report-builder-switches">
                  <label className={`alerta-report-builder-switch ${periodMode === 'single' ? 'is-active' : ''}`}>
                    <input
                      type="radio"
                      name="periodMode"
                      value="single"
                      checked={periodMode === 'single'}
                      onChange={this.handleInputChange}
                    />
                    <span>Одна дата</span>
                  </label>
                  <label className={`alerta-report-builder-switch ${periodMode === 'range' ? 'is-active' : ''}`}>
                    <input
                      type="radio"
                      name="periodMode"
                      value="range"
                      checked={periodMode === 'range'}
                      onChange={this.handleInputChange}
                    />
                    <span>Период</span>
                  </label>
                </div>

                {periodMode === 'single' ? (
                  <Form.Group>
                    <label htmlFor="reportDate">Дата отчета</label>
                    <Form.Control
                      type="date"
                      id="reportDate"
                      name="reportDate"
                      value={reportDate}
                      onChange={this.handleInputChange}
                    />
                  </Form.Group>
                ) : (
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <label htmlFor="dateFrom">С даты</label>
                        <Form.Control
                          type="date"
                          id="dateFrom"
                          name="dateFrom"
                          value={dateFrom}
                          onChange={this.handleInputChange}
                        />
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                        <label htmlFor="dateTo">По дату</label>
                        <Form.Control
                          type="date"
                          id="dateTo"
                          name="dateTo"
                          value={dateTo}
                          onChange={this.handleInputChange}
                        />
                      </Form.Group>
                    </div>
                  </div>
                )}

                <Form.Group>
                  <label htmlFor="title">Заголовок</label>
                  <Form.Control type="text" id="title" name="title" value={title} onChange={this.handleInputChange} />
                </Form.Group>

                <Form.Group>
                  <label htmlFor="subtitle">Подзаголовок</label>
                  <Form.Control type="text" id="subtitle" name="subtitle" value={subtitle} onChange={this.handleInputChange} />
                </Form.Group>

                <Form.Group>
                  <label htmlFor="objectName">Объект / контур</label>
                  <Form.Control type="text" id="objectName" name="objectName" value={objectName} onChange={this.handleInputChange} />
                </Form.Group>
              </div>
            </div>
          </div>

          <div className="col-xl-7 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Наполнение и редактор</h4>

                <div className="alerta-report-builder-sections">
                  {sectionCatalog.map((section) => (
                    <button
                      type="button"
                      key={section.key}
                      className={`alerta-report-builder-section ${selectedSections.includes(section.key) ? 'is-selected' : ''}`}
                      onClick={() => this.handleSectionToggle(section.key)}
                    >
                      <strong>{section.label}</strong>
                      <span>{section.hint}</span>
                    </button>
                  ))}
                </div>

                <div className="row mt-4">
                  <div className="col-md-4">
                    <label className="alerta-report-builder-check">
                      <input type="checkbox" name="includeExecutiveBlock" checked={includeExecutiveBlock} onChange={this.handleInputChange} />
                      <span>Executive-блок сверху</span>
                    </label>
                  </div>
                  <div className="col-md-4">
                    <label className="alerta-report-builder-check">
                      <input type="checkbox" name="includeCharts" checked={includeCharts} onChange={this.handleInputChange} />
                      <span>Вставить графический блок</span>
                    </label>
                  </div>
                  <div className="col-md-4">
                    <label className="alerta-report-builder-check">
                      <input type="checkbox" name="includeTable" checked={includeTable} onChange={this.handleInputChange} />
                      <span>Добавить табличный фрагмент</span>
                    </label>
                  </div>
                </div>

                <div className="row mt-3">
                  <div className="col-12">
                    <Form.Group>
                      <label htmlFor="executiveSummary">Резюме / вводный абзац</label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        id="executiveSummary"
                        name="executiveSummary"
                        value={executiveSummary}
                        onChange={this.handleInputChange}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-12">
                    <Form.Group>
                      <label htmlFor="scope">Описание охвата</label>
                      <Form.Control as="textarea" rows={4} id="scope" name="scope" value={scope} onChange={this.handleInputChange} />
                    </Form.Group>
                  </div>
                  <div className="col-12">
                    <Form.Group className="mb-0">
                      <label htmlFor="recommendations">Выводы и рекомендации</label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        id="recommendations"
                        name="recommendations"
                        value={recommendations}
                        onChange={this.handleInputChange}
                      />
                    </Form.Group>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start mb-3">
                  <div>
                    <h4 className="card-title mb-1">Предпросмотр документа</h4>
                    <p className="text-muted mb-0">
                      Макет ниже нужен для визуальной проверки состава, иерархии и общей посадки будущего отчета.
                    </p>
                  </div>
                  <div className="alerta-report-builder-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={this.exportPdf}
                      disabled={isExportingPdf}
                    >
                      {isExportingPdf ? 'Формирую PDF...' : 'Экспорт PDF'}
                    </button>
                  </div>
                </div>
                {this.renderPreview()}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Mdi;
