import React, { Component } from 'react';
import { fetchArticles } from '../../api/articles';
import {
  getThreatCategoryLabel,
  getThreatSubcategoryLabel,
} from '../../utils/threatLabels';

const DEFAULT_VISIBLE_ROWS = 5;

const TABLE_TEXT_STYLE = {
  color: '#ffffff',
};

const MUTED_TEXT_STYLE = {
  color: '#aab4d0',
};

const FILTER_DROPDOWN_STYLE = {
  zIndex: 30,
  maxHeight: '240px',
  overflowY: 'auto',
  boxShadow: '0 14px 30px rgba(0, 0, 0, 0.28)',
};

const FILTER_LABEL_STYLE = {
  color: '#aab4d0',
};

const FILTER_META_STYLE = {
  color: '#aab4d0',
};

const SEVERITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function formatPublishedAt(value) {
  if (!value) {
    return 'Нет даты';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Нет даты';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function buildPreview(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      preview: 'Содержимое не найдено.',
      fullText: '',
      needsExpand: false,
    };
  }

  const words = normalized.split(/\s+/);
  if (words.length <= 42) {
    return {
      preview: normalized,
      fullText: normalized,
      needsExpand: false,
    };
  }

  return {
    preview: `${words.slice(0, 42).join(' ')}...`,
    fullText: normalized,
    needsExpand: true,
  };
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

class Dropdowns extends Component {
  state = {
    threatItems: [],
    isLoadingThreats: true,
    threatsError: '',
    selectedSources: [],
    selectedCategories: [],
    titleSearch: '',
    sortOrder: 'severity_desc',
    onlyWithContent: false,
    isSourceDropdownOpen: false,
    isCategoryDropdownOpen: false,
    isSortDropdownOpen: false,
    expandedPanels: {
      newsThreats: false,
      telegramThreats: false,
      forumThreats: false,
    },
    openedThreatId: null,
    fullyExpandedThreatId: null,
  };

  componentDidMount() {
    this.loadThreats();
  }

  async loadThreats() {
    this.setState({
      isLoadingThreats: true,
      threatsError: '',
    });

    try {
      const { items } = await fetchArticles({
        page: 1,
        limit: 150,
        includeText: 1,
      });

      const threatItems = Array.isArray(items)
        ? items.filter((item) => item.type === 'threat')
        : [];

      this.setState({
        threatItems,
        isLoadingThreats: false,
      });
    } catch (error) {
      this.setState({
        isLoadingThreats: false,
        threatsError: error.message || 'Не удалось загрузить выявленные угрозы.',
      });
    }
  }

  togglePanel = (panelKey) => {
    this.setState((prevState) => ({
      expandedPanels: {
        ...prevState.expandedPanels,
        [panelKey]: !prevState.expandedPanels[panelKey],
      },
    }));
  };

  toggleThreat = (threatId) => {
    this.setState((prevState) => ({
      openedThreatId: prevState.openedThreatId === threatId ? null : threatId,
      fullyExpandedThreatId:
        prevState.openedThreatId === threatId
          ? null
          : prevState.fullyExpandedThreatId,
    }));
  };

  toggleReadMore = (threatId) => {
    this.setState((prevState) => ({
      fullyExpandedThreatId:
        prevState.fullyExpandedThreatId === threatId ? null : threatId,
    }));
  };

  handleTitleSearchChange = (event) => {
    this.setState({ titleSearch: event.target.value });
  };

  handleOnlyWithContentChange = (event) => {
    this.setState({ onlyWithContent: event.target.checked });
  };

  resetThreatFilters = () => {
    this.setState({
      selectedSources: [],
      selectedCategories: [],
      titleSearch: '',
      sortOrder: 'severity_desc',
      onlyWithContent: false,
      isSourceDropdownOpen: false,
      isCategoryDropdownOpen: false,
      isSortDropdownOpen: false,
    });
  };

  toggleSourceDropdown = () => {
    this.setState((prevState) => ({
      isSourceDropdownOpen: !prevState.isSourceDropdownOpen,
      isCategoryDropdownOpen: false,
      isSortDropdownOpen: false,
    }));
  };

  toggleCategoryDropdown = () => {
    this.setState((prevState) => ({
      isCategoryDropdownOpen: !prevState.isCategoryDropdownOpen,
      isSourceDropdownOpen: false,
      isSortDropdownOpen: false,
    }));
  };

