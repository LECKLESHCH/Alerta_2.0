import React, { Component } from 'react';
import { fetchReferenceCves } from '../../api/referenceIntel';

function formatDate(value) {
  if (!value) return 'Нет даты';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Нет даты';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function shorten(text, max = 180) {
  const value = String(text || '').trim();
  if (!value) return 'Нет описания';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

class ThreatBank extends Component {
  state = {
    items: [],
    isLoading: true,
    error: '',
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    search: '',
    hasKev: 'all',
  };

  componentDidMount() {
    this.loadCves();
  }

  async loadCves() {
    this.setState({ isLoading: true, error: '' });
    try {
      const { page, limit, search, hasKev } = this.state;
      const response = await fetchReferenceCves({
        page,
        limit,
        q: search || undefined,
        hasKev: hasKev === 'all' ? undefined : hasKev === 'yes',
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      const meta = response?.meta || {};
      this.setState({
        items,
        isLoading: false,
        total: Number(meta.total || 0),
        totalPages: Number(meta.totalPages || 0),
      });
    } catch (error) {
      this.setState({
        isLoading: false,
        error: error.message || 'Не удалось загрузить базу CVE.',
      });
    }
  }

  handleSearchChange = (event) => {
    this.setState({ search: event.target.value });
  };

  handleKevChange = (event) => {
    this.setState({ hasKev: event.target.value });
  };

  applyFilters = () => {
    this.setState({ page: 1 }, () => this.loadCves());
  };

  resetFilters = () => {
    this.setState(
      {
        search: '',
        hasKev: 'all',
        page: 1,
      },
      () => this.loadCves(),
    );
  };

  goToPage = (nextPage) => {
    this.setState({ page: nextPage }, () => this.loadCves());
  };

  render() {
    const { items, isLoading, error, page, totalPages, total, search, hasKev } =
      this.state;

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Банк угроз</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Содержание
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Банк угроз
              </li>
            </ol>
          </nav>
        </div>

        <div className="row">
          <div className="col-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title mb-3">Банк угроз (CVE)</h4>

                <div className="border rounded px-3 px-xl-4 py-3 mb-4">
                  <div className="row">
                    <div className="col-12 col-xl-7 mb-3 mb-xl-0">
                      <label className="mb-2 text-muted small d-block">
                        Поиск (CVE / вендор / продукт / CWE)
                      </label>
                      <input
                        type="text"
                        className="form-control alerta-filter-control"
                        value={search}
                        onChange={this.handleSearchChange}
                        placeholder="Например: CVE-2024-3094, OpenSSL, CWE-79"
                      />
                    </div>
                    <div className="col-12 col-xl-3 mb-3 mb-xl-0">
                      <label className="mb-2 text-muted small d-block">KEV</label>
                      <select
                        className="form-control alerta-filter-control"
                        value={hasKev}
                        onChange={this.handleKevChange}
                      >
                        <option value="all">Все</option>
                        <option value="yes">Только KEV</option>
                        <option value="no">Без KEV</option>
                      </select>
                    </div>
                    <div className="col-12 col-xl-2 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-outline-light btn-sm mr-2"
                        onClick={this.applyFilters}
                      >
                        Применить
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-light btn-sm"
                        onClick={this.resetFilters}
                      >
                        Сбросить
                      </button>
                    </div>
                  </div>
                </div>

                {isLoading ? <p className="mb-0">Загрузка CVE...</p> : null}
                {error ? <p className="text-danger mb-0">{error}</p> : null}

                {!isLoading && !error ? (
                  <div className="table-responsive alerta-db-table-wrap">
                    <table className="table text-white">
                      <thead>
                        <tr>
                          <th>CVE</th>
                          <th>Описание</th>
                          <th>CVSS</th>
                          <th>Severity</th>
                          <th>CWE</th>
                          <th>Публикация</th>
                          <th>KEV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length ? (
                          items.map((item) => (
                            <tr key={item.cveId || item._id} className="text-white">
                              <td>{item.cveId || 'n/a'}</td>
                              <td>{shorten(item.description)}</td>
                              <td>{item.cvss?.baseScore ?? 'n/a'}</td>
                              <td>{item.cvss?.baseSeverity || 'n/a'}</td>
                              <td>{Array.isArray(item.cwes) && item.cwes.length ? item.cwes.join(', ') : 'n/a'}</td>
                              <td>{formatDate(item.publishedAt)}</td>
                              <td>{item.hasKev ? 'Да' : 'Нет'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="7" className="text-muted">
                              В базе пока нет записей для отображения.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {!isLoading && !error ? (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <span className="text-muted small">Всего: {total}</span>
                    <div>
                      <button
                        type="button"
                        className="btn btn-outline-light btn-sm mr-2"
                        disabled={page <= 1}
                        onClick={() => this.goToPage(page - 1)}
                      >
                        Назад
                      </button>
                      <span className="text-muted small mr-2">
                        Страница {page} / {totalPages || 1}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline-light btn-sm"
                        disabled={!totalPages || page >= totalPages}
                        onClick={() => this.goToPage(page + 1)}
                      >
                        Вперед
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ThreatBank;
