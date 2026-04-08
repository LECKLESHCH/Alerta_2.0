import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../../api/auth';
import { isAuthenticated, setAuthSession } from '../../auth/storage';

export class Register extends Component {
  state = {
    displayName: '',
    email: '',
    password: '',
    agreed: false,
    error: '',
    isSubmitting: false,
  };

  componentDidMount() {
    if (isAuthenticated()) {
      this.props.history.push('/dashboard');
    }
  }

  handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    this.setState({
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  handleSubmit = async (event) => {
    event.preventDefault();

    if (!this.state.agreed) {
      this.setState({ error: 'Нужно подтвердить регламент доступа' });
      return;
    }

    this.setState({ error: '', isSubmitting: true });

    try {
      const authPayload = await register({
        displayName: this.state.displayName,
        email: this.state.email,
        password: this.state.password,
      });

      setAuthSession(authPayload);
      this.props.history.push('/dashboard');
    } catch (error) {
      this.setState({
        error: error.message || 'Не удалось создать учетную запись',
        isSubmitting: false,
      });
      return;
    }

    this.setState({ isSubmitting: false });
  };

  render() {
    return (
      <div>
        <div className="d-flex align-items-center auth px-0 h-100">
          <div className="row w-100 mx-0">
            <div className="col-lg-4 mx-auto">
              <div className="card text-left py-5 px-4 px-sm-5">
                <div className="brand-logo text-center">
                  <img src={require("../../assets/images/logo.png")} alt="logo" />
                </div>
                <h4>Регистрация</h4>
                <form className="pt-3" onSubmit={this.handleSubmit}>
                  <div className="form-group">
                    <input
                      type="text"
                      name="displayName"
                      className="form-control form-control-lg"
                      placeholder="Имя администратора или команды"
                      value={this.state.displayName}
                      onChange={this.handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="email"
                      name="email"
                      className="form-control form-control-lg"
                      placeholder="Рабочий email"
                      value={this.state.email}
                      onChange={this.handleChange}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="password"
                      name="password"
                      className="form-control form-control-lg"
                      placeholder="Пароль"
                      value={this.state.password}
                      onChange={this.handleChange}
                    />
                  </div>
                  {this.state.error ? (
                    <div className="text-danger small mb-3">{this.state.error}</div>
                  ) : null}
                  <div className="mb-4">
                    <div className="form-check">
                      <label className="form-check-label text-muted">
                        <input
                          type="checkbox"
                          name="agreed"
                          className="form-check-input"
                          checked={this.state.agreed}
                          onChange={this.handleChange}
                        />
                        <i className="input-helper"></i>
                        Согласен с регламентом доступа и политикой обработки данных
                      </label>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="submit"
                      className="btn btn-block btn-primary btn-lg font-weight-medium auth-form-btn"
                      disabled={this.state.isSubmitting}
                    >
                      {this.state.isSubmitting ? 'РЕГИСТРАЦИЯ...' : 'ЗАРЕГИСТРИРОВАТЬСЯ'}
                    </button>
                  </div>
                  <div className="mt-3">
                    <Link
                      className="btn btn-block btn-primary btn-lg font-weight-medium auth-form-btn"
                      to="/user-pages/login-1"
                    >
                      ВОЙТИ
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Register