  toggleSortDropdown = () => {
    this.setState((prevState) => ({
      isSortDropdownOpen: !prevState.isSortDropdownOpen,
      isSourceDropdownOpen: false,
      isCategoryDropdownOpen: false,
    }));
  };

  toggleSourceOption = (source) => {
    this.setState((prevState) => {
      const isSelected = prevState.selectedSources.includes(source);

      return {
        selectedSources: isSelected
          ? prevState.selectedSources.filter((item) => item !== source)
          : [...prevState.selectedSources, source],
      };
    });
  };

  toggleCategoryOption = (category) => {
    this.setState((prevState) => {
      const isSelected = prevState.selectedCategories.includes(category);

      return {
        selectedCategories: isSelected
          ? prevState.selectedCategories.filter((item) => item !== category)
          : [...prevState.selectedCategories, category],
      };
    });
  };

  selectSortOrder = (sortOrder) => {
    this.setState({
      sortOrder,
      isSortDropdownOpen: false,
    });
  };

  getFilteredThreatItems() {
    const {
      threatItems,
      selectedSources,
      selectedCategories,
      titleSearch,
      sortOrder,
      onlyWithContent,
    } = this.state;

    const normalizedSearch = titleSearch.trim().toLowerCase();

    const filteredItems = threatItems.filter((item) => {
      const source = normalizeText(item.source);
      const title = normalizeText(item.title).toLowerCase();
      const category = normalizeText(item.category);
      const text = normalizeText(item.text);

      const matchesSource =
        selectedSources.length === 0 || selectedSources.includes(source);
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(category);
      const matchesTitle =
        !normalizedSearch || title.includes(normalizedSearch);
      const matchesContent = !onlyWithContent || text.length > 0;

      return matchesSource && matchesCategory && matchesTitle && matchesContent;
    });

    return filteredItems.sort((left, right) => {
      if (sortOrder === 'severity_desc') {
        return (SEVERITY_ORDER[right.severity] || 0) - (SEVERITY_ORDER[left.severity] || 0);
      }

      if (sortOrder === 'severity_asc') {
        return (SEVERITY_ORDER[left.severity] || 0) - (SEVERITY_ORDER[right.severity] || 0);
      }

      if (sortOrder === 'category_asc') {
        return normalizeText(left.category).localeCompare(normalizeText(right.category), 'ru');
      }

      if (sortOrder === 'category_desc') {
        return normalizeText(right.category).localeCompare(normalizeText(left.category), 'ru');
      }

      return 0;
    });
  }

