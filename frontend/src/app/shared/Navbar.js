import React, { Component } from 'react';
import { Dropdown, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Trans } from 'react-i18next';
import { clearAuthSession, getStoredUser } from '../../auth/storage';
import { fetchCrawlLogs, fetchCrawlStatus, startCrawl } from '../../api/crawler';

const REAL_CRAWL_SCOPES = new Set(['all', 'sites']);

const CRAWL_SCOPE_LABELS = {
  all: 'По всем источникам',
  sites: 'Парсинг сайтов',
  telegram: 'Парсинг Telegram',
  forums: 'Парсинг форумов',
};

const CRAWL_SCOPE_ICONS = {
  all: 'mdi mdi-source-branch text-success',
  sites: 'mdi mdi-web text-info',
  telegram: 'mdi mdi-telegram text-primary',
  forums: 'mdi mdi-forum text-warning',
};

class Navbar extends Component {
  state = {
    crawlRunning: false,
    crawlScope: null,
    crawlStatus: null,
    isLogsModalOpen: false,
    isLaunchingCrawl: false,
    logLines: [],
    logError: null,
  };

  componentDidMount() {
    this.refreshCrawlState();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.isLogsModalOpen !== this.state.isLogsModalOpen) {
      this.syncBodyScrollLock(this.state.isLogsModalOpen);
    }
  }

  componentWillUnmount() {
    this.stopLogPolling();
    this.syncBodyScrollLock(false);
  }

  handleLogout = (event) => {
    event.preventDefault();
    clearAuthSession();
    window.location.href = '/user-pages/login-1';
  };

  toggleOffcanvas() {
    document.querySelector('.sidebar-offcanvas').classList.toggle('active');
  }

  toggleRightSidebar() {
    document.querySelector('.right-sidebar').classList.toggle('open');
  }

  getScopeLabel = (scope) => {
    return CRAWL_SCOPE_LABELS[scope] || 'Парсинг';
  };

  getSimulatedLogs = (scope) => {
    const label = this.getScopeLabel(scope);

    return [
      `[${new Date().toLocaleTimeString('ru-RU')}] ${label}: интерфейс запуска готов.`,
      `[${new Date().toLocaleTimeString('ru-RU')}] Интеграция этого направления будет подключена следующим шагом.`,
      `[${new Date().toLocaleTimeString('ru-RU')}] Сейчас реально связан с backend только сценарий "Парсинг сайтов".`,
    ];
  };

  startLogPolling = () => {
    this.stopLogPolling();
    this.logPollTimer = window.setInterval(() => {
      this.refreshCrawlState();
    }, 3000);
  };

  stopLogPolling = () => {
    if (this.logPollTimer) {
      window.clearInterval(this.logPollTimer);
      this.logPollTimer = null;
    }
  };

  syncBodyScrollLock = (locked) => {
    const body = document.body;
    const root = document.documentElement;

    if (locked) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      this.lockedScrollY = scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      root.style.overflow = 'hidden';
      return;
    }

    const scrollY = this.lockedScrollY || 0;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    root.style.overflow = '';
    window.scrollTo(0, scrollY);
    this.lockedScrollY = 0;
  };

  refreshCrawlState = async () => {
    try {
      const status = await fetchCrawlStatus();
      const isRealScope = REAL_CRAWL_SCOPES.has(status?.scope);

      this.setState((prevState) => ({
        crawlRunning: Boolean(status?.running),
        crawlScope: status?.scope || prevState.crawlScope,
        crawlStatus: status?.status || null,
        logError: isRealScope ? null : prevState.logError,
      }));

      if (isRealScope || this.state.isLogsModalOpen) {
        await this.refreshLogs();
      }

      if (!status?.running && !this.state.isLogsModalOpen) {
        this.stopLogPolling();
      }
    } catch (error) {
      this.setState({
        logError: error.message || 'Не удалось получить статус парсинга',
      });
    }
  };

  refreshLogs = async () => {
    if (!REAL_CRAWL_SCOPES.has(this.state.crawlScope) && !this.state.crawlRunning) {
      return;
    }

    try {
      const payload = await fetchCrawlLogs(200);
      this.setState({
        crawlRunning: Boolean(payload?.running),
        crawlScope: payload?.scope || this.state.crawlScope,
        logLines: Array.isArray(payload?.lines) ? payload.lines : [],
        logError: null,
      });
    } catch (error) {
      this.setState({
        logError: error.message || 'Не удалось получить логи',
      });
    }
  };

  handleOpenLogs = () => {
    this.setState({ isLogsModalOpen: true }, () => {
      if (REAL_CRAWL_SCOPES.has(this.state.crawlScope) || this.state.crawlRunning) {
        this.refreshLogs();
        this.startLogPolling();
      }
    });
  };

  handleCloseLogs = () => {
    this.setState({ isLogsModalOpen: false });
    if (!this.state.crawlRunning) {
      this.stopLogPolling();
    }
  };

  handleLogsWheel = (event) => {
    const container = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollingDown = event.deltaY > 0;
    const scrollingUp = event.deltaY < 0;
    const reachedTop = scrollTop <= 0;
    const reachedBottom = scrollTop + clientHeight >= scrollHeight - 1;

    if ((scrollingDown && reachedBottom) || (scrollingUp && reachedTop)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  handleStartCrawl = async (scope) => {
    const isRealScope = REAL_CRAWL_SCOPES.has(scope);

    if (!isRealScope) {
      this.setState({
        crawlRunning: false,
        crawlScope: scope,
        crawlStatus: 'planned',
        isLogsModalOpen: true,
        logLines: this.getSimulatedLogs(scope),
        logError: null,
      });
      return;
    }

    this.setState({
      isLaunchingCrawl: true,
      isLogsModalOpen: true,
      crawlScope: scope,
      crawlStatus: null,
      logError: null,
      logLines: [
        `[${new Date().toLocaleTimeString('ru-RU')}] Отправляем команду на ${this.getScopeLabel(scope).toLowerCase()}...`,
      ],
    });

    try {
      const payload = await startCrawl(scope);
      this.setState({
        crawlRunning: Boolean(payload?.running),
        crawlScope: payload?.scope || scope,
        crawlStatus: payload?.status || 'started',
      });
      await this.refreshCrawlState();
      this.startLogPolling();
    } catch (error) {
      this.setState({
        crawlRunning: false,
        crawlStatus: 'error',
        logError: error.message || 'Не удалось запустить парсинг',
        logLines: [
          `[${new Date().toLocaleTimeString('ru-RU')}] Ошибка запуска: ${
            error.message || 'Не удалось запустить парсинг'
          }`,
        ],
      });
    } finally {
      this.setState({ isLaunchingCrawl: false });
    }
  };

  renderCrawlMenuItem = (scope) => {
    const label = this.getScopeLabel(scope);

    return (
      <React.Fragment key={scope}>
        <Dropdown.Item
          href="!#"
          onClick={(event) => {
            event.preventDefault();
            this.handleStartCrawl(scope);
          }}
          className="preview-item"
        >
          <div className="preview-thumbnail">
            <div className="preview-icon bg-dark rounded-circle">
              <i className={CRAWL_SCOPE_ICONS[scope]}></i>
            </div>
          </div>
          <div className="preview-item-content">
            <p
              className="preview-subject mb-1"
              style={{ whiteSpace: 'normal', overflow: 'visible' }}
            >
              {label}
            </p>
          </div>
        </Dropdown.Item>
        {scope !== 'all' && <Dropdown.Divider />}
      </React.Fragment>
    );
  };

  render() {
    const currentUser = getStoredUser();
    const displayName =
      (currentUser && currentUser.displayName) || 'ALERTA_Admin_1';
    const {
      crawlRunning,
      crawlScope,
      crawlStatus,
      isLogsModalOpen,
      isLaunchingCrawl,
      logLines,
      logError,
    } = this.state;

    const canShowLogsButton = crawlRunning || logLines.length > 0 || Boolean(logError);
    const activeScopeLabel = this.getScopeLabel(crawlScope);
    const crawlStatusLabel = crawlRunning
      ? `Выполняется: ${activeScopeLabel}`
      : crawlStatus === 'already_running'
      ? `Уже выполняется: ${activeScopeLabel}`
      : crawlStatus === 'planned'
      ? `Подготовлено: ${activeScopeLabel}`
      : null;

    return (
      <>
      <nav className="navbar p-0 fixed-top d-flex flex-row">
          <div className="navbar-brand-wrapper d-flex d-lg-none align-items-center justify-content-center">
            <Link className="navbar-brand brand-logo-mini" to="/">
              <img src={require('../../assets/images/logo-mini.svg')} alt="logo" />
            </Link>
          </div>
          <div className="navbar-menu-wrapper flex-grow d-flex align-items-stretch">
            <button
              className="navbar-toggler align-self-center"
              type="button"
              onClick={() => document.body.classList.toggle('sidebar-icon-only')}
            >
              <span className="mdi mdi-menu"></span>
            </button>
            <ul className="navbar-nav w-100">
              <li className="nav-item w-100">
                <form className="nav-link mt-2 mt-md-0 d-none d-lg-flex search">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Поиск по инцидентам, объектам и TTP"
                  />
                </form>
              </li>
            </ul>
            <ul className="navbar-nav navbar-nav-right">
              {canShowLogsButton && (
                <li className="nav-item d-none d-lg-flex align-items-center mr-2">
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={this.handleOpenLogs}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Смотреть логи
                  </button>
                </li>
              )}
              <Dropdown alignRight as="li" className="nav-item d-none d-lg-block">
                <Dropdown.Toggle
                  className="nav-link btn btn-success create-new-button no-caret"
                  disabled={isLaunchingCrawl}
                >
                  {isLaunchingCrawl ? '...' : '+'} <Trans>Запустить парсинг</Trans>
                </Dropdown.Toggle>

                <Dropdown.Menu
                  className="navbar-dropdown preview-list create-new-dropdown-menu"
                  style={{ minWidth: 360, marginLeft: -110 }}
                >
                  <h6 className="p-3 mb-0"><Trans>Источники парсинга</Trans></h6>
                  <Dropdown.Divider />
                  {this.renderCrawlMenuItem('sites')}
                  {this.renderCrawlMenuItem('telegram')}
                  {this.renderCrawlMenuItem('forums')}
                  <Dropdown.Divider />
                  <Dropdown.Item
                    href="!#"
                    onClick={(event) => {
                      event.preventDefault();
                      this.handleStartCrawl('all');
                    }}
                    className="preview-item"
                  >
                    <div className="preview-thumbnail">
                      <div className="preview-icon bg-dark rounded-circle">
                        <i className={CRAWL_SCOPE_ICONS.all}></i>
                      </div>
                    </div>
                    <div className="preview-item-content">
                      <p
                        className="preview-subject mb-1"
                        style={{ whiteSpace: 'normal', overflow: 'visible' }}
                      >
                        <Trans>По всем источникам</Trans>
                      </p>
                    </div>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <li className="nav-item d-none d-lg-flex align-items-center mr-3">
                {crawlStatusLabel ? (
                  <span className={`badge ${crawlRunning ? 'badge-success' : 'badge-outline-info'}`}>
                    {crawlStatusLabel}
                  </span>
                ) : null}
              </li>
              <li className="nav-item d-none d-lg-block">
                <a className="nav-link" href="!#" onClick={(event) => event.preventDefault()}>
                  <i className="mdi mdi-view-grid"></i>
                </a>
              </li>
              <Dropdown alignRight as="li" className="nav-item border-left">
                <Dropdown.Toggle as="a" className="nav-link count-indicator cursor-pointer">
                  <i className="mdi mdi-email"></i>
                  <span className="count bg-success"></span>
                </Dropdown.Toggle>
                <Dropdown.Menu className="navbar-dropdown preview-list">
                  <h6 className="p-3 mb-0"><Trans>Сообщения</Trans></h6>
                  <Dropdown.Divider />
                  <Dropdown.Item href="!#" onClick={(evt) => evt.preventDefault()} className="preview-item">
                    <div className="preview-item-content">
                      <p className="preview-subject ellipsis mb-1">
                        <Trans>Новый критичный сигнал по внешнему периметру</Trans>
                      </p>
                      <p className="text-muted mb-0">
                        1 <Trans>минуту назад</Trans>
                      </p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item href="!#" onClick={(evt) => evt.preventDefault()} className="preview-item">
                    <div className="preview-item-content">
                      <p className="preview-subject ellipsis mb-1">
                        <Trans>Обновлен профиль объекта КИИ</Trans>
                      </p>
                      <p className="text-muted mb-0">
                        7 <Trans>минут назад</Trans>
                      </p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item href="!#" onClick={(evt) => evt.preventDefault()} className="preview-item">
                    <div className="preview-item-content">
                      <p className="preview-subject ellipsis mb-1">
                        <Trans>Аналитик подтвердил высокий риск</Trans>
                      </p>
                      <p className="text-muted mb-0">
                        18 <Trans>минут назад</Trans>
                      </p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <p className="p-3 mb-0 text-center">4 <Trans>новых сообщения</Trans></p>
                </Dropdown.Menu>
              </Dropdown>
              <Dropdown alignRight as="li" className="nav-item border-left">
                <Dropdown.Toggle as="a" className="nav-link count-indicator cursor-pointer">
                  <i className="mdi mdi-bell"></i>
                  <span className="count bg-danger"></span>
                </Dropdown.Toggle>
                <Dropdown.Menu className="dropdown-menu navbar-dropdown preview-list">
                  <h6 className="p-3 mb-0"><Trans>Уведомления</Trans></h6>
                  <Dropdown.Divider />
                  <Dropdown.Item className="dropdown-item preview-item" onClick={(evt) => evt.preventDefault()}>
                    <div className="preview-thumbnail">
                      <div className="preview-icon bg-dark rounded-circle">
                        <i className="mdi mdi-calendar text-success"></i>
                      </div>
                    </div>
                    <div className="preview-item-content">
                      <p className="preview-subject mb-1"><Trans>Сводка дня готова</Trans></p>
                      <p className="text-muted ellipsis mb-0">
                        <Trans>Система собрала и классифицировала новые инциденты по регионам</Trans>
                      </p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item className="dropdown-item preview-item" onClick={(evt) => evt.preventDefault()}>
                    <div className="preview-thumbnail">
                      <div className="preview-icon bg-dark rounded-circle">
                        <i className="mdi mdi-settings text-danger"></i>
                      </div>
                    </div>
                    <div className="preview-item-content">
                      <h6 className="preview-subject mb-1"><Trans>Профиль объекта обновлен</Trans></h6>
                      <p className="text-muted ellipsis mb-0">
                        <Trans>Изменения повлияли на object match и итоговый риск</Trans>
                      </p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item className="dropdown-item preview-item" onClick={(evt) => evt.preventDefault()}>
                    <div className="preview-thumbnail">
                      <div className="preview-icon bg-dark rounded-circle">
                        <i className="mdi mdi-link-variant text-warning"></i>
                      </div>
                    </div>
                    <div className="preview-item-content">
                      <h6 className="preview-subject mb-1"><Trans>Новый инцидент на карте</Trans></h6>
                      <p className="text-muted ellipsis mb-0">
                        <Trans>Географическая аномалия обнаружена</Trans>
                      </p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <p className="p-3 mb-0 text-center"><Trans>Все уведомления</Trans></p>
                </Dropdown.Menu>
              </Dropdown>
              <Dropdown alignRight as="li" className="nav-item">
                <Dropdown.Toggle as="a" className="nav-link cursor-pointer no-caret">
                  <div className="navbar-profile">
                    <p className="mb-0 d-none d-sm-block navbar-profile-name">{displayName}</p>
                    <i className="mdi mdi-menu-down d-none d-sm-block"></i>
                  </div>
                </Dropdown.Toggle>

                <Dropdown.Menu className="navbar-dropdown preview-list navbar-profile-dropdown-menu">
                  <h6 className="p-3 mb-0"><Trans>Профиль</Trans></h6>
                  <Dropdown.Divider />
                  <Dropdown.Item href="!#" onClick={(evt) => evt.preventDefault()} className="preview-item">
                    <div className="preview-thumbnail">
                      <div className="preview-icon bg-dark rounded-circle">
                        <i className="mdi mdi-settings text-success"></i>
                      </div>
                    </div>
                    <div className="preview-item-content">
                      <p className="preview-subject mb-1"><Trans>Настройки</Trans></p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item href="!#" onClick={this.handleLogout} className="preview-item">
                    <div className="preview-thumbnail">
                      <div className="preview-icon bg-dark rounded-circle">
                        <i className="mdi mdi-logout text-danger"></i>
                      </div>
                    </div>
                    <div className="preview-item-content">
                      <p className="preview-subject mb-1"><Trans>Выйти</Trans></p>
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <p className="p-3 mb-0 text-center"><Trans>Расширенные параметры</Trans></p>
                </Dropdown.Menu>
              </Dropdown>
            </ul>
            <button
              className="navbar-toggler navbar-toggler-right d-lg-none align-self-center"
              type="button"
              onClick={this.toggleOffcanvas}
            >
              <span className="mdi mdi-format-line-spacing"></span>
            </button>
          </div>
        </nav>

        <Modal
          show={isLogsModalOpen}
          onHide={this.handleCloseLogs}
          dialogClassName="modal-xl"
          centered
          scrollable
        >
          <Modal.Header className="bg-dark text-light border-secondary d-flex align-items-center">
            <Modal.Title>{activeScopeLabel}</Modal.Title>
            <button
              type="button"
              className="close text-light ml-auto"
              aria-label="Закрыть окно логов"
              onClick={this.handleCloseLogs}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </Modal.Header>
          <Modal.Body
            className="bg-dark text-light"
            style={{ maxHeight: 'calc(100vh - 13rem)', overflowY: 'auto' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className={`badge ${crawlRunning ? 'badge-success' : 'badge-outline-secondary'}`}>
                {crawlRunning ? 'Сбор данных выполняется' : 'Окно логов'}
              </span>
              {REAL_CRAWL_SCOPES.has(crawlScope) && (
                <button
                  type="button"
                  className="btn btn-outline-info btn-sm"
                  onClick={this.refreshCrawlState}
                >
                  Обновить
                </button>
              )}
            </div>
            {logError ? (
              <div className="alert alert-danger py-2" role="alert">
                {logError}
              </div>
            ) : null}
            <div
              className="bg-black text-light rounded p-3 border border-secondary"
              style={{
                minHeight: 320,
                maxHeight: 'min(60vh, 560px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
              onWheel={this.handleLogsWheel}
            >
              <pre
                className="mb-0 text-monospace text-wrap"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {logLines.length ? logLines.join('\n') : 'Логи появятся после старта сценария.'}
              </pre>
            </div>
          </Modal.Body>
          <Modal.Footer className="bg-dark border-secondary">
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={this.handleCloseLogs}
            >
              Закрыть
            </button>
          </Modal.Footer>
        </Modal>
      </>
    );
  }
}

export default Navbar;
