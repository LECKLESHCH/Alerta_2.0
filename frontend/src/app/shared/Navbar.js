import React, { Component } from 'react';
import { Dropdown, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Trans } from 'react-i18next';
import { clearAuthSession, getStoredUser } from '../../auth/storage';
import { fetchCrawlLogs, fetchCrawlStatus, startCrawl } from '../../api/crawler';
import { rebuildModelThreatsAll, rebuildModelThreatsBySource } from '../../api/modelThreats';

const REAL_CRAWL_SCOPES = new Set(['all', 'sites', 'telegram', 'forums']);

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
    isSettingsModalOpen: false,
    isCrawlerConfigOpen: false,
    isLightTheme: false,
    uiDensityCompact: false,
    autoOpenLogsOnStart: true,
    notificationsEnabled: true,
    isLaunchingCrawl: false,
    threatModelStatus: null,
    pendingThreatRebuildScope: null,
    logLines: [],
    logError: null,
    crawlConfig: {
      sites: true,
      telegram: true,
      forums: true,
      autoScheduleEnabled: false,
      intervalHours: 6,
      rebuildThreatModelAfterCrawl: true,
      onlyIfIdle: true,
    },
  };

  componentDidMount() {
    this.loadThemePreference();
    this.loadUiPreferences();
    this.loadCrawlConfig();
    this.refreshCrawlState();
    this.syncCrawlScheduler();
  }

  componentDidUpdate(prevProps, prevState) {
    const wasAnyModalOpen = prevState.isLogsModalOpen || prevState.isSettingsModalOpen;
    const isAnyModalOpen = this.state.isLogsModalOpen || this.state.isSettingsModalOpen;

    if (wasAnyModalOpen !== isAnyModalOpen) {
      this.syncBodyScrollLock(isAnyModalOpen);
    }
  }

  componentWillUnmount() {
    this.stopLogPolling();
    this.stopAutoSchedule();
    this.syncBodyScrollLock(false);
  }

  handleLogout = (event) => {
    event.preventDefault();
    clearAuthSession();
    window.location.href = '/user-pages/login-1';
  };

  loadThemePreference = () => {
    const storedTheme = window.localStorage.getItem('alerta-theme');
    const isLightTheme = storedTheme === 'light';
    this.applyTheme(isLightTheme);
    this.setState({ isLightTheme });
  };

  applyTheme = (isLightTheme) => {
    document.body.classList.toggle('theme-light', isLightTheme);
    window.localStorage.setItem('alerta-theme', isLightTheme ? 'light' : 'dark');
  };

  handleThemeToggle = (event) => {
    const isLightTheme = event.target.checked;
    this.setState({ isLightTheme });
    this.applyTheme(isLightTheme);
  };

  loadUiPreferences = () => {
    const uiDensityCompact = window.localStorage.getItem('alerta-ui-density') === 'compact';
    const autoOpenLogsOnStart = window.localStorage.getItem('alerta-auto-open-logs') !== 'off';
    const notificationsEnabled = window.localStorage.getItem('alerta-notifications') !== 'off';
    this.setState({
      uiDensityCompact,
      autoOpenLogsOnStart,
      notificationsEnabled,
    });
    document.body.classList.toggle('ui-density-compact', uiDensityCompact);
  };

  handleUiDensityToggle = (event) => {
    const enabled = event.target.checked;
    this.setState({ uiDensityCompact: enabled });
    window.localStorage.setItem('alerta-ui-density', enabled ? 'compact' : 'regular');
    document.body.classList.toggle('ui-density-compact', enabled);
  };

  handleAutoOpenLogsToggle = (event) => {
    const enabled = event.target.checked;
    this.setState({ autoOpenLogsOnStart: enabled });
    window.localStorage.setItem('alerta-auto-open-logs', enabled ? 'on' : 'off');
  };

  handleNotificationsToggle = (event) => {
    const enabled = event.target.checked;
    this.setState({ notificationsEnabled: enabled });
    window.localStorage.setItem('alerta-notifications', enabled ? 'on' : 'off');
  };

  handleOpenSettings = (event) => {
    event.preventDefault();
    this.setState({ isSettingsModalOpen: true });
  };

  handleCloseSettings = () => {
    this.setState({ isSettingsModalOpen: false });
  };

  handleOpenCrawlerConfig = (event) => {
    event.preventDefault();
    this.setState({ isCrawlerConfigOpen: true });
  };

  handleCloseCrawlerConfig = () => {
    this.setState({ isCrawlerConfigOpen: false });
  };

  loadCrawlConfig = () => {
    const raw = window.localStorage.getItem('alerta-crawl-config');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      this.setState(
        (prevState) => ({
          crawlConfig: {
            ...prevState.crawlConfig,
            ...parsed,
          },
        }),
        this.syncCrawlScheduler,
      );
    } catch (error) {
      // ignore broken storage value
    }
  };

  saveCrawlConfig = (nextConfig) => {
    window.localStorage.setItem('alerta-crawl-config', JSON.stringify(nextConfig));
  };

  handleCrawlConfigChange = (field, value) => {
    this.setState(
      (prevState) => ({
        crawlConfig: {
          ...prevState.crawlConfig,
          [field]: value,
        },
      }),
      () => {
        this.saveCrawlConfig(this.state.crawlConfig);
        this.syncCrawlScheduler();
      },
    );
  };

  getConfiguredScopes = () => {
    const { sites, telegram, forums } = this.state.crawlConfig;
    const scopes = [];
    if (sites) scopes.push('sites');
    if (telegram) scopes.push('telegram');
    if (forums) scopes.push('forums');
    return scopes;
  };

  resolveQueueFromScopes = (scopes) => {
    const uniqueScopes = Array.from(new Set(scopes.filter((scope) => REAL_CRAWL_SCOPES.has(scope))));
    if (
      uniqueScopes.length === 3 &&
      uniqueScopes.includes('sites') &&
      uniqueScopes.includes('telegram') &&
      uniqueScopes.includes('forums')
    ) {
      return ['all'];
    }
    return uniqueScopes;
  };

  runConfiguredCrawl = async (reason = 'manual') => {
    const selectedScopes = this.resolveQueueFromScopes(this.getConfiguredScopes());
    if (!selectedScopes.length) {
      this.setState((prevState) => ({
        logLines: [
          ...prevState.logLines,
          `[${new Date().toLocaleTimeString('ru-RU')}] Конфигуратор: не выбраны источники.`,
        ],
        isLogsModalOpen: true,
      }));
      return;
    }

    this.pendingScopeQueue = selectedScopes.slice(1);
    await this.handleStartCrawl(selectedScopes[0], reason);
  };

  startNextQueuedScope = async () => {
    if (this.state.crawlRunning || this.state.isLaunchingCrawl) {
      return;
    }
    if (!Array.isArray(this.pendingScopeQueue) || this.pendingScopeQueue.length === 0) {
      return;
    }
    const nextScope = this.pendingScopeQueue.shift();
    if (!nextScope) return;
    await this.handleStartCrawl(nextScope, 'queue');
  };

  stopAutoSchedule = () => {
    if (this.autoScheduleTimer) {
      window.clearInterval(this.autoScheduleTimer);
      this.autoScheduleTimer = null;
    }
  };

  syncCrawlScheduler = () => {
    this.stopAutoSchedule();
    const { autoScheduleEnabled, intervalHours } = this.state.crawlConfig;
    if (!autoScheduleEnabled) return;
    const intervalMs = Math.max(1, Number(intervalHours) || 1) * 60 * 60 * 1000;
    this.autoScheduleTimer = window.setInterval(() => {
      const { onlyIfIdle } = this.state.crawlConfig;
      if (onlyIfIdle && (this.state.crawlRunning || this.state.isLaunchingCrawl)) {
        return;
      }
      this.runConfiguredCrawl('auto');
    }, intervalMs);
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
      const wasRunning = this.lastCrawlRunning === true;
      const isRunningNow = Boolean(status?.running);

      this.setState((prevState) => ({
        crawlRunning: isRunningNow,
        crawlScope: status?.scope || prevState.crawlScope,
        crawlStatus: status?.status || null,
        logError: isRealScope ? null : prevState.logError,
      }));
      this.lastCrawlRunning = isRunningNow;

      if (wasRunning && !isRunningNow) {
        if (this.state.crawlConfig.rebuildThreatModelAfterCrawl) {
          this.triggerThreatModelRebuild();
        } else {
          this.setState({ pendingThreatRebuildScope: null, threatModelStatus: null });
        }
        this.startNextQueuedScope();
      }

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

  triggerThreatModelRebuild = async () => {
    const scope = this.state.pendingThreatRebuildScope;
    if (!scope || !REAL_CRAWL_SCOPES.has(scope)) {
      return;
    }

    this.setState((prevState) => ({
      threatModelStatus: 'running',
      logLines: [
        ...prevState.logLines,
        `[${new Date().toLocaleTimeString('ru-RU')}] Запускаем обновление model_threat...`,
      ],
    }));

    try {
      if (scope === 'all') {
        await rebuildModelThreatsAll(120);
      } else {
        const sourceMap = { sites: 'web', telegram: 'tg', forums: 'forum' };
        await rebuildModelThreatsBySource(sourceMap[scope], 120);
      }

      this.setState((prevState) => ({
        threatModelStatus: 'done',
        pendingThreatRebuildScope: null,
        logLines: [
          ...prevState.logLines,
          `[${new Date().toLocaleTimeString('ru-RU')}] model_threat успешно обновлен.`,
        ],
      }));
    } catch (error) {
      this.setState((prevState) => ({
        threatModelStatus: 'error',
        pendingThreatRebuildScope: null,
        logLines: [
          ...prevState.logLines,
          `[${new Date().toLocaleTimeString('ru-RU')}] Ошибка обновления model_threat: ${
            error.message || 'неизвестная ошибка'
          }`,
        ],
      }));
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

  handleStartCrawl = async (scope, reason = 'manual') => {
    const isRealScope = REAL_CRAWL_SCOPES.has(scope);
    const { crawlRunning, crawlScope } = this.state;

    if (isRealScope && crawlRunning) {
      const runningScopeLabel = this.getScopeLabel(crawlScope);
      this.setState((prevState) => ({
        isLogsModalOpen: true,
        crawlStatus: 'already_running',
        logLines: [
          ...prevState.logLines,
          `[${new Date().toLocaleTimeString('ru-RU')}] Новый запуск "${this.getScopeLabel(
            scope,
          )}" отклонен: уже выполняется "${runningScopeLabel}".`,
        ],
      }));
      this.startLogPolling();
      return;
    }

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
      isLogsModalOpen: this.state.autoOpenLogsOnStart,
      crawlScope: scope,
      crawlStatus: null,
      threatModelStatus: 'waiting',
      pendingThreatRebuildScope: null,
      logError: null,
      logLines: [
        `[${new Date().toLocaleTimeString('ru-RU')}] Отправляем команду на ${this.getScopeLabel(scope).toLowerCase()} (${reason})...`,
      ],
    });

    try {
      const payload = await startCrawl(scope);
      const actualScope = payload?.scope || scope;
      const status = payload?.status || 'started';
      const isStarted = status === 'started';
      this.setState({
        crawlRunning: Boolean(payload?.running),
        crawlScope: actualScope,
        crawlStatus: status,
        pendingThreatRebuildScope: isStarted ? actualScope : null,
        logLines: [
          ...this.state.logLines,
          status === 'already_running'
            ? `[${new Date().toLocaleTimeString('ru-RU')}] Уже выполняется: ${this.getScopeLabel(actualScope)}`
            : `[${new Date().toLocaleTimeString('ru-RU')}] Запущено: ${this.getScopeLabel(actualScope)}`,
        ],
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
    const isBlockedByRunningTask = this.state.crawlRunning;

    return (
      <React.Fragment key={scope}>
        <Dropdown.Item
          href="!#"
          disabled={isBlockedByRunningTask}
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
      (currentUser &&
        (currentUser.username ||
          currentUser.displayName ||
          (currentUser.email ? String(currentUser.email).split('@')[0] : ''))) ||
      'admin';
    const {
      crawlRunning,
      crawlScope,
      crawlStatus,
      isLogsModalOpen,
      isSettingsModalOpen,
      isCrawlerConfigOpen,
      isLightTheme,
      uiDensityCompact,
      autoOpenLogsOnStart,
      notificationsEnabled,
      isLaunchingCrawl,
      logLines,
      logError,
      crawlConfig,
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
            <ul className="navbar-nav w-100"></ul>
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
                    onClick={this.handleOpenCrawlerConfig}
                    className="preview-item"
                  >
                    <div className="preview-thumbnail">
                      <div className="preview-icon bg-dark rounded-circle">
                        <i className="mdi mdi-tune text-light"></i>
                      </div>
                    </div>
                    <div className="preview-item-content">
                      <p className="preview-subject mb-1">
                        Конфигуратор парсинга
                      </p>
                    </div>
                  </Dropdown.Item>
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
                  <Dropdown.Item href="!#" onClick={this.handleOpenSettings} className="preview-item">
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

        <Modal
          show={isSettingsModalOpen}
          onHide={this.handleCloseSettings}
          centered
        >
          <Modal.Header className="bg-dark text-light border-secondary d-flex align-items-center">
            <Modal.Title>Настройки приложения</Modal.Title>
            <button
              type="button"
              className="close text-light ml-auto"
              aria-label="Закрыть настройки"
              onClick={this.handleCloseSettings}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </Modal.Header>
          <Modal.Body className="bg-dark text-light">
            <div className="d-flex justify-content-between align-items-center py-2">
              <div>
                <h6 className="mb-1">Светлая тема</h6>
                <small className="text-muted">Переключить интерфейс на светлую палитру</small>
              </div>
              <div className="custom-control custom-switch mb-0">
                <input
                  type="checkbox"
                  className="custom-control-input"
                  id="theme-light-switch"
                  checked={isLightTheme}
                  onChange={this.handleThemeToggle}
                />
                <label className="custom-control-label" htmlFor="theme-light-switch" />
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center py-2 border-top border-secondary">
              <div>
                <h6 className="mb-1">Компактный режим интерфейса</h6>
                <small className="text-muted">Уменьшить интервалы и высоту элементов</small>
              </div>
              <div className="custom-control custom-switch mb-0">
                <input
                  type="checkbox"
                  className="custom-control-input"
                  id="ui-density-switch"
                  checked={uiDensityCompact}
                  onChange={this.handleUiDensityToggle}
                />
                <label className="custom-control-label" htmlFor="ui-density-switch" />
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center py-2 border-top border-secondary">
              <div>
                <h6 className="mb-1">Авто-открытие логов при запуске</h6>
                <small className="text-muted">Сразу показывать окно логов после старта парсинга</small>
              </div>
              <div className="custom-control custom-switch mb-0">
                <input
                  type="checkbox"
                  className="custom-control-input"
                  id="logs-open-switch"
                  checked={autoOpenLogsOnStart}
                  onChange={this.handleAutoOpenLogsToggle}
                />
                <label className="custom-control-label" htmlFor="logs-open-switch" />
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center py-2 border-top border-secondary">
              <div>
                <h6 className="mb-1">Служебные уведомления</h6>
                <small className="text-muted">Показывать уведомления о статусе запуска и ошибок</small>
              </div>
              <div className="custom-control custom-switch mb-0">
                <input
                  type="checkbox"
                  className="custom-control-input"
                  id="notifications-switch"
                  checked={notificationsEnabled}
                  onChange={this.handleNotificationsToggle}
                />
                <label className="custom-control-label" htmlFor="notifications-switch" />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="bg-dark border-secondary">
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={this.handleCloseSettings}
            >
              Закрыть
            </button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={isCrawlerConfigOpen}
          onHide={this.handleCloseCrawlerConfig}
          centered
        >
          <Modal.Header className="bg-dark text-light border-secondary d-flex align-items-center">
            <Modal.Title>Конфигуратор парсинга</Modal.Title>
            <button
              type="button"
              className="close text-light ml-auto"
              aria-label="Закрыть конфигуратор"
              onClick={this.handleCloseCrawlerConfig}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </Modal.Header>
          <Modal.Body className="bg-dark text-light">
            <div className="mb-3">
              <h6 className="mb-2">Выбор источников</h6>
              <div className="d-flex flex-column">
                <label className="custom-control custom-checkbox mb-2">
                  <input
                    type="checkbox"
                    className="custom-control-input"
                    checked={crawlConfig.sites}
                    onChange={(event) => this.handleCrawlConfigChange('sites', event.target.checked)}
                  />
                  <span className="custom-control-label">Веб-сайты</span>
                </label>
                <label className="custom-control custom-checkbox mb-2">
                  <input
                    type="checkbox"
                    className="custom-control-input"
                    checked={crawlConfig.telegram}
                    onChange={(event) => this.handleCrawlConfigChange('telegram', event.target.checked)}
                  />
                  <span className="custom-control-label">Телеграм каналы</span>
                </label>
                <label className="custom-control custom-checkbox mb-2">
                  <input
                    type="checkbox"
                    className="custom-control-input"
                    checked={crawlConfig.forums}
                    onChange={(event) => this.handleCrawlConfigChange('forums', event.target.checked)}
                  />
                  <span className="custom-control-label">Форумы</span>
                </label>
              </div>
            </div>

            <div className="border-top border-secondary pt-3 mb-3">
              <h6 className="mb-2">Автоматизация парсинга</h6>
              <label className="custom-control custom-switch mb-3">
                <input
                  type="checkbox"
                  className="custom-control-input"
                  id="auto-schedule-switch"
                  checked={crawlConfig.autoScheduleEnabled}
                  onChange={(event) =>
                    this.handleCrawlConfigChange('autoScheduleEnabled', event.target.checked)
                  }
                />
                <span className="custom-control-label">Включить автозапуск по расписанию</span>
              </label>

              <label className="mb-1">Интервал запуска</label>
              <select
                className="form-control text-light bg-dark border-secondary"
                value={crawlConfig.intervalHours}
                onChange={(event) =>
                  this.handleCrawlConfigChange('intervalHours', Number(event.target.value))
                }
              >
                <option value={1}>Каждый час</option>
                <option value={6}>Каждые 6 часов</option>
                <option value={12}>Каждые 12 часов</option>
                <option value={24}>Каждые 24 часа</option>
              </select>

              <label className="custom-control custom-switch mt-3 mb-2">
                <input
                  type="checkbox"
                  className="custom-control-input"
                  id="crawl-idle-switch"
                  checked={crawlConfig.onlyIfIdle}
                  onChange={(event) => this.handleCrawlConfigChange('onlyIfIdle', event.target.checked)}
                />
                <span className="custom-control-label">Запускать только при простое системы</span>
              </label>
            </div>

            <div className="border-top border-secondary pt-3">
              <h6 className="mb-2">Дополнительно</h6>
              <label className="custom-control custom-switch mb-0">
                <input
                  type="checkbox"
                  className="custom-control-input"
                  id="threat-rebuild-switch"
                  checked={crawlConfig.rebuildThreatModelAfterCrawl}
                  onChange={(event) =>
                    this.handleCrawlConfigChange('rebuildThreatModelAfterCrawl', event.target.checked)
                  }
                />
                <span className="custom-control-label">Обновлять model_threat после завершения</span>
              </label>
            </div>
          </Modal.Body>
          <Modal.Footer className="bg-dark border-secondary d-flex justify-content-between">
            <button
              type="button"
              className="btn btn-outline-info"
              onClick={() => this.runConfiguredCrawl('manual')}
              disabled={isLaunchingCrawl || crawlRunning}
            >
              Запустить по конфигурации
            </button>
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={this.handleCloseCrawlerConfig}
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
