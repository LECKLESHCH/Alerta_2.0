import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Form } from 'react-bootstrap';
import { login } from '../../api/auth';
import { isAuthenticated, setAuthSession } from '../../auth/storage';

export class Login extends Component {
  state = {
    email: '',
    password: '',
    error: '',
    isSubmitting: false,
  };

  componentDidMount() {
    if (isAuthenticated()) {
      this.redirectAfterLogin();
    }
  }

  getNextPath() {
    const params = new URLSearchParams(this.props.location.search || '');
    return params.get('next') || '/dashboard';
  }

  redirectAfterLogin() {
    this.props.history.push(this.getNextPath());
  }

  handleChange = (event) => {
    this.setState({
      [event.target.name]: event.target.value,
    });
  };

  handleSubmit = async (event) => {
    event.preventDefault();
    this.setState({ error: '', isSubmitting: true });

    try {
      const authPayload = await login({
        email: this.state.email,
        password: this.state.password,
      });

      setAuthSession(authPayload);
      this.redirectAfterLogin();
    } catch (error) {
      this.setState({
        error: error.message || 'Не удалось выполнить вход',
        isSubmitting: false,
      });
      return;
    }

    this.setState({ isSubmitting: false });
  };

  render() {
    return (
      <div>
        <div className="d-flex align-items-center auth px-0">
          <div className="row w-100 mx-0">
            <div className="col-lg-4 mx-auto">
              <div className="card text-left py-5 px-4 px-sm-5">
                <div className="brand-logo text-center">
                  <img src={require("../../assets/images/logo.png")} alt="logo" />
                </div>
                <h4>Вход</h4>
                <Form className="pt-3" onSubmit={this.handleSubmit}>
                  <Form.Group className="d-flex search-field">
                    <Form.Control
                      type="email"
                      name="email"
                      placeholder="Рабочий email"
                      size="lg"
                      className="h-auto"
                      value={this.state.email}
                      onChange={this.handleChange}
                    />
                  </Form.Group>
                  <Form.Group className="d-flex search-field">
                    <Form.Control
                      type="password"
                      name="password"
                      placeholder="Пароль"
                      size="lg"
                      className="h-auto"
                      value={this.state.password}
                      onChange={this.handleChange}
                    />
                  </Form.Group>
                  {this.state.error ? (
                    <div className="text-danger small mb-3">{this.state.error}</div>
                  ) : null}
                  <div className="mt-3">
                    <button
                      type="submit"
                      className="btn btn-block btn-primary btn-lg font-weight-medium auth-form-btn"
                      disabled={this.state.isSubmitting}
                    >
                      {this.state.isSubmitting ? 'ВХОД...' : 'ВОЙТИ'}
                    </button>
                  </div>
                  <div className="mt-3">
                    <Link
                      className="btn btn-block btn-primary btn-lg font-weight-medium auth-form-btn"
                      to="/user-pages/register-1"
                    >
                      РЕГИСТРАЦИЯ
                    </Link>
                  </div>
                  <div className="my-2 d-flex justify-content-between align-items-center">
                    <div className="form-check">
                      <label className="form-check-label text-muted">
                        <input type="checkbox" className="form-check-input"/>
                        <i className="input-helper"></i>
                        Использовать доверенное устройство
                      </label>
                    </div>
                    <a href="!#" onClick={event => event.preventDefault()} className="auth-link text-muted">Восстановить доступ</a>
                  </div>
                  <div className="mb-2">
                  </div>
                </Form>
              </div>
            </div>
          </div>
        </div>  
      </div>
    )
  }
}

export default Login
