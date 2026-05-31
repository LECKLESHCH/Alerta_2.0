import React, { Component } from 'react';
import { Form, Modal } from 'react-bootstrap';
import { Bar, Line } from 'react-chartjs-2';
import { fetchAllModelThreats } from '../../api/modelThreats';
import { fetchObjects } from '../../api/objects';
import { buildObjectThreatMatches, formatRiskPercent, getRiskLabel } from '../../utils/matchingMatrix';
import { getThreatCategoryLabel } from '../../utils/threatLabels';

const reportKinds = [
  'Отчет за сутки',
  'Отчет за период',
  'Отчет по объекту',
];

function safeDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical') return 'high';
  if (normalized === 'high' || normalized === 'medium' || normalized === 'low') return normalized;
  return 'low';
}

function severityWeight(value) {
  const severity = normalizeSeverity(value);
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function clipText(value, maxLen = 140) {
  const text = String(value || '').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function getThreatDate(item) {
  return safeDate(
    item?.publishedAt ||
      item?.published_at ||
      item?.extracted_at ||
      item?.createdAt ||
      item?.updatedAt,
  );
}

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
  reportDate: '',
  dateFrom: '',
  dateTo: '',
  objectName: '',
  selectedObjectId: '',
  objectItems: [],
  threatItems: [],
  isObjectPickerOpen: false,
  isLoadingData: false,
  dataError: '',
  includeCharts: true,
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
  if (state.reportKind === 'Отчет за сутки') {
    return `Дата отчета: ${formatDisplayDate(state.reportDate)}`;
  }
  if (state.reportKind === 'Отчет по объекту') {
    return 'Формат: по объекту';
  }

  const from = formatDisplayDate(state.dateFrom);
  const to = formatDisplayDate(state.dateTo);
  return `Период: ${from} - ${to}`;
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

  componentDidMount() {
    this.loadReportData();
  }

  loadReportData = async () => {
    this.setState({ isLoadingData: true, dataError: '' });
    try {
      const [threatItems, objectItems] = await Promise.all([
        fetchAllModelThreats(),
        fetchObjects(),
      ]);
      this.setState({
        threatItems: Array.isArray(threatItems) ? threatItems : [],
        objectItems: Array.isArray(objectItems) ? objectItems : [],
      });
    } catch (error) {
      this.setState({ dataError: error?.message || 'Не удалось загрузить данные для отчета.' });
    } finally {
      this.setState({ isLoadingData: false });
    }
  };

  handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    this.setState({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  openObjectPicker = () => {
    this.setState({ isObjectPickerOpen: true });
  };

  closeObjectPicker = () => {
    this.setState({ isObjectPickerOpen: false });
  };

  selectObject = (objectItem) => {
    this.setState({
      selectedObjectId: objectItem?._id || '',
      objectName: objectItem?.name || '',
      isObjectPickerOpen: false,
    });
  };

  getFilteredThreats = () => {
    const { reportKind, reportDate, dateFrom, dateTo, threatItems } = this.state;
    const safeItems = Array.isArray(threatItems) ? threatItems : [];

    if (reportKind === 'Отчет по объекту') {
      return safeItems;
    }

    if (reportKind === 'Отчет за сутки' && reportDate) {
      const target = safeDate(reportDate);
      if (!target) return [];
      const start = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return safeItems.filter((item) => {
        const published = getThreatDate(item);
        if (!published) return false;
        const time = published.getTime();
        return time >= start && time < end;
      });
    }

    if (reportKind === 'Отчет за период') {
      const from = dateFrom ? safeDate(dateFrom) : null;
      const to = dateTo ? safeDate(dateTo) : null;
      const start = from
        ? new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
        : Number.NEGATIVE_INFINITY;
      const end = to
        ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime()
        : Number.POSITIVE_INFINITY;
      return safeItems.filter((item) => {
        const published = getThreatDate(item);
        if (!published) return false;
        const time = published.getTime();
        return time >= start && time < end;
      });
    }

    return safeItems;
  };

  getSelectedObject = () => {
    const { selectedObjectId, objectItems } = this.state;
    return (Array.isArray(objectItems) ? objectItems : []).find((item) => String(item._id) === String(selectedObjectId));
  };

  buildPreviewData = () => {
    const sourceItems = this.getFilteredThreats();
    const high = sourceItems.filter((item) => normalizeSeverity(item.severity) === 'high').length;
    const medium = sourceItems.filter((item) => normalizeSeverity(item.severity) === 'medium').length;
    const low = sourceItems.filter((item) => normalizeSeverity(item.severity) === 'low').length;
    const avgConfidence = sourceItems.length
      ? sourceItems.reduce((sum, item) => sum + Number(item.llm_confidence || 0), 0) / sourceItems.length
      : 0;

    const byDay = new Map();
    sourceItems.forEach((item) => {
      const date = getThreatDate(item);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      byDay.set(key, (byDay.get(key) || 0) + 1);
    });
    const dayPairs = Array.from(byDay.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .slice(-10);
    const trendChartData = {
      labels: dayPairs.map(([key]) => {
        const [y, m, d] = key.split('-').map(Number);
        return formatDayLabel(new Date(y, m, d));
      }),
      datasets: [
        {
          label: 'Угрозы',
          data: dayPairs.map(([, count]) => count),
          borderColor: '#0090e7',
          backgroundColor: 'rgba(0, 144, 231, 0.16)',
          fill: true,
          tension: 0.25,
        },
      ],
    };

    const byCategory = new Map();
    sourceItems.forEach((item) => {
      const label = getThreatCategoryLabel(item.category || 'Не указана');
      byCategory.set(label, (byCategory.get(label) || 0) + 1);
    });
    const categoryPairs = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
    const categoryChartData = {
      labels: categoryPairs.map(([name]) => name),
      datasets: [
        {
          label: 'Записей',
          data: categoryPairs.map(([, count]) => count),
          backgroundColor: '#00d25b',
          borderColor: '#00b44d',
          borderWidth: 1,
        },
      ],
    };

    return {
      sourceItems,
      previewMetrics: [
        { label: 'Всего угроз', value: String(sourceItems.length), accent: 'primary' },
        { label: 'High / Medium / Low', value: `${high} / ${medium} / ${low}`, accent: 'warning' },
        { label: 'Средняя уверенность', value: `${(avgConfidence * 100).toFixed(1)}%`, accent: 'success' },
      ],
      trendChartData,
      categoryChartData,
      topThreats: [...sourceItems]
        .sort((a, b) => {
          const score = severityWeight(b.severity) - severityWeight(a.severity);
          if (score !== 0) return score;
          return Number(b.llm_confidence || 0) - Number(a.llm_confidence || 0);
        })
        .slice(0, 3),
    };
  };

  buildObjectPreviewData = () => {
    const selectedObject = this.getSelectedObject();
    const allThreats = Array.isArray(this.state.threatItems) ? this.state.threatItems : [];
    if (!selectedObject) {
      return {
        selectedObject: null,
        matches: [],
        topMatches: [],
        trendChartData: { labels: [], datasets: [{ label: 'Риск', data: [] }] },
        categoryChartData: { labels: [], datasets: [{ label: 'Совпадения', data: [] }] },
      };
    }

    const matches = buildObjectThreatMatches(selectedObject, allThreats);
    const topMatches = matches.slice(0, 3);

    const levelCount = new Map();
    topMatches.forEach((item) => {
      const levels = Array.isArray(item.threat?.targeted_levels) ? item.threat.targeted_levels : [];
      levels.forEach((level) => {
        const key = String(level).toUpperCase();
        levelCount.set(key, (levelCount.get(key) || 0) + 1);
      });
    });
    const sortedLevels = Array.from(levelCount.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ru'));

    const byDay = new Map();
    topMatches.forEach((item) => {
      const date = getThreatDate(item.threat);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const prev = byDay.get(key) || 0;
      byDay.set(key, prev + item.score);
    });
    const dayPairs = Array.from(byDay.entries()).sort((a, b) => (a[0] > b[0] ? 1 : -1)).slice(-10);

    return {
      selectedObject,
      matches,
      topMatches,
      trendChartData: {
        labels: dayPairs.map(([key]) => {
          const [y, m, d] = key.split('-').map(Number);
          return formatDayLabel(new Date(y, m, d));
        }),
        datasets: [
          {
            label: 'Суммарный риск',
            data: dayPairs.map(([, value]) => Number(value.toFixed(2))),
            borderColor: '#ffab00',
            backgroundColor: 'rgba(255, 171, 0, 0.16)',
            fill: true,
            tension: 0.25,
          },
        ],
      },
      categoryChartData: {
        labels: sortedLevels.map(([level]) => level),
        datasets: [
          {
            label: 'Совпадения',
            data: sortedLevels.map(([, count]) => count),
            backgroundColor: '#fc424a',
            borderColor: '#e2363e',
            borderWidth: 1,
          },
        ],
      },
    };
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
      reportKind,
      objectName,
      includeCharts,
      isLoadingData,
      dataError,
    } = this.state;

    const isDaily = reportKind === 'Отчет за сутки';
    const isPeriod = reportKind === 'Отчет за период';
    const isObject = reportKind === 'Отчет по объекту';

    const basicPreview = this.buildPreviewData();
    const objectPreview = this.buildObjectPreviewData();
    const title = isDaily
      ? 'Суточный отчет по угрозам'
      : isPeriod
        ? 'Отчет по угрозам за период'
        : `Отчет по объекту: ${objectName || 'не указан'}`;
    const subtitle = isDaily
      ? 'Сводка за выбранную дату'
      : isPeriod
        ? 'Динамика и приоритеты за выбранный интервал'
        : 'Ключевые угрозы и выводы по объекту';

    return (
      <div className="alerta-report-preview">
        <div className="alerta-report-preview__page" ref={this.previewPageRef}>
          <div className="alerta-report-preview__hero">
            <div>
              <span className="alerta-report-preview__eyebrow">{reportKind}</span>
              <h3>{title}</h3>
              <p>{subtitle}</p>
            </div>
          </div>

          {isLoadingData ? <p>Загрузка данных...</p> : null}
          {dataError ? <p className="text-danger">{dataError}</p> : null}

          <div className="alerta-report-preview__metrics">
            {(isObject
              ? [
                  { label: 'Всего совпадений', value: String(objectPreview.matches.length), accent: 'primary' },
                  {
                    label: 'Топ риск',
                    value: objectPreview.topMatches[0] ? formatRiskPercent(objectPreview.topMatches[0].score) : '0%',
                    accent: 'warning',
                  },
                  {
                    label: 'Уровень',
                    value: objectPreview.topMatches[0] ? getRiskLabel(objectPreview.topMatches[0].level) : 'Фоновый',
                    accent: 'success',
                  },
                ]
              : basicPreview.previewMetrics).map((metric) => (
              <div key={metric.label} className={`alerta-report-preview__metric alerta-report-preview__metric--${metric.accent}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <ReportSection title={isObject ? 'Топ 3 опасных угроз для объекта' : 'Топ 3 приоритетные угрозы'}>
            <div className="alerta-report-preview__table">
              <div className="alerta-report-preview__table-row alerta-report-preview__table-row--head">
                <span>Угроза</span>
                <span>Уровень</span>
                <span>Краткий вывод</span>
              </div>
              {(isObject ? objectPreview.topMatches : basicPreview.topThreats).map((item, index) => {
                const threat = isObject ? item.threat : item;
                const level = isObject ? item.level : normalizeSeverity(threat.severity);
                const short =
                  isObject
                    ? clipText((item.reasons || []).join('; ') || threat.interpretation_summary || threat.reasoning)
                    : clipText(threat.interpretation_summary || threat.reasoning || threat.threat_summary);
                return (
                  <div className="alerta-report-preview__table-row" key={`${threat?._id || threat?.title || index}`}>
                    <span>{clipText(threat?.title || 'Без названия', 90)}</span>
                    <span>{isObject ? `${getRiskLabel(level)} (${formatRiskPercent(item.score)})` : String(level).toUpperCase()}</span>
                    <span>{short || 'Без комментария.'}</span>
                  </div>
                );
              })}
            </div>
          </ReportSection>

          {!isObject ? (
            <ReportSection title={isDaily ? 'Суточные показатели' : 'Показатели за период'}>
              <div className="alerta-report-preview__chips">
                <span>Количество собранных угроз: 47</span>
                <span>Разбиение по уровням: {basicPreview.previewMetrics[1]?.value || '0 / 0 / 0'}</span>
                <span>Топ классов: {basicPreview.categoryChartData.labels.slice(0, 3).join(', ') || 'нет данных'}</span>
              </div>
            </ReportSection>
          ) : null}

          {isObject ? (
            <ReportSection title="Выводы по объекту">
              <ul className="alerta-report-preview__list">
                {(objectPreview.topMatches[0]?.reasons || []).map((reason, idx) => (
                  <li key={`reason-${idx}`}>{reason}</li>
                ))}
                {!objectPreview.topMatches[0]?.reasons?.length ? <li>Выберите объект, чтобы увидеть конкретные выводы по рискам.</li> : null}
              </ul>
            </ReportSection>
          ) : null}

          <ReportSection title="Графики">
            {includeCharts ? (
              <div className="alerta-report-preview__chart-block">
                <div className="alerta-report-preview__chart-card">
                  <h6>{isObject ? 'Динамика угроз для объекта' : 'Динамика угроз'}</h6>
                  <div className="alerta-report-preview__chart-canvas">
                    <Line data={isObject ? objectPreview.trendChartData : basicPreview.trendChartData} options={chartOptions} />
                  </div>
                </div>
                <div className="alerta-report-preview__chart-card">
                  <h6>{isObject ? 'Распределение рисков по категориям' : 'Распределение по категориям'}</h6>
                  <div className="alerta-report-preview__chart-canvas">
                    <Bar data={isObject ? objectPreview.categoryChartData : basicPreview.categoryChartData} options={chartOptions} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mb-0">Графики отключены в параметрах отчета.</p>
            )}
          </ReportSection>
        </div>
      </div>
    );
  }

  render() {
    const {
      reportKind,
      reportDate,
      dateFrom,
      dateTo,
      objectName,
      objectItems,
      isObjectPickerOpen,
      selectedObjectId,
      includeCharts,
      isExportingPdf,
    } = this.state;

    const isDaily = reportKind === 'Отчет за сутки';
    const isPeriod = reportKind === 'Отчет за период';
    const isObject = reportKind === 'Отчет по объекту';

    const controlStyle = {
      color: '#ffffff',
      backgroundColor: '#191c24',
      borderColor: '#2c3448',
    };

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
                Шаблон документа
              </li>
            </ol>
          </nav>
        </div>

        <div className="row">
          <div className="col-xl-8 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start mb-3">
                  <div>
                    <h4 className="card-title mb-1">Предпросмотр документа</h4>
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

          <div className="col-xl-4 grid-margin stretch-card">
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
                    style={controlStyle}
                  >
                    {reportKinds.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Form.Group>

                {isDaily ? (
                  <Form.Group>
                    <label htmlFor="reportDate">Дата</label>
                    <Form.Control
                      type="date"
                      id="reportDate"
                      name="reportDate"
                      value={reportDate}
                      onChange={this.handleInputChange}
                      style={controlStyle}
                    />
                  </Form.Group>
                ) : null}

                {isPeriod ? (
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
                          style={controlStyle}
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
                          style={controlStyle}
                        />
                      </Form.Group>
                    </div>
                  </div>
                ) : null}

                <Form.Group>
                  <label htmlFor="objectName">Объект / контур</label>
                  <Form.Control
                    type="text"
                    id="objectName"
                    name="objectName"
                    value={objectName}
                    onChange={this.handleInputChange}
                    style={controlStyle}
                    disabled
                  />
                </Form.Group>

                {isObject ? (
                  <button type="button" className="btn btn-outline-light btn-sm mb-2" onClick={this.openObjectPicker}>
                    Выбрать объект
                  </button>
                ) : null}

                <label className="alerta-report-builder-check mt-3">
                  <input type="checkbox" name="includeCharts" checked={includeCharts} onChange={this.handleInputChange} />
                  <span>Показывать графики в шаблоне</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <Modal show={isObjectPickerOpen} onHide={this.closeObjectPicker} centered>
          <Modal.Header closeButton>
            <Modal.Title>Выберите объект для отчета</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {!objectItems.length ? <p className="mb-0">Список объектов пуст.</p> : null}
            <div className="list-group">
              {objectItems.map((item) => {
                const active = String(selectedObjectId) === String(item._id);
                return (
                  <button
                    type="button"
                    key={item._id}
                    className={`list-group-item list-group-item-action${active ? ' active' : ''}`}
                    onClick={() => this.selectObject(item)}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <strong>{item.name || 'Без имени'}</strong>
                      <span className="small">{item.region || 'Регион не указан'}</span>
                    </div>
                    <div className="small">{clipText(item.comments || item.industry || item.objectType || '', 90)}</div>
                  </button>
                );
              })}
            </div>
          </Modal.Body>
        </Modal>
      </div>
    );
  }
}

export default Mdi;
