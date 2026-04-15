import React, { Component } from 'react';
import {
  deleteObjectPassport,
  fetchObjects,
} from '../../api/objects';

function formatScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : '0.0';
}

function formatDate(value) {
  if (!value) {
    return 'Черновик';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Черновик';
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function EmptyState() {
  return (
    <div className="border rounded px-4 py-5 text-center text-muted">
      Список моделей пока пуст. Добавь паспорт КИИ, и он появится здесь.
    </div>
  );
}

class ObjectModelsList extends Component {
  state = {
    items: [],
    isLoading: true,
    error: '',
    search: '',
    typeFilter: 'all',
    industryFilter: 'all',
    sortOrder: 'newest',
    deletingId: '',
  };

  componentDidMount() {
    this.loadObjects();
  }

  async loadObjects() {
    this.setState({
      isLoading: true,
      error: '',
    });

    try {
      const response = await fetchObjects();
      const backendItems = Array.isArray(response) ? response : [];

      this.setState({
        items: backendItems,
        isLoading: false,
      });
    } catch (error) {
      this.setState({
        items: [],
        isLoading: false,
        error:
          error.message ||
          'Не удалось загрузить список моделей объекта.',
      });
    }
  }

  handleFilterChange = (event) => {
    const { name, value } = event.target;
    this.setState({ [name]: value });
  };

  handleDelete = async (item) => {
    if (!window.confirm(`Удалить модель "${item.objectName}"?`)) {
      return;
    }

    this.setState({ deletingId: item._id, error: '' });

    try {
      await deleteObjectPassport(item._id);
      this.setState((prevState) => ({
        items: prevState.items.filter((current) => current._id !== item._id),
        deletingId: '',
      }));
    } catch (error) {
      this.setState({
        deletingId: '',
        error:
          error.message || 'Не удалось удалить модель объекта.',
      });
    }
  };

  getFilteredItems() {
    const { items, search, typeFilter, industryFilter, sortOrder } = this.state;
    const normalizedSearch = search.trim().toLowerCase();

    const filteredItems = items.filter((item) => {
      const searchSpace = [
        item.objectName,
        item.objectType,
        item.industry,
        item.subIndustry,
        item.region,
        item.ownerUnit,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchSpace.includes(normalizedSearch);
      const matchesType =
        typeFilter === 'all' || item.objectType === typeFilter;
      const matchesIndustry =
        industryFilter === 'all' || item.industry === industryFilter;

      return matchesSearch && matchesType && matchesIndustry;
    });

    return filteredItems.sort((left, right) => {
      const leftDate = new Date(left.createdAt || 0).getTime();
      const rightDate = new Date(right.createdAt || 0).getTime();

      if (sortOrder === 'oldest') {
        return leftDate - rightDate;
      }

      return rightDate - leftDate;
    });
  }

  render() {
    const {
      items,
      isLoading,
      error,
      search,
      typeFilter,
      industryFilter,
      sortOrder,
      deletingId,
    } = this.state;

    const filteredItems = this.getFilteredItems();
    const typeOptions = Array.from(
      new Set(items.map((item) => item.objectType).filter(Boolean)),
    );
    const industryOptions = Array.from(
      new Set(items.map((item) => item.industry).filter(Boolean)),
    );

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Список моделей</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Модель объекта
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Список моделей
              </li>
            </ol>
          </nav>
        </div>

        <div className="card">
          <div className="card-body">
            <h4 className="card-title">Модели объектов</h4>
            <p className="card-description">
              Единое окно со списком моделей, фильтрами и быстрыми действиями.
            </p>

            <div className="border rounded px-3 px-xl-4 py-3 mb-4">
              <div className="row">
                <div className="col-12 col-xl-4 mb-3">
                  <label className="mb-2 text-muted small d-block">
                    Поиск по модели
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="search"
                    value={search}
                    onChange={this.handleFilterChange}
                    placeholder="Название, регион, подразделение"
                  />
                </div>
                <div className="col-12 col-md-6 col-xl-3 mb-3">
                  <label className="mb-2 text-muted small d-block">
                    Тип объекта
                  </label>
                  <select
                    className="form-control"
                    name="typeFilter"
                    value={typeFilter}
                    onChange={this.handleFilterChange}
                  >
                    <option value="all">Все типы</option>
                    {typeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6 col-xl-3 mb-3">
                  <label className="mb-2 text-muted small d-block">
                    Отрасль
                  </label>
                  <select
                    className="form-control"
                    name="industryFilter"
                    value={industryFilter}
                    onChange={this.handleFilterChange}
                  >
                    <option value="all">Все отрасли</option>
                    {industryOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-xl-2 mb-3">
                  <label className="mb-2 text-muted small d-block">
                    Сортировка
                  </label>
                  <select
                    className="form-control"
                    name="sortOrder"
                    value={sortOrder}
                    onChange={this.handleFilterChange}
                  >
                    <option value="newest">Сначала новые</option>
                    <option value="oldest">Сначала старые</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="text-muted">
                {isLoading
                  ? 'Загружаем модели...'
                  : `Найдено моделей: ${filteredItems.length}`}
              </div>
              <button
                type="button"
                className="btn btn-outline-light btn-sm"
                onClick={() => this.loadObjects()}
              >
                Обновить
              </button>
            </div>

            {error ? (
              <div className="alert alert-warning" role="alert">
                {error}
              </div>
            ) : null}

            {isLoading ? (
              <div className="text-muted">Загрузка списка моделей...</div>
            ) : filteredItems.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="table-responsive">
                <table className="table text-white">
                  <thead>
                    <tr>
                      <th>Модель</th>
                      <th>Тип</th>
                      <th>Отрасль</th>
                      <th>Регион</th>
                      <th>Класс</th>
                      <th>Критичность</th>
                      <th>Зрелость ИБ</th>
                      <th>Обновлено</th>
                      <th className="text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item._id} className="text-white">
                        <td>
                          <div className="font-weight-bold">
                            {item.objectName}
                          </div>
                          <div className="text-muted small">
                            {item.subIndustry || 'Подотрасль не указана'}
                          </div>
                        </td>
                        <td>{item.objectType}</td>
                        <td>{item.industry}</td>
                        <td>{item.region || 'Не указан'}</td>
                        <td>{item.criticalityClass}</td>
                        <td>{formatScore(item.businessCriticality)}</td>
                        <td>{item.securityMaturity}</td>
                        <td>{formatDate(item.updatedAt || item.createdAt)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            disabled={deletingId === item._id}
                            onClick={() => this.handleDelete(item)}
                          >
                            {deletingId === item._id
                              ? 'Удаляем...'
                              : 'Удалить'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ObjectModelsList;
