import React, { Component,Suspense, lazy } from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';

import Spinner from '../app/shared/Spinner';
import ProtectedRoute from './shared/ProtectedRoute';

const Dashboard = lazy(() => import('./dashboard/Dashboard'));

const Buttons = lazy(() => import('./basic-ui/Buttons'));
const Dropdowns = lazy(() => import('./basic-ui/Dropdowns'));
const Typography = lazy(() => import('./basic-ui/Typography'));

const BasicElements = lazy(() => import('./form-elements/BasicElements'));
const ObjectModelsList = lazy(() => import('./form-elements/ObjectModelsList'));

const BasicTable = lazy(() => import('./tables/BasicTable'));

const Mdi = lazy(() => import('./icons/Mdi'));
const Methodology = lazy(() => import('./docs/Methodology'));

const ChartJs = lazy(() => import('./charts/ChartJs'));

const Error404 = lazy(() => import('./error-pages/Error404'));
const Error500 = lazy(() => import('./error-pages/Error500'));

const Login = lazy(() => import('./user-pages/Login'));
const Register1 = lazy(() => import('./user-pages/Register'));


class AppRoutes extends Component {
  render () {
    return (
      <Suspense fallback={<Spinner/>}>
        <Switch>
          <ProtectedRoute exact path="/dashboard" component={ Dashboard } />

          <ProtectedRoute path="/basic-ui/buttons" component={ Buttons } />
          <ProtectedRoute path="/basic-ui/dropdowns" component={ Dropdowns } />
          <ProtectedRoute path="/basic-ui/typography" component={ Typography } />

          <ProtectedRoute path="/form-elements/basic-elements" component={ BasicElements } />
          <ProtectedRoute path="/form-elements/object-models" component={ ObjectModelsList } />

          <ProtectedRoute path="/tables/basic-table" component={ BasicTable } />

          <ProtectedRoute path="/icons/mdi" component={ Mdi } />
          <ProtectedRoute path="/docs/methodology" component={ Methodology } />

          <ProtectedRoute path="/charts/chart-js" component={ ChartJs } />


          <Route path="/user-pages/login-1" component={ Login } />
          <Route path="/user-pages/register-1" component={ Register1 } />

          <Route path="/error-pages/error-404" component={ Error404 } />
          <Route path="/error-pages/error-500" component={ Error500 } />


          <Redirect to="/dashboard" />
        </Switch>
      </Suspense>
    );
  }
}

export default AppRoutes;