  renderMultiSelectDropdown({
    label,
    selectedLabel,
    options,
    selectedValues,
    isOpen,
    onToggle,
    onOptionToggle,
    isInteractive,
    formatOptionLabel = (value) => value,
  }) {
    return (
      <div className="position-relative">
        <label className="mb-2 small d-block" style={FILTER_LABEL_STYLE}>
          {label}
        </label>
        <button
          type="button"
          className="form-control alerta-filter-control d-flex align-items-center justify-content-between text-left"
          onClick={isInteractive ? onToggle : undefined}
          disabled={!isInteractive}
        >
          <span className="text-truncate pr-3 alerta-filter-control__text">
            {selectedLabel}
          </span>
          <i
            className={`mdi ${isInteractive && isOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}`}
            style={FILTER_META_STYLE}
          ></i>
        </button>

        {isInteractive && isOpen ? (
          <div
            className="border rounded mt-2 px-3 py-3 position-absolute w-100 alerta-filter-dropdown"
            style={FILTER_DROPDOWN_STYLE}
          >
            {options.map((option) => (
              <div className="form-check mb-2" key={option}>
                <label className="form-check-label alerta-filter-option">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selectedValues.includes(option)}
                    onChange={() => onOptionToggle(option)}
                  />
                  {formatOptionLabel(option)}
                  <i className="input-helper"></i>
                </label>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  renderSortDropdown({ isInteractive, sortOrder }) {
    const sortLabelMap = {
      severity_desc: 'Сначала более опасные',
      severity_asc: 'Сначала менее опасные',
      category_asc: 'Категории А-Я',
      category_desc: 'Категории Я-А',
    };

    return (
      <div className="position-relative">
        <label className="mb-2 small d-block" style={FILTER_LABEL_STYLE}>
          Сортировка
        </label>
        <button
          type="button"
          className="form-control alerta-filter-control d-flex align-items-center justify-content-between text-left"
          onClick={isInteractive ? this.toggleSortDropdown : undefined}
          disabled={!isInteractive}
        >
          <span className="text-truncate pr-3 alerta-filter-control__text">
            {sortLabelMap[sortOrder] || 'Сначала более опасные'}
          </span>
          <i
            className={`mdi ${isInteractive && this.state.isSortDropdownOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'}`}
            style={FILTER_META_STYLE}
          ></i>
        </button>

        {isInteractive && this.state.isSortDropdownOpen ? (
          <div
            className="border rounded mt-2 px-2 py-2 position-absolute w-100 alerta-filter-dropdown"
            style={FILTER_DROPDOWN_STYLE}
          >
            <button
              type="button"
              className="btn btn-link alerta-filter-menu-item text-left"
              onClick={() => this.selectSortOrder('severity_desc')}
            >
              Сначала более опасные
            </button>
            <button
              type="button"
              className="btn btn-link alerta-filter-menu-item text-left"
              onClick={() => this.selectSortOrder('severity_asc')}
            >
              Сначала менее опасные
            </button>
            <button
              type="button"
              className="btn btn-link alerta-filter-menu-item text-left"
              onClick={() => this.selectSortOrder('category_asc')}
            >
              Категории А-Я
            </button>
            <button
              type="button"
              className="btn btn-link alerta-filter-menu-item text-left"
              onClick={() => this.selectSortOrder('category_desc')}
            >
              Категории Я-А
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  renderThreatFilterPanel({
    sourceOptions = [],
    categoryOptions = [],
    selectedSourcesLabel = 'Все источники',
    selectedCategoriesLabel = 'Все категории',
    titleSearch = '',
    sortOrder = 'severity_desc',
    onlyWithContent = false,
    resultCount = null,
    isInteractive = false,
  }) {
    return (
      <div className="border rounded px-3 px-xl-4 py-3 mb-4">
        <div className="row">
          <div className="col-12 col-xl-3 mb-3 mb-xl-0">
            {this.renderMultiSelectDropdown({
              label: 'Источники',
              selectedLabel: selectedSourcesLabel,
              options: sourceOptions,
              selectedValues: this.state.selectedSources,
              isOpen: this.state.isSourceDropdownOpen,
              onToggle: this.toggleSourceDropdown,
              onOptionToggle: this.toggleSourceOption,
              isInteractive,
            })}
          </div>

          <div className="col-12 col-xl-3 mb-3 mb-xl-0">
            {this.renderMultiSelectDropdown({
              label: 'Категории угроз',
              selectedLabel: selectedCategoriesLabel,
              options: categoryOptions,
              selectedValues: this.state.selectedCategories,
              isOpen: this.state.isCategoryDropdownOpen,
              onToggle: this.toggleCategoryDropdown,
              onOptionToggle: this.toggleCategoryOption,
              isInteractive,
              formatOptionLabel: (value) => getThreatCategoryLabel(value),
            })}
          </div>

          <div className="col-12 col-xl-3 mb-3 mb-xl-0">
            <label className="mb-2 small d-block" style={FILTER_LABEL_STYLE}>
              Поиск по заголовкам
            </label>
            <input
              type="text"
              className="form-control alerta-filter-control"
              placeholder="Поиск по названию публикации"
              value={titleSearch}
              onChange={isInteractive ? this.handleTitleSearchChange : undefined}
              disabled={!isInteractive}
            />
          </div>

          <div className="col-12 col-xl-3">
            {this.renderSortDropdown({
              isInteractive,
              sortOrder,
            })}
          </div>
        </div>

        <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between mt-3 pt-3 border-top">
          <div className="form-check mb-3 mb-xl-0">
            <label className="form-check-label" style={{ color: '#ffffff' }}>
              <input
                type="checkbox"
                className="form-check-input"
                checked={onlyWithContent}
                onChange={isInteractive ? this.handleOnlyWithContentChange : undefined}
                disabled={!isInteractive}
              />
              Показывать только записи с содержимым
              <i className="input-helper"></i>
            </label>
          </div>

          <div className="d-flex align-items-center">
            <span className="small mr-3" style={FILTER_META_STYLE}>
              {resultCount !== null
                ? `Найдено угроз: ${resultCount}`
                : 'Фильтры будут активны после подключения источника'}
            </span>
            <button
              type="button"
              className="btn btn-sm alerta-filter-reset-button"
              onClick={isInteractive ? this.resetThreatFilters : undefined}
              disabled={!isInteractive}
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderExpandedThreatRow(item) {
    const textState = buildPreview(item.text);
    const showFullText = this.state.fullyExpandedThreatId === item._id;

    return (
      <tr key={`${item._id}-expanded`}>
        <td colSpan="6" className="border-top-0 pt-0">
          <div
            className="border rounded p-4 mt-2"
            style={{
              backgroundColor: '#191c24',
              borderColor: '#2c3553',
              color: '#ffffff',
            }}
          >
            <div className="mb-3">
              <div className="small mb-2" style={MUTED_TEXT_STYLE}>
                {item.source || 'Не указан'}
              </div>
              <h5 className="mb-2" style={TABLE_TEXT_STYLE}>
                {item.title || 'Без заголовка'}
              </h5>
              <div className="small" style={MUTED_TEXT_STYLE}>
                {formatPublishedAt(item.publishedAt)}
              </div>
            </div>
            <div className="mb-2">
              <span className={`badge ${getSeverityBadgeClass(item.severity)}`}>
                {item.severity || 'n/a'}
              </span>
            </div>
            <div
              className="mb-3"
              style={{
                whiteSpace: 'pre-line',
                lineHeight: 1.7,
                color: '#ffffff',
              }}
            >
              {showFullText ? textState.fullText : textState.preview}
            </div>
            <div className="d-flex flex-wrap align-items-center">
              {textState.needsExpand ? (
                <button
                  type="button"
                  className="btn btn-link pl-0 pr-3"
                  onClick={() => this.toggleReadMore(item._id)}
                >
                  {showFullText ? 'Скрыть' : 'Читать далее'}
                </button>
              ) : null}
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-primary btn-sm"
                >
                  Перейти к источнику
                </a>
              ) : null}
            </div>
          </div>
        </td>
      </tr>
    );
  }

  renderSeverityCell(severity) {
    return (
      <div className={`badge ${getSeverityBadgeClass(severity)}`}>
        {severity || 'n/a'}
      </div>
    );
  }

  renderThreatDatabaseCard({
    panelKey,
    title,
    description,
    items,
    isLoading,
    error,
    placeholder,
    filters,
  }) {
    const isExpanded = this.state.expandedPanels[panelKey];
    const visibleItems = isExpanded ? items : items.slice(0, DEFAULT_VISIBLE_ROWS);
    const scrollContainerStyle = isExpanded
      ? {
          height: '72vh',
          overflowY: 'auto',
          paddingRight: '0.25rem',
        }
      : null;

    return (
      <div className="col-12 grid-margin stretch-card" key={panelKey}>
        <div className="card">
          <div className="card-body">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between mb-3">
              <div className="mb-3 mb-lg-0">
                <h4 className="card-title mb-2">{title}</h4>
                <p className="card-description mb-0">{description}</p>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => this.togglePanel(panelKey)}
              >
                {isExpanded ? 'Свернуть' : 'Расширить'}
              </button>
            </div>

            {filters || null}

            {isLoading ? <p className="mb-0">Загрузка содержимого...</p> : null}
            {error ? <p className="text-danger mb-0">{error}</p> : null}
            {!isLoading && !error && items.length === 0 ? (
              <p className="mb-0 text-muted">{placeholder}</p>
            ) : null}

            {!isLoading && !error && visibleItems.length > 0 ? (
              <div style={scrollContainerStyle}>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={TABLE_TEXT_STYLE}>Источник</th>
                        <th style={TABLE_TEXT_STYLE}>Заголовок</th>
                        <th style={TABLE_TEXT_STYLE}>Категория угрозы</th>
                        <th style={TABLE_TEXT_STYLE}>Подкатегория угрозы</th>
                        <th style={TABLE_TEXT_STYLE}>Уровень опасности</th>
                        <th style={TABLE_TEXT_STYLE}>Ссылка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => {
                        const isOpened = this.state.openedThreatId === item._id;

                        return (
                          <React.Fragment key={item._id}>
                            <tr
                              onClick={() => this.toggleThreat(item._id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td style={TABLE_TEXT_STYLE}>{item.source || 'Не указан'}</td>
                              <td style={TABLE_TEXT_STYLE}>{item.title || 'Без заголовка'}</td>
                              <td style={TABLE_TEXT_STYLE}>
                                {getThreatCategoryLabel(item.category)}
                              </td>
                              <td style={TABLE_TEXT_STYLE}>
                                {getThreatSubcategoryLabel(item.subcategory)}
                              </td>
                              <td>{this.renderSeverityCell(item.severity)}</td>
                              <td>
                                {item.url ? (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    Открыть
                                  </a>
                                ) : (
                                  <span style={MUTED_TEXT_STYLE}>Нет ссылки</span>
                                )}
                              </td>
                            </tr>
                            {isOpened ? this.renderExpandedThreatRow(item) : null}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  render() {
    const filteredThreatItems = this.getFilteredThreatItems();
    const sourceOptions = Array.from(
      new Set(
        this.state.threatItems
          .map((item) => normalizeText(item.source))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, 'ru'));

    const categoryOptions = Array.from(
      new Set(
        this.state.threatItems
          .map((item) => normalizeText(item.category))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right, 'ru'));

    const selectedSourcesLabel =
      this.state.selectedSources.length === 0
        ? 'Все источники'
        : this.state.selectedSources.length === 1
          ? this.state.selectedSources[0]
          : `Выбрано источников: ${this.state.selectedSources.length}`;

    const selectedCategoriesLabel =
      this.state.selectedCategories.length === 0
        ? 'Все категории'
        : this.state.selectedCategories.length === 1
          ? getThreatCategoryLabel(this.state.selectedCategories[0])
          : `Выбрано категорий: ${this.state.selectedCategories.length}`;

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Выявленные угрозы</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Содержание
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Выявленные угрозы
              </li>
            </ol>
          </nav>
        </div>

        <div className="row">
          {this.renderThreatDatabaseCard({
            panelKey: 'newsThreats',
            title: 'Выявленные угрозы',
            description:
              'Структурированная лента угроз, выделенных из новостных источников с раскрытием содержания и быстрым просмотром.',
            items: filteredThreatItems,
            isLoading: this.state.isLoadingThreats,
            error: this.state.threatsError,
            placeholder: 'Записи с угрозами пока не загружены.',
            filters: this.renderThreatFilterPanel({
              sourceOptions,
              categoryOptions,
              selectedSourcesLabel,
              selectedCategoriesLabel,
              titleSearch: this.state.titleSearch,
              sortOrder: this.state.sortOrder,
              onlyWithContent: this.state.onlyWithContent,
              resultCount: filteredThreatItems.length,
              isInteractive: true,
            }),
          })}

          {this.renderThreatDatabaseCard({
            panelKey: 'telegramThreats',
            title: 'Выявленные угрозы',
            description:
              'Контур выявленных угроз из Telegram-каналов будет подключён следующим этапом в том же формате.',
            items: [],
            isLoading: false,
            error: '',
            placeholder:
              'Telegram-контур угроз пока обозначен. После интеграции здесь появятся классифицированные записи.',
            filters: this.renderThreatFilterPanel({
              selectedSourcesLabel: 'Источники Telegram',
              selectedCategoriesLabel: 'Категории Telegram',
              resultCount: null,
              isInteractive: false,
            }),
          })}

          {this.renderThreatDatabaseCard({
            panelKey: 'forumThreats',
            title: 'Выявленные угрозы',
            description:
              'Зона для дальнейшего подключения форумных и теневых источников с той же механикой фильтрации.',
            items: [],
            isLoading: false,
            error: '',
            placeholder:
              'Форумный контур угроз пока обозначен как следующий этап интеграции.',
            filters: this.renderThreatFilterPanel({
              selectedSourcesLabel: 'Источники форумов',
              selectedCategoriesLabel: 'Категории форумов',
              resultCount: null,
              isInteractive: false,
            }),
          })}
        </div>
      </div>
    );
  }
}

export default Dropdowns;
