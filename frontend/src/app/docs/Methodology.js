import React, { Component } from 'react';

function DocSection({ title, children }) {
  return (
    <div className="card grid-margin">
      <div className="card-body">
        <h4 className="card-title">{title}</h4>
        <div className="text-muted">{children}</div>
      </div>
    </div>
  );
}

export class Methodology extends Component {
  render() {
    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Методика и регламент работы</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={(event) => event.preventDefault()}>
                  Служебная документация
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Методика
              </li>
            </ol>
          </nav>
        </div>

        <DocSection title="Назначение системы">
          <p>
            ALERTA 2.0 предназначена для сбора, классификации и аналитического представления
            публикаций по киберугрозам в контексте защищаемого объекта или критической
            инфраструктуры. Система помогает сократить путь от потока внешних материалов
            до понятной оперативной картины и подготовленного отчета.
          </p>
        </DocSection>

        <DocSection title="Как устроен рабочий контур">
          <div className="row">
            <div className="col-md-4">
              <h6 className="text-white mb-2">1. Сбор</h6>
              <p>
                Backend получает материалы из подключенных источников, приводит их к
                единому формату и сохраняет в локальную базу данных.
              </p>
            </div>
            <div className="col-md-4">
              <h6 className="text-white mb-2">2. Классификация</h6>
              <p>
                Материалы размечаются по типу, категории угроз, severity, confidence и
                дополнительным аналитическим признакам.
              </p>
            </div>
            <div className="col-md-4">
              <h6 className="text-white mb-2">3. Аналитика</h6>
              <p>
                На клиенте формируются срезы по динамике, источникам, приоритетам,
                географии и профилю угроз для принятия решений.
              </p>
            </div>
          </div>
        </DocSection>

        <DocSection title="Порядок использования">
          <ol className="pl-3 mb-0">
            <li className="mb-2">
              Открыть <span className="text-white">Панель угроз</span> и проверить, что в базе есть
              актуальные публикации.
            </li>
            <li className="mb-2">
              Использовать разделы <span className="text-white">Содержание</span> и{' '}
              <span className="text-white">Реестр угроз</span> для уточнения конкретных материалов и
              сопоставления с объектной моделью.
            </li>
            <li className="mb-2">
              В <span className="text-white">Метриках риска</span> оценить динамику потока и
              характер сигналов за интересующий период.
            </li>
            <li>
              Во вкладке <span className="text-white">Отчет</span> сформировать документ,
              настроить состав разделов и выгрузить PDF.
            </li>
          </ol>
        </DocSection>

        <DocSection title="Что означают ключевые блоки интерфейса">
          <div className="row">
            <div className="col-md-6">
              <h6 className="text-white mb-2">Панель угроз</h6>
              <p>
                Сводный экран по текущей обстановке: последние материалы, структура угроз,
                объяснимые метрики качества классификации, приоритетные записи и география.
              </p>
            </div>
            <div className="col-md-6">
              <h6 className="text-white mb-2">Конструктор отчета</h6>
              <p>
                Рабочее место для подготовки аналитического документа с выбором периода,
                состава секций, редактурой текста и экспортом в PDF.
              </p>
            </div>
          </div>
        </DocSection>

        <DocSection title="Принцип оценки угроз">
          <p>
            Приоритизация строится не по одному полю, а по совокупности признаков:
            severity, уверенность классификации, признаки активной эксплуатации и
            ожидаемый ущерб по модели CIA. Это позволяет поднимать наверх не просто
            «громкие» публикации, а записи с наибольшей прикладной ценностью для анализа.
          </p>
        </DocSection>

        <DocSection title="Ограничения и допущения">
          <ul className="pl-3 mb-0">
            <li className="mb-2">
              Часть аналитических полей зависит от качества исходной публикации и полноты
              извлечения данных.
            </li>
            <li className="mb-2">
              География и severity могут отсутствовать, если источник не содержит
              достаточного контекста.
            </li>
            <li>
              Итоговый отчет является аналитической заготовкой и при необходимости
              должен проходить ручную верификацию перед отправкой наружу.
            </li>
          </ul>
        </DocSection>
      </div>
    );
  }
}

export default Methodology;
