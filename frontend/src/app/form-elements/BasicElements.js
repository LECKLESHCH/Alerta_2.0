import React, { Component } from 'react';
import { Form } from 'react-bootstrap';
import { createObjectPassport } from '../../api/objects';

const objectTypes = [
  'АСУ ТП',
  'ЦОД',
  'Сервисный портал',
  'Сегмент сети',
  'АРМ оператора',
  'Система мониторинга',
];

const industries = [
  'Энергетика',
  'Транспорт',
  'Финансы',
  'Госсектор',
  'Телеком',
  'Промышленность',
];

const criticalityClasses = ['К1', 'К2', 'К3'];
const maturityLevels = ['Низкая', 'Средняя', 'Высокая'];

const initialFormState = {
  objectName: '',
  objectType: 'ЦОД',
  criticalityClass: 'К2',
  industry: 'Энергетика',
  subIndustry: '',
  region: '',
  ownerUnit: '',
  businessCriticality: 0.8,
  impactConfidentiality: 0.7,
  impactIntegrity: 0.9,
  impactAvailability: 1,
  downtimeTolerance: '',
  attackSurface: 0.6,
  remoteAccessLevel: 0.7,
  integrationLevel: '',
  internetExposed: true,
  contractorAccess: false,
  userInteractionDependency: false,
  isIcs: true,
  segmentationLevel: 0.6,
  legacyShare: 0.4,
  cloudPresence: 0.2,
  securityMaturity: 'Средняя',
  monitoringMaturity: 'Средняя',
  patchMaturity: 'Средняя',
  comments: '',
};

function renderOptions(items) {
  return items.map((item) => (
    <option key={item} value={item}>
      {item}
    </option>
  ));
}

function SectionCard({ title, description, children }) {
  return (
    <div className="card">
      <div className="card-body">
        <h4 className="card-title">{title}</h4>
        <p className="card-description">{description}</p>
        {children}
      </div>
    </div>
  );
}

function ScoreField({
  id,
  name,
  label,
  value,
  onChange,
  helperText,
}) {
  return (
    <Form.Group>
      <div className="d-flex align-items-center justify-content-between">
        <label htmlFor={id} className="mb-1">
          {label}
        </label>
        <span className="text-muted">{Number(value).toFixed(1)}</span>
      </div>
      <Form.Control
        type="range"
        className="form-control-range"
        id={id}
        name={name}
        min="0"
        max="1"
        step="0.1"
        value={value}
        onChange={onChange}
      />
      {helperText ? <small className="text-muted">{helperText}</small> : null}
    </Form.Group>
  );
}

export class BasicElements extends Component {
  state = {
    form: { ...initialFormState },
    isSaving: false,
    saveError: '',
    saveSuccess: '',
    savedObjectId: '',
  };

  handleInputChange = (event) => {
    const { name, type, checked, value } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    this.setState((prevState) => ({
      form: {
        ...prevState.form,
        [name]: type === 'range' ? Number(nextValue) : nextValue,
      },
      saveError: '',
      saveSuccess: '',
    }));
  };

  handleReset = () => {
    this.setState({
      form: { ...initialFormState },
      isSaving: false,
      saveError: '',
      saveSuccess: '',
      savedObjectId: '',
    });
  };

  handleSubmit = async (event) => {
    event.preventDefault();

    this.setState({
      isSaving: true,
      saveError: '',
      saveSuccess: '',
      savedObjectId: '',
    });

    try {
      const saved = await createObjectPassport(this.state.form);

      this.setState({
        isSaving: false,
        saveError: '',
        saveSuccess: 'Паспорт КИИ сохранён в базе данных.',
        savedObjectId: saved?._id || '',
      });
    } catch (error) {
      this.setState({
        isSaving: false,
        saveError: error.message || 'Не удалось сохранить паспорт КИИ.',
        saveSuccess: '',
        savedObjectId: '',
      });
    }
  };

