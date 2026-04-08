import React, { Component } from 'react'
import { ProgressBar } from 'react-bootstrap';

export class BasicTable extends Component {
  render() {
    return (
      <div>
        <div className="page-header">
          <h3 className="page-title"> Реестр угроз и сопоставлений </h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item"><a href="!#" onClick={event => event.preventDefault()}>Реестр угроз</a></li>
              <li className="breadcrumb-item active" aria-current="page">Матрица сопоставления</li>
            </ol>
          </nav>
        </div>
        <div className="row">
          <div className="col-lg-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Текущие профили угроз</h4>
                <p className="card-description"> Поток статей, уже преобразованных в структурированные угрозы
                </p>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Профиль</th>
                        <th>ID</th>
                        <th>Обновлен</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>DDoS against public services</td>
                        <td>TH-204</td>
                        <td>05 Apr 2026</td>
                        <td><label className="badge badge-danger">Критично</label></td>
                      </tr>
                      <tr>
                        <td>Contractor access abuse</td>
                        <td>TH-205</td>
                        <td>05 Apr 2026</td>
                        <td><label className="badge badge-warning">В анализе</label></td>
                      </tr>
                      <tr>
                        <td>Supply-chain compromise</td>
                        <td>TH-199</td>
                        <td>04 Apr 2026</td>
                        <td><label className="badge badge-info">Нормализовано</label></td>
                      </tr>
                      <tr>
                        <td>Ransomware in industrial perimeter</td>
                        <td>TH-187</td>
                        <td>04 Apr 2026</td>
                        <td><label className="badge badge-success">Готово</label></td>
                      </tr>
                      <tr>
                        <td>Zero-day exploitation campaign</td>
                        <td>TH-206</td>
                        <td>05 Apr 2026</td>
                        <td><label className="badge badge-warning">В анализе</label></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Совпадение угроз с объектами</h4>
                <p className="card-description"> Насколько конкретная угроза релевантна профилю объекта КИИ
                </p>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Объект</th>
                        <th>Угроза</th>
                        <th>Match</th>
                        <th>Риск</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Энергоузел Север</td>
                        <td>Contractor access abuse</td>
                        <td className="text-success"> 82.10% <i className="mdi mdi-arrow-up"></i></td>
                        <td><label className="badge badge-danger">Высокий</label></td>
                      </tr>
                      <tr>
                        <td>Транспортный шлюз-3</td>
                        <td>DDoS against public services</td>
                        <td className="text-success"> 71.06% <i className="mdi mdi-arrow-up"></i></td>
                        <td><label className="badge badge-warning">Значимый</label></td>
                      </tr>
                      <tr>
                        <td>Госреестр сервисов</td>
                        <td>Supply-chain compromise</td>
                        <td className="text-success"> 65.00% <i className="mdi mdi-arrow-up"></i></td>
                        <td><label className="badge badge-info">Средний</label></td>
                      </tr>
                      <tr>
                        <td>АСУ ТП Волга</td>
                        <td>Ransomware in industrial perimeter</td>
                        <td className="text-success"> 82.00% <i className="mdi mdi-arrow-up"></i></td>
                        <td><label className="badge badge-success">Подтвержден</label></td>
                      </tr>
                      <tr>
                        <td>Региональный ЦОД</td>
                        <td>Zero-day exploitation campaign</td>
                        <td className="text-success"> 58.05% <i className="mdi mdi-arrow-up"></i></td>
                        <td><label className="badge badge-warning">В анализе</label></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Striped Table</h4>
                <p className="card-description"> Add className <code>.table-striped</code>
                </p>
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th> User </th>
                        <th> First name </th>
                        <th> Progress </th>
                        <th> Amount </th>
                        <th> Deadline </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1">
                          <img src={require("../../assets/images/faces/face1.jpg")} alt="user icon" />
                        </td>
                        <td> Herman Beck </td>
                        <td>
                          <ProgressBar variant="success" now={25} />
                        </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr>
                        <td className="py-1">
                          <img src={require("../../assets/images/faces/face2.jpg")} alt="user icon" />
                        </td>
                        <td> Messsy Adam </td>
                        <td>
                          <ProgressBar variant="danger" now={75} />
                        </td>
                        <td> $245.30 </td>
                        <td> July 1, 2015 </td>
                      </tr>
                      <tr>
                        <td className="py-1">
                          <img src={require("../../assets/images/faces/face3.jpg")} alt="user icon" />
                        </td>
                        <td> John Richards </td>
                        <td>
                          <ProgressBar variant="warning" now={90} />
                        </td>
                        <td> $138.00 </td>
                        <td> Apr 12, 2015 </td>
                      </tr>
                      <tr>
                        <td className="py-1">
                          <img src={require("../../assets/images/faces/face4.jpg")} alt="user icon" />
                        </td>
                        <td> Peter Meggik </td>
                        <td>
                          <ProgressBar variant="primary" now={50} />
                        </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr>
                        <td className="py-1">
                          <img src={require("../../assets/images/faces/face5.jpg")} alt="user icon" />
                        </td>
                        <td> Edward </td>
                        <td>
                          <ProgressBar variant="danger" now={60} />
                        </td>
                        <td> $ 160.25 </td>
                        <td> May 03, 2015 </td>
                      </tr>
                      <tr>
                        <td className="py-1">
                          <img src={require("../../assets/images/faces/face6.jpg")} alt="user icon" />
                        </td>
                        <td> John Doe </td>
                        <td>
                          <ProgressBar variant="info" now={65} />
                        </td>
                        <td> $ 123.21 </td>
                        <td> April 05, 2015 </td>
                      </tr>
                      <tr>
                        <td className="py-1">
                          <img src={require("../../assets/images/faces/face7.jpg")} alt="user icon" />
                        </td>
                        <td> Henry Tom </td>
                        <td>
                          <ProgressBar variant="warning" now={20} />
                        </td>
                        <td> $ 150.00 </td>
                        <td> June 16, 2015 </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Bordered table</h4>
                <p className="card-description"> Add className <code>.table-bordered</code>
                </p>
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th> # </th>
                        <th> First name </th>
                        <th> Progress </th>
                        <th> Amount </th>
                        <th> Deadline </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td> 1 </td>
                        <td> Herman Beck </td>
                        <td>
                          <ProgressBar variant="success" now={25} />
                        </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr>
                        <td> 2 </td>
                        <td> Messsy Adam </td>
                        <td>
                          <ProgressBar variant="danger" now={75} />
                        </td>
                        <td> $245.30 </td>
                        <td> July 1, 2015 </td>
                      </tr>
                      <tr>
                        <td> 3 </td>
                        <td> John Richards </td>
                        <td>
                          <ProgressBar variant="warning" now={90} />
                        </td>
                        <td> $138.00 </td>
                        <td> Apr 12, 2015 </td>
                      </tr>
                      <tr>
                        <td> 4 </td>
                        <td> Peter Meggik </td>
                        <td>
                          <ProgressBar variant="primary" now={50} />
                        </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr>
                        <td> 5 </td>
                        <td> Edward </td>
                        <td>
                          <ProgressBar variant="danger" now={35} />
                        </td>
                        <td> $ 160.25 </td>
                        <td> May 03, 2015 </td>
                      </tr>
                      <tr>
                        <td> 6 </td>
                        <td> John Doe </td>
                        <td>
                          <ProgressBar variant="info" now={65} />
                        </td>
                        <td> $ 123.21 </td>
                        <td> April 05, 2015 </td>
                      </tr>
                      <tr>
                        <td> 7 </td>
                        <td> Henry Tom </td>
                        <td>
                          <ProgressBar variant="warning" now={20} />
                        </td>
                        <td> $ 150.00 </td>
                        <td> June 16, 2015 </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Inverse table</h4>
                <p className="card-description"> Add className <code>.table-dark</code>
                </p>
                <div className="table-responsive">
                  <table className="table table-dark">
                    <thead>
                      <tr>
                        <th> # </th>
                        <th> First name </th>
                        <th> Amount </th>
                        <th> Deadline </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td> 1 </td>
                        <td> Herman Beck </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr>
                        <td> 2 </td>
                        <td> Messsy Adam </td>
                        <td> $245.30 </td>
                        <td> July 1, 2015 </td>
                      </tr>
                      <tr>
                        <td> 3 </td>
                        <td> John Richards </td>
                        <td> $138.00 </td>
                        <td> Apr 12, 2015 </td>
                      </tr>
                      <tr>
                        <td> 4 </td>
                        <td> Peter Meggik </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr>
                        <td> 5 </td>
                        <td> Edward </td>
                        <td> $ 160.25 </td>
                        <td> May 03, 2015 </td>
                      </tr>
                      <tr>
                        <td> 6 </td>
                        <td> John Doe </td>
                        <td> $ 123.21 </td>
                        <td> April 05, 2015 </td>
                      </tr>
                      <tr>
                        <td> 7 </td>
                        <td> Henry Tom </td>
                        <td> $ 150.00 </td>
                        <td> June 16, 2015 </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-12 stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Table with contextual classNames</h4>
                <p className="card-description"> Add className <code>.table-&#123;color&#125;</code>
                </p>
                <div className="table-responsive">
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th> # </th>
                        <th> First name </th>
                        <th> Product </th>
                        <th> Amount </th>
                        <th> Deadline </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="table-info">
                        <td> 1 </td>
                        <td> Herman Beck </td>
                        <td> Photoshop </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr className="table-warning">
                        <td> 2 </td>
                        <td> Messsy Adam </td>
                        <td> Flash </td>
                        <td> $245.30 </td>
                        <td> July 1, 2015 </td>
                      </tr>
                      <tr className="table-danger">
                        <td> 3 </td>
                        <td> John Richards </td>
                        <td> Premeire </td>
                        <td> $138.00 </td>
                        <td> Apr 12, 2015 </td>
                      </tr>
                      <tr className="table-success">
                        <td> 4 </td>
                        <td> Peter Meggik </td>
                        <td> After effects </td>
                        <td> $ 77.99 </td>
                        <td> May 15, 2015 </td>
                      </tr>
                      <tr className="table-primary">
                        <td> 5 </td>
                        <td> Edward </td>
                        <td> Illustrator </td>
                        <td> $ 160.25 </td>
                        <td> May 03, 2015 </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default BasicTable
