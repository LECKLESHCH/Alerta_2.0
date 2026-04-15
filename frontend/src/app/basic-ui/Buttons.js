import React, { Component } from 'react';
import { fetchArticles } from '../../api/articles';
import { buildInterpretationMeta } from '../../utils/interpretation';

const PREVIEW_WORD_LIMIT = 42;
const DEFAULT_VISIBLE_ROWS = 5;
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

class Buttons extends Component {
  state = {
    newsItems: [],
    isLoadingNews: true,
    newsError: '',
    selectedSources: [],
    titleSearch: '',
    sortOrder: 'newest',
    onlyWithContent: false,
    isSourceDropdownOpen: false,
    expandedPanels: {
      news: false,
      telegram: false,
      forums: false,
    },
    openedArticleId: null,
    fullyExpandedArticleId: null,
  };

  componentDidMount() {
    this.loadNews();
  }

  async loadNews() {
    this.setState({
      isLoadingNews: true,
      newsError: '',
    });

    try {
      const { items } = await fetchArticles({
        page: 1,
        limit: 100,
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

  handleTitleSearchChange = (event) => {
    this.setState({ titleSearch: event.target.value });
  };

  handleSortOrderChange = (event) => {
    this.setState({ sortOrder: event.target.value });
  };

  handleOnlyWithContentChange = (event) => {
    this.setState({ onlyWithContent: event.target.checked });
  };

  resetNewsFilters = () => {
    this.setState({
      selectedSources: [],
      titleSearch: '',
      sortOrder: 'newest',
      onlyWithContent: false,
      isSourceDropdownOpen: false,
    });
  };

  toggleSourceDropdown = () => {
    this.setState((prevState) => ({
      isSourceDropdownOpen: !prevState.isSourceDropdownOpen,
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

  getFilteredNewsItems() {
    const {
      newsItems,
      selectedSources,
      titleSearch,
      sortOrder,
      onlyWithContent,
    } = this.state;

    const normalizedSearch = titleSearch.trim().toLowerCase();

    const filteredItems = newsItems.filter((item) => {
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

    return filteredItems.sort((left, right) => {
      const leftDate = new Date(left.publishedAt || 0).getTime();
      const rightDate = new Date(right.publishedAt || 0).getTime();

      if (sortOrder === 'oldest') {
        return leftDate - rightDate;
      }

      return rightDate - leftDate;
    });
  }

  renderFilterPanel({
    sources = [],
    selectedSourcesLabel = 'Все источники',
    selectedSources = [],
    titleSearch = '',
    sortOrder = 'newest',
    onlyWithContent = false,
    resultCount = null,
    isInteractive = false,
  }) {
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
                onClick={isInteractive ? this.toggleSourceDropdown : undefined}
                disabled={!isInteractive}
              >
                <span className="text-truncate pr-3">
                  {selectedSourcesLabel}
                </span>
                <i
                  className={`mdi ${
                    isInteractive && this.state.isSourceDropdownOpen
                      ? 'mdi-chevron-up'
                      : 'mdi-chevron-down'
                  }`}
                ></i>
              </button>

              {isInteractive && this.state.isSourceDropdownOpen ? (
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
                          onChange={() => this.toggleSourceOption(source)}
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
              onChange={isInteractive ? this.handleTitleSearchChange : undefined}
              disabled={!isInteractive}
            />
          </div>

          <div className="col-12 col-xl-4">
            <label className="mb-2 text-muted small d-block">
              Сортировка по дате
            </label>
            <select
              className="form-control"
              value={sortOrder}
              onChange={isInteractive ? this.handleSortOrderChange : undefined}
              disabled={!isInteractive}
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
            </select>
          </div>
        </div>

        <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between mt-3 pt-3 border-top">
          <div className="form-check mb-3 mb-xl-0">
            <label className="form-check-label">
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
            <span className="text-muted small mr-3">
              {resultCount !== null
                ? `Найдено записей: ${resultCount}`
                : 'Фильтры будут активны после подключения источника'}
            </span>
            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={isInteractive ? this.resetNewsFilters : undefined}
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
                  <table className="table text-white">
                    <thead>
                      <tr>
                        <th>Источник</th>
                        <th>Заголовок</th>
                        <th>Интерпретация</th>
                        <th>Дата публикации</th>
                        <th>Ссылка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => {
                        const isOpened = this.state.openedArticleId === item._id;
                        const interpretation = buildInterpretationMeta(item);

                        return (
                          <React.Fragment key={item._id}>
                            <tr
                              onClick={() => this.toggleArticle(item._id)}
                              className="text-white"
                              style={{ cursor: 'pointer' }}
                            >
                              <td>{item.source || 'Не указан'}</td>
                              <td>{item.title || 'Без заголовка'}</td>
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
                              <td>{formatPublishedAt(item.publishedAt)}</td>
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
                                  <span className="text-muted">Нет ссылки</span>
                                )}
                              </td>
                            </tr>
                            {isOpened ? this.renderExpandedArticleRow(item) : null}
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

  renderExpandedArticleRow(item) {
    const textState = buildPreview(item.text);
    const showFullText = this.state.fullyExpandedArticleId === item._id;
    const interpretation = buildInterpretationMeta(item);

    return (
      <tr key={`${item._id}-expanded`}>
        <td colSpan="5" className="border-top-0 pt-0">
          <div className="border rounded p-4 mt-2 bg-dark">
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

  render() {
    const uniqueSources = Array.from(
      new Set(
        this.state.newsItems
          .map((item) => item.source)
          .filter((source) => Boolean(source)),
      ),
    ).sort((left, right) => left.localeCompare(right, 'ru'));
    const filteredNewsItems = this.getFilteredNewsItems();
    const selectedSourcesLabel =
      this.state.selectedSources.length === 0
        ? 'Все источники'
        : this.state.selectedSources.length === 1
          ? this.state.selectedSources[0]
          : `Выбрано источников: ${this.state.selectedSources.length}`;
    const telegramItems = [];
    const forumItems = [];

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
            description:
              'Лента публикаций из основной базы новостных источников с быстрым раскрытием содержимого.',
            items: filteredNewsItems,
            isLoading: this.state.isLoadingNews,
            error: this.state.newsError,
            placeholder: 'Новостные записи пока не загружены.',
            filters: this.renderFilterPanel({
              sources: uniqueSources,
              selectedSourcesLabel,
              selectedSources: this.state.selectedSources,
              titleSearch: this.state.titleSearch,
              sortOrder: this.state.sortOrder,
              onlyWithContent: this.state.onlyWithContent,
              resultCount: filteredNewsItems.length,
              isInteractive: true,
            }),
          })}

          {this.renderArticleDatabaseCard({
            panelKey: 'telegram',
            title: 'Telegram-каналы',
            description:
              'Контур Telegram будет подключён следующим этапом. Окно уже подготовлено под ту же механику просмотра.',
            items: telegramItems,
            isLoading: false,
            error: '',
            placeholder:
              'Telegram-каналы обозначены. После интеграции здесь появятся записи из Telegram-базы.',
            filters: this.renderFilterPanel({
              selectedSourcesLabel: 'Источники Telegram',
              resultCount: null,
              isInteractive: false,
            }),
          })}

          {this.renderArticleDatabaseCard({
            panelKey: 'forums',
            title: 'Форумы',
            description:
              'Зона для дальнейшего подключения форумов и теневых площадок в единую витрину содержимого.',
            items: forumItems,
            isLoading: false,
            error: '',
            placeholder:
              'Форумный контур пока обозначен как следующий источник данных.',
            filters: this.renderFilterPanel({
              selectedSourcesLabel: 'Источники форумов',
              resultCount: null,
              isInteractive: false,
            }),
          })}
        </div>
      </div>
    );
  }
}

export default Buttons;
