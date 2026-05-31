import React, { Component } from 'react';
import { fetchAllArticles } from '../../api/articles';
import { buildInterpretationMeta } from '../../utils/interpretation';

const PREVIEW_WORD_LIMIT = 42;
const DEFAULT_VISIBLE_ROWS = 5;
const FILTER_DEFAULTS = {
  selectedSources: [],
  titleSearch: '',
  sortOrder: 'newest',
  onlyWithContent: false,
  isSourceDropdownOpen: false,
  isSortDropdownOpen: false,
};

function getCollectionName(item) {
  return String(item?.dbCollection || '').trim().toLowerCase();
}
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

function buildPreview(text) {
  const normalized = (text || '').trim();
  if (!normalized) {
    return {
      preview: 'Содержимое не найдено.',
      fullText: '',
      needsExpand: false,
    };
  }

  const words = normalized.split(/\s+/);
  if (words.length <= PREVIEW_WORD_LIMIT) {
    return {
      preview: normalized,
      fullText: normalized,
      needsExpand: false,
    };
  }

  return {
    preview: `${words.slice(0, PREVIEW_WORD_LIMIT).join(' ')}...`,
    fullText: normalized,
    needsExpand: true,
  };
}

function getRowId(item, index = 0) {
  if (item && item._id) {
    return String(item._id);
  }

  const source = String(item?.source || '').trim();
  const title = String(item?.title || '').trim();
  const date = String(item?.publishedAt || item?.extracted_at || '').trim();
  const url = String(item?.url || '').trim();
  return `${source}|${title}|${date}|${url}|${index}`;
}

class Buttons extends Component {
  state = {
    newsItems: [],
    isLoadingNews: true,
    newsError: '',
    filters: {
      news: { ...FILTER_DEFAULTS },
      telegram: { ...FILTER_DEFAULTS },
      forums: { ...FILTER_DEFAULTS },
    },
    expandedPanels: {
      news: false,
      telegram: false,
      forums: false,
    },
    openedArticleId: null,
    fullyExpandedArticleId: null,
  };

  filteredItemsCache = new Map();

  componentDidMount() {
    this.loadNews();
  }