  render() {
    const { form, isSaving, saveError, saveSuccess, savedObjectId } = this.state;

    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Паспорт КИИ</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Модель объекта
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Паспорт КИИ
              </li>
            </ol>
          </nav>
        </div>

        <Form onSubmit={this.handleSubmit}>
          <div className="row">
            <div className="col-12 grid-margin">
              <SectionCard
                title="Профиль объекта"
                description="Базовая идентификация объекта и его роль в модели риска."
              >
                <div className="row">
                  <div className="col-md-6">
                    <Form.Group>
                      <label htmlFor="objectName">Наименование объекта</label>
                      <Form.Control
                        type="text"
                        id="objectName"
                        name="objectName"
                        value={form.objectName}
                        onChange={this.handleInputChange}
                        placeholder="Региональный центр обработки данных"
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-6">
                    <Form.Group>
                      <label htmlFor="objectType">Тип объекта</label>
                      <select
                        className="form-control"
                        id="objectType"
                        name="objectType"
                        value={form.objectType}
                        onChange={this.handleInputChange}
                      >
                        {renderOptions(objectTypes)}
                      </select>
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group>
                      <label htmlFor="criticalityClass">Класс значимости</label>
                      <select
                        className="form-control"
                        id="criticalityClass"
                        name="criticalityClass"
                        value={form.criticalityClass}
                        onChange={this.handleInputChange}
                      >
                        {renderOptions(criticalityClasses)}
                      </select>
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group>
                      <label htmlFor="industry">Отрасль</label>
                      <select
                        className="form-control"
                        id="industry"
                        name="industry"
                        value={form.industry}
                        onChange={this.handleInputChange}
                      >
                        {renderOptions(industries)}
                      </select>
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group>
                      <label htmlFor="subIndustry">Подотрасль</label>
                      <Form.Control
                        type="text"
                        id="subIndustry"
                        name="subIndustry"
                        value={form.subIndustry}
                        onChange={this.handleInputChange}
                        placeholder="Генерация / распределение / сбыт"
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-6">
                    <Form.Group>
                      <label htmlFor="region">Регион</label>
                      <Form.Control
                        type="text"
                        id="region"
                        name="region"
                        value={form.region}
                        onChange={this.handleInputChange}
                        placeholder="Россия / Центральный федеральный округ"
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-6">
                    <Form.Group>
                      <label htmlFor="ownerUnit">Ответственное подразделение</label>
                      <Form.Control
                        type="text"
                        id="ownerUnit"
                        name="ownerUnit"
                        value={form.ownerUnit}
                        onChange={this.handleInputChange}
                        placeholder="Центр мониторинга ИБ"
                      />
                    </Form.Group>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="col-md-6 grid-margin stretch-card">
              <SectionCard
                title="Бизнес-критичность"
                description="Поля, которые потом будут влиять на вес объекта в расчёте риска."
              >
                <ScoreField
                  id="businessCriticality"
                  label="Бизнес-критичность объекта"
                  value={form.businessCriticality}
                  onChange={this.handleInputChange}
                  helperText="От 0 до 1. Чем выше, тем сильнее объект влияет на итоговый риск."
                  name="businessCriticality"
                />
                <ScoreField
                  id="impactConfidentiality"
                  label="Влияние на конфиденциальность"
                  value={form.impactConfidentiality}
                  onChange={this.handleInputChange}
                  name="impactConfidentiality"
                />
                <ScoreField
                  id="impactIntegrity"
                  label="Влияние на целостность"
                  value={form.impactIntegrity}
                  onChange={this.handleInputChange}
                  name="impactIntegrity"
                />
                <ScoreField
                  id="impactAvailability"
                  label="Влияние на доступность"
                  value={form.impactAvailability}
                  onChange={this.handleInputChange}
                  name="impactAvailability"
                />
                <Form.Group>
                  <label htmlFor="downtimeTolerance">Допустимый простой</label>
                  <Form.Control
                    type="text"
                    id="downtimeTolerance"
                    name="downtimeTolerance"
                    value={form.downtimeTolerance}
                    onChange={this.handleInputChange}
                    placeholder="Не более 30 минут"
                  />
                </Form.Group>
              </SectionCard>
            </div>

            <div className="col-md-6 grid-margin stretch-card">
              <SectionCard
                title="Экспозиция объекта"
                description="Параметры, которые будут связаны с векторами атаки и доступностью объекта."
              >
                <ScoreField
                  id="attackSurface"
                  label="Оценка поверхности атаки"
                  value={form.attackSurface}
                  onChange={this.handleInputChange}
                  name="attackSurface"
                />
                <ScoreField
                  id="remoteAccessLevel"
                  label="Уровень удалённого доступа"
                  value={form.remoteAccessLevel}
                  onChange={this.handleInputChange}
                  name="remoteAccessLevel"
                />
                <Form.Group>
                  <label htmlFor="integrationLevel">Внешние интеграции</label>
                  <Form.Control
                    type="text"
                    id="integrationLevel"
                    name="integrationLevel"
                    value={form.integrationLevel}
                    onChange={this.handleInputChange}
                    placeholder="VPN, подрядчики, API, веб-сервисы"
                  />
                </Form.Group>
                <div className="form-check mb-2">
                  <label className="form-check-label text-muted">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      name="internetExposed"
                      checked={form.internetExposed}
                      onChange={this.handleInputChange}
                    />
                    Объект доступен из внешней сети
                    <i className="input-helper"></i>
                  </label>
                </div>
                <div className="form-check mb-2">
                  <label className="form-check-label text-muted">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      name="contractorAccess"
                      checked={form.contractorAccess}
                      onChange={this.handleInputChange}
                    />
                    Есть доступ подрядчиков
                    <i className="input-helper"></i>
                  </label>
                </div>
                <div className="form-check">
                  <label className="form-check-label text-muted">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      name="userInteractionDependency"
                      checked={form.userInteractionDependency}
                      onChange={this.handleInputChange}
                    />
                    Высокая зависимость от действий пользователя
                    <i className="input-helper"></i>
                  </label>
                </div>
              </SectionCard>
            </div>

            <div className="col-md-6 grid-margin stretch-card">
              <SectionCard
                title="Технологический профиль"
                description="Признаки архитектуры, которые помогут сопоставлять объект с типами угроз."
              >
                <div className="form-check mb-3">
                  <label className="form-check-label text-muted">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      name="isIcs"
                      checked={form.isIcs}
                      onChange={this.handleInputChange}
                    />
                    Объект относится к АСУ ТП / технологическому сегменту
                    <i className="input-helper"></i>
                  </label>
                </div>
                <ScoreField
                  id="segmentationLevel"
                  label="Уровень сегментации"
                  value={form.segmentationLevel}
                  onChange={this.handleInputChange}
                  name="segmentationLevel"
                />
                <ScoreField
                  id="legacyShare"
                  label="Доля legacy-компонентов"
                  value={form.legacyShare}
                  onChange={this.handleInputChange}
                  name="legacyShare"
                />
                <ScoreField
                  id="cloudPresence"
                  label="Облачное присутствие"
                  value={form.cloudPresence}
                  onChange={this.handleInputChange}
                  name="cloudPresence"
                />
              </SectionCard>
            </div>

            <div className="col-md-6 grid-margin stretch-card">
              <SectionCard
                title="Зрелость защиты"
                description="Здесь задаются качественные оценки защитных мер, которые позже можно перевести в числовые веса."
              >
                <Form.Group>
                  <label htmlFor="securityMaturity">Зрелость ИБ</label>
                  <select
                    className="form-control"
                    id="securityMaturity"
                    name="securityMaturity"
                    value={form.securityMaturity}
                    onChange={this.handleInputChange}
                  >
                    {renderOptions(maturityLevels)}
                  </select>
                </Form.Group>
                <Form.Group>
                  <label htmlFor="monitoringMaturity">Зрелость мониторинга</label>
                  <select
                    className="form-control"
                    id="monitoringMaturity"
                    name="monitoringMaturity"
                    value={form.monitoringMaturity}
                    onChange={this.handleInputChange}
                  >
                    {renderOptions(maturityLevels)}
                  </select>
                </Form.Group>
                <Form.Group>
                  <label htmlFor="patchMaturity">Зрелость патч-менеджмента</label>
                  <select
                    className="form-control"
                    id="patchMaturity"
                    name="patchMaturity"
                    value={form.patchMaturity}
                    onChange={this.handleInputChange}
                  >
                    {renderOptions(maturityLevels)}
                  </select>
                </Form.Group>
              </SectionCard>
            </div>

            <div className="col-12 grid-margin">
              <SectionCard
                title="Рабочие комментарии"
                description="Наблюдения аналитика, которые пока не участвуют в формуле, но важны для паспорта."
              >
                <Form.Group className="mb-0">
                  <label htmlFor="comments">Комментарии</label>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    id="comments"
                    name="comments"
                    value={form.comments}
                    onChange={this.handleInputChange}
                    placeholder="Здесь можно зафиксировать особенности объекта, ограничения и наблюдения."
                  />
                </Form.Group>
              </SectionCard>
            </div>

            <div className="col-12 grid-margin">
              <div className="card">
                <div className="card-body">
                  <h4 className="card-title">Черновик паспорта</h4>
                  <p className="card-description mb-4">
                    После сохранения запись будет добавлена в коллекцию <code>objects</code>.
                  </p>
                  {saveSuccess ? (
                    <div className="alert alert-success" role="alert">
                      {saveSuccess}
                      {savedObjectId ? ` ID: ${savedObjectId}` : ''}
                    </div>
                  ) : null}
                  {saveError ? (
                    <div className="alert alert-danger" role="alert">
                      {saveError}
                    </div>
                  ) : null}
                  <div className="d-flex flex-wrap align-items-center">
                    <button
                      type="submit"
                      className="btn btn-success mr-3 mb-2 mb-sm-0"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Сохраняем...' : 'Сохранить паспорт'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={this.handleReset}
                      disabled={isSaving}
                    >
                      Очистить форму
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Form>
      </div>
    );
  }
}

export default BasicElements;