  async loadNews() {
    this.setState({
      isLoadingNews: true,
      newsError: '',
    });

    try {
      const { items } = await fetchAllArticles({
        includeText: 1,
      });

      this.setState({
        newsItems: Array.isArray(items) ? items : [],
        isLoadingNews: false,
      });
    } catch (error) {
      this.setState({
        isLoadingNews: false,
        newsError: error.message || 'Не удалось загрузить содержимое базы данных.',
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

  toggleArticle = (articleId) => {
    this.setState((prevState) => ({
      openedArticleId:
        prevState.openedArticleId === articleId ? null : articleId,
      fullyExpandedArticleId:
        prevState.openedArticleId === articleId
          ? null
          : prevState.fullyExpandedArticleId,
    }));
  };

  toggleReadMore = (articleId) => {
    this.setState((prevState) => ({
      fullyExpandedArticleId:
        prevState.fullyExpandedArticleId === articleId ? null : articleId,
    }));
  };

  updateFilters = (panelKey, updater) => {
    this.setState((prevState) => {
      const current = prevState.filters[panelKey] || FILTER_DEFAULTS;
      const nextPanelState =
        typeof updater === 'function' ? updater(current) : updater;

      return {
        filters: {
          ...prevState.filters,
          [panelKey]: {
            ...current,
            ...nextPanelState,
          },
        },
      };
    });
  };

  handleTitleSearchChange = (panelKey, event) => {
    const value = event.target.value;
    this.updateFilters(panelKey, { titleSearch: value });
  };

  handleOnlyWithContentChange = (panelKey, event) => {
    this.updateFilters(panelKey, { onlyWithContent: event.target.checked });
  };

  resetFilters = (panelKey) => {
    this.updateFilters(panelKey, { ...FILTER_DEFAULTS });
  };

  toggleSourceDropdown = (panelKey) => {
    this.updateFilters(panelKey, (prevPanel) => ({
      isSourceDropdownOpen: !prevPanel.isSourceDropdownOpen,
      isSortDropdownOpen: false,
    }));
  };

  toggleSortDropdown = (panelKey) => {
    this.updateFilters(panelKey, (prevPanel) => ({
      isSortDropdownOpen: !prevPanel.isSortDropdownOpen,
      isSourceDropdownOpen: false,
    }));
  };

  selectSortOrder = (panelKey, sortOrder) => {
    this.updateFilters(panelKey, {
      sortOrder,
      isSortDropdownOpen: false,
    });
  };

  toggleSourceOption = (panelKey, source) => {
    this.updateFilters(panelKey, (prevPanel) => {
      const isSelected = prevPanel.selectedSources.includes(source);
      return {
        selectedSources: isSelected
          ? prevPanel.selectedSources.filter((item) => item !== source)
          : [...prevPanel.selectedSources, source],
      };
    });
  };

  getFilteredItemsForPanel(panelKey, baseItems) {
    const filter = this.state.filters[panelKey] || FILTER_DEFAULTS;
    const selectedSources = filter.selectedSources || [];
    const titleSearch = filter.titleSearch || '';
    const sortOrder = filter.sortOrder || 'newest';
    const onlyWithContent = Boolean(filter.onlyWithContent);
    const normalizedSearch = titleSearch.trim().toLowerCase();
    const cacheKey = JSON.stringify({
      panelKey,
      selectedSources,
      normalizedSearch,
      sortOrder,
      onlyWithContent,
      itemCount: baseItems.length,
    });

    const cached = this.filteredItemsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const filteredItems = baseItems.filter((item) => {
      const source = item.source || '';
      const title = item.title || '';
      const text = item.text || '';
      const matchesSource =
        selectedSources.length === 0 || selectedSources.includes(source);
      const matchesTitle =
        !normalizedSearch || title.toLowerCase().includes(normalizedSearch);
      const matchesContent = !onlyWithContent || text.trim().length > 0;

      return matchesSource && matchesTitle && matchesContent;
    });

    const sorted = filteredItems.sort((left, right) => {
      const leftDate = new Date(left.publishedAt || 0).getTime();
      const rightDate = new Date(right.publishedAt || 0).getTime();

      if (sortOrder === 'oldest') {
        return leftDate - rightDate;
      }

      return rightDate - leftDate;
    });
    this.filteredItemsCache.clear();
    this.filteredItemsCache.set(cacheKey, sorted);
    return sorted;
  }

  renderFilterPanel({
    panelKey,
    sources = [],
    selectedSourcesLabel = 'Все источники',
    selectedSources = [],
    titleSearch = '',
    sortOrder = 'newest',
    onlyWithContent = false,
    resultCount = null,
    isInteractive = false,
  }) {
    const sortOrderLabel =
      sortOrder === 'oldest' ? 'Сначала старые' : 'Сначала новые';

    return (
      <div className="border rounded px-3 px-xl-4 py-3 mb-4">
        <div className="row">
          <div className="col-12 col-xl-4 mb-3 mb-xl-0">
            <label className="mb-2 text-muted small d-block">
              Источники
            </label>
            <div className="position-relative">
              <button
                type="button"
                className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-between"
                onClick={
                  isInteractive
                    ? () => this.toggleSourceDropdown(panelKey)
                    : undefined
                }
                disabled={!isInteractive}
              >
                <span className="text-truncate pr-3">
                  {selectedSourcesLabel}
                </span>
                <i
                  className={`mdi ${
                    isInteractive &&
                    (this.state.filters[panelKey] || FILTER_DEFAULTS)
                      .isSourceDropdownOpen
                      ? 'mdi-chevron-up'
                      : 'mdi-chevron-down'
                  }`}
                ></i>
              </button>

              {isInteractive &&
              (this.state.filters[panelKey] || FILTER_DEFAULTS)
                .isSourceDropdownOpen ? (
                <div
                  className="border rounded mt-2 px-3 py-3 bg-dark position-absolute w-100"
                  style={{
                    zIndex: 30,
                    maxHeight: '240px',
                    overflowY: 'auto',
                    boxShadow: '0 14px 30px rgba(0, 0, 0, 0.28)',
                  }}
                >
                  {sources.map((source) => (
                    <div className="form-check mb-2" key={source}>
                      <label className="form-check-label">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedSources.includes(source)}
                          onChange={() => this.toggleSourceOption(panelKey, source)}
                        />
                        {source}
                        <i className="input-helper"></i>
                      </label>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="col-12 col-xl-4 mb-3 mb-xl-0">
            <label className="mb-2 text-muted small d-block">
              Поиск по заголовкам
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Поиск по названию публикации"
              value={titleSearch}
              onChange={
                isInteractive
                  ? (event) => this.handleTitleSearchChange(panelKey, event)
                  : undefined
              }
              disabled={!isInteractive}
            />
          </div>

          <div className="col-12 col-xl-4">
            <label className="mb-2 text-muted small d-block">
              Сортировка по дате
            </label>
            <div className="position-relative">
              <button
                type="button"
                className="form-control alerta-filter-control d-flex align-items-center justify-content-between text-left"
                onClick={
                  isInteractive ? () => this.toggleSortDropdown(panelKey) : undefined
                }
                disabled={!isInteractive}
              >
                <span className="text-truncate pr-3 alerta-filter-control__text">
                  {sortOrderLabel}
                </span>
                <i
                  className={`mdi ${
                    isInteractive &&
                    (this.state.filters[panelKey] || FILTER_DEFAULTS).isSortDropdownOpen
                      ? 'mdi-chevron-up'
                      : 'mdi-chevron-down'
                  }`}
                ></i>
              </button>

              {isInteractive &&
              (this.state.filters[panelKey] || FILTER_DEFAULTS).isSortDropdownOpen ? (
                <div
                  className="border rounded mt-2 px-2 py-2 position-absolute w-100 alerta-filter-dropdown"
                  style={{
                    zIndex: 30,
                    maxHeight: '240px',
                    overflowY: 'auto',
                    boxShadow: '0 14px 30px rgba(0, 0, 0, 0.28)',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-link alerta-filter-menu-item text-left"
                    onClick={() => this.selectSortOrder(panelKey, 'newest')}
                  >
                    Сначала новые
                  </button>
                  <button
                    type="button"
                    className="btn btn-link alerta-filter-menu-item text-left"
                    onClick={() => this.selectSortOrder(panelKey, 'oldest')}
                  >
                    Сначала старые
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between mt-3 pt-3 border-top">
          <div className="form-check mb-3 mb-xl-0">
            <label className="form-check-label">
              <input
                type="checkbox"
                className="form-check-input"
                checked={onlyWithContent}
                onChange={
                  isInteractive
                    ? (event) => this.handleOnlyWithContentChange(panelKey, event)
                    : undefined
                }
                disabled={!isInteractive}
              />
              Показывать только записи с содержимым
              <i className="input-helper"></i>
            </label>
          </div>

          <div className="d-flex align-items-center">
            <span className="text-muted small mr-3">
              {resultCount !== null
                ? `Найдено записей: ${resultCount}`
                : 'Фильтры будут активны после подключения источника'}
            </span>
            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={isInteractive ? () => this.resetFilters(panelKey) : undefined}
              disabled={!isInteractive}
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderArticleDatabaseCard({
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
    const visibleItems = isExpanded
      ? items
      : items.slice(0, DEFAULT_VISIBLE_ROWS);
    const scrollContainerStyle = {
      maxHeight: isExpanded ? '72vh' : '40vh',
      overflowY: 'auto',
      paddingRight: '0.25rem',
    };

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
                <div className="table-responsive alerta-db-table-wrap">
                  <table className="table text-white alerta-db-table">
                    <thead>
                      <tr>
                        <th>Источник</th>
                        <th>Заголовок</th>
                        <th className="text-left">Дата публикации</th>
                        <th className="text-left">Ссылка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item, index) => {
                        const rowId = `${panelKey}::${getRowId(item, index)}`;
                        const isOpened = this.state.openedArticleId === rowId;

                        return (
                          <React.Fragment key={rowId}>
                            <tr
                              onClick={() => this.toggleArticle(rowId)}
                              className="text-white alerta-db-row"
                              style={{ cursor: 'pointer' }}
                            >
                              <td>{item.source || 'Не указан'}</td>
                              <td>{item.title || 'Без заголовка'}</td>
                              <td className="text-left">
                                {formatPublishedAt(item.publishedAt)}
                              </td>
                              <td className="text-left">
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
                                  <span className="text-muted">Нет ссылки</span>
                                )}
                              </td>
                            </tr>
                            {isOpened ? this.renderExpandedArticleRow(item, rowId) : null}
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

  renderExpandedArticleRow(item, rowId) {
    const textState = buildPreview(item.text);
    const showFullText = this.state.fullyExpandedArticleId === rowId;
    const interpretation = buildInterpretationMeta(item);

    return (
      <tr key={`${rowId}-expanded`}>
        <td colSpan="4" className="border-top-0 pt-0">
          <div
            className="border rounded p-4 mt-2"
            style={{
              backgroundColor: '#191c24',
              borderColor: '#2c3553',
              color: '#ffffff',
            }}
          >
            <div className="mb-3">
              <div className="text-muted small mb-2">{item.source || 'Не указан'}</div>
              <h5 className="mb-2">{item.title || 'Без заголовка'}</h5>
              <div className="text-muted small">
                {formatPublishedAt(item.publishedAt)}
              </div>
            </div>
            <div className="mb-3 border rounded p-3" style={{ borderColor: '#2c3553' }}>
              <div className="d-flex flex-wrap align-items-center mb-2">
                <span className={interpretation.groundingBadgeClass}>
                  {interpretation.groundingLabel}
                </span>
                <span className="text-muted small ml-2">
                  grounding {interpretation.groundingPercent}
                </span>
              </div>
              <div className="text-muted small mb-2">
                {item.interpretation_summary || 'Интерпретация для этой записи пока не сформирована.'}
              </div>
              <div className="text-muted small">
                {interpretation.primaryReference
                  ? `Reference: ${interpretation.primaryReference.reference_id} (score ${Number(
                      interpretation.primaryReference.score || 0,
                    ).toFixed(2)})`
                  : interpretation.isNovel
                    ? 'Похожа на новую или нетипичную угрозу: эталон не найден'
                    : 'Reference match не найден'}
              </div>
              <div className="text-muted small mt-2">
                Совпадений найдено: {interpretation.matchCount}
              </div>
            </div>
            <div className="mb-3" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
              {showFullText ? textState.fullText : textState.preview}
            </div>
            <div className="d-flex flex-wrap align-items-center">
              {textState.needsExpand ? (
                <button
                  type="button"
                  className="btn btn-link pl-0 pr-3"
                  onClick={() => this.toggleReadMore(rowId)}
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

  render() {
    const telegramItemsBase = this.state.newsItems.filter(
      (item) => getCollectionName(item) === 'model_threat_tg',
    );
    const forumItemsBase = this.state.newsItems.filter(
      (item) => getCollectionName(item) === 'model_threat_forum',
    );
    const newsSiteItemsBase = this.state.newsItems.filter(
      (item) => getCollectionName(item) === 'model_threat_web',
    );

    const newsSiteItems = this.getFilteredItemsForPanel('news', newsSiteItemsBase);
    const telegramItems = this.getFilteredItemsForPanel('telegram', telegramItemsBase);
    const forumItems = this.getFilteredItemsForPanel('forums', forumItemsBase);

    const uniqueSources = Array.from(
      new Set(
        newsSiteItems
          .map((item) => item.source)
          .filter((source) => Boolean(source)),
      ),
    ).sort((left, right) => left.localeCompare(right, 'ru'));
    const newsFilters = this.state.filters.news || FILTER_DEFAULTS;
    const telegramFilters = this.state.filters.telegram || FILTER_DEFAULTS;
    const forumFilters = this.state.filters.forums || FILTER_DEFAULTS;
    const selectedSourcesLabel =
      newsFilters.selectedSources.length === 0
        ? 'Все источники'
        : newsFilters.selectedSources.length === 1
          ? newsFilters.selectedSources[0]
          : `Выбрано источников: ${newsFilters.selectedSources.length}`;
    const telegramSources = Array.from(
      new Set(
        telegramItemsBase
          .map((item) => item.source)
          .filter((source) => Boolean(source)),
      ),
    ).sort((left, right) => left.localeCompare(right, 'ru'));
    const forumSources = Array.from(
      new Set(
        forumItemsBase
          .map((item) => item.source)
          .filter((source) => Boolean(source)),
      ),
    ).sort((left, right) => left.localeCompare(right, 'ru'));
    const selectedTelegramSourcesLabel =
      telegramFilters.selectedSources.length === 0
        ? 'Все источники'
        : telegramFilters.selectedSources.length === 1
          ? telegramFilters.selectedSources[0]
          : `Выбрано источников: ${telegramFilters.selectedSources.length}`;
    const selectedForumSourcesLabel =
      forumFilters.selectedSources.length === 0
        ? 'Все источники'
        : forumFilters.selectedSources.length === 1
          ? forumFilters.selectedSources[0]
          : `Выбрано источников: ${forumFilters.selectedSources.length}`;

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">База данных</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Содержание
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                База данных
              </li>
            </ol>
          </nav>
        </div>

        <div className="row">
          {this.renderArticleDatabaseCard({
            panelKey: 'news',
            title: 'Новостные сайты',
            items: newsSiteItems,
            isLoading: this.state.isLoadingNews,
            error: this.state.newsError,
            placeholder: 'Новостные записи пока не загружены.',
            filters: this.renderFilterPanel({
              panelKey: 'news',
              sources: uniqueSources,
              selectedSourcesLabel,
              selectedSources: newsFilters.selectedSources,
              titleSearch: newsFilters.titleSearch,
              sortOrder: newsFilters.sortOrder,
              onlyWithContent: newsFilters.onlyWithContent,
              resultCount: newsSiteItems.length,
              isInteractive: true,
            }),
          })}

          {this.renderArticleDatabaseCard({
            panelKey: 'telegram',
            title: 'Telegram-каналы',
            items: telegramItems,
            isLoading: this.state.isLoadingNews,
            error: this.state.newsError,
            placeholder:
              'Telegram-записи пока не найдены в текущем наборе данных.',
            filters: this.renderFilterPanel({
              panelKey: 'telegram',
              sources: telegramSources,
              selectedSourcesLabel: selectedTelegramSourcesLabel,
              selectedSources: telegramFilters.selectedSources,
              titleSearch: telegramFilters.titleSearch,
              sortOrder: telegramFilters.sortOrder,
              onlyWithContent: telegramFilters.onlyWithContent,
              resultCount: telegramItems.length,
              isInteractive: true,
            }),
          })}

          {this.renderArticleDatabaseCard({
            panelKey: 'forums',
            title: 'Форумы',
            items: forumItems,
            isLoading: this.state.isLoadingNews,
            error: this.state.newsError,
            placeholder:
              'Форумные записи пока не найдены в текущем наборе данных.',
            filters: this.renderFilterPanel({
              panelKey: 'forums',
              sources: forumSources,
              selectedSourcesLabel: selectedForumSourcesLabel,
              selectedSources: forumFilters.selectedSources,
              titleSearch: forumFilters.titleSearch,
              sortOrder: forumFilters.sortOrder,
              onlyWithContent: forumFilters.onlyWithContent,
              resultCount: forumItems.length,
              isInteractive: true,
            }),
          })}
        </div>
      </div>
    );
  }
}

export default Buttons;
