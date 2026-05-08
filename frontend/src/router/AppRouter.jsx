import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout.jsx";
import { AppDataProvider } from "../context/AppDataContext.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import AuthCallbackPage from "../pages/AuthCallbackPage.jsx";
import { dashboardStartPageRoutes, readDashboardPreferences } from "../utils/dashboardPreferences.js";
import AppearancePreferencesPage from "../pages/AppearancePreferencesPage.jsx";
import ClientDetailPage from "../pages/ClientDetailPage.jsx";
import ClientsPage from "../pages/ClientsPage.jsx";
import CustomMetricsPage from "../pages/CustomMetricsPage.jsx";
import DashboardPreferencesPage from "../pages/DashboardPreferencesPage.jsx";
import DashboardPage from "../pages/DashboardPage.jsx";
import GoogleAdsMetricsPage from "../pages/GoogleAdsMetricsPage.jsx";
import IntegrationCallbackPage from "../pages/IntegrationCallbackPage.jsx";
import IntegrationsPage from "../pages/IntegrationsPage.jsx";
import ForgotPasswordPage from "../pages/ForgotPasswordPage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import MetaAdsMetricsPage from "../pages/MetaAdsMetricsPage.jsx";
import ResetPasswordPage from "../pages/ResetPasswordPage.jsx";
import MetricDetailPage from "../pages/MetricDetailPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import PermissionsAccessPage from "../pages/PermissionsAccessPage.jsx";
import PrivacyDataPage from "../pages/PrivacyDataPage.jsx";
import ProfilePage from "../pages/ProfilePage.jsx";
import RegisterPage from "../pages/RegisterPage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";
import ShopifyMetricsPage from "../pages/ShopifyMetricsPage.jsx";
import { APP_ROUTES } from "../utils/constants.js";
import ProtectedRoute from "./ProtectedRoute.jsx";

// Reads the saved startPage preference and redirects to the corresponding route.
// Applied only at the root path ("/") so direct navigation to any other route is never overridden.
function StartPageRedirect() {
  const prefs = readDashboardPreferences();
  const target = dashboardStartPageRoutes[prefs.startPage] ?? APP_ROUTES.dashboard;
  return <Navigate to={target} replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path={APP_ROUTES.root} element={<StartPageRedirect />} />
          <Route path={APP_ROUTES.login} element={<LoginPage />} />
          <Route path={APP_ROUTES.register} element={<RegisterPage />} />
          <Route path={APP_ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
          <Route path={APP_ROUTES.resetPassword} element={<ResetPasswordPage />} />
          <Route path={APP_ROUTES.authCallback} element={<AuthCallbackPage />} />

          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <AppDataProvider>
                  <AppLayout />
                </AppDataProvider>
              }
            >
              <Route path={APP_ROUTES.dashboard} element={<DashboardPage />} />
              <Route path={APP_ROUTES.shopify} element={<ShopifyMetricsPage />} />
              <Route path={APP_ROUTES.meta_ads} element={<MetaAdsMetricsPage />} />
              <Route path={APP_ROUTES.google_ads} element={<GoogleAdsMetricsPage />} />
              <Route path={APP_ROUTES.metricDetail} element={<MetricDetailPage />} />
              <Route path={APP_ROUTES.clients} element={<ClientsPage />} />
              <Route path={APP_ROUTES.clientDetail} element={<ClientDetailPage />} />
              <Route path={APP_ROUTES.integrations} element={<IntegrationsPage />} />
              <Route path={APP_ROUTES.integrationsCallback} element={<IntegrationCallbackPage />} />
              <Route path={APP_ROUTES.customMetrics} element={<CustomMetricsPage />} />
              <Route path={APP_ROUTES.profile} element={<ProfilePage />} />
              <Route path={APP_ROUTES.settings} element={<SettingsPage />} />
              <Route path={APP_ROUTES.dashboardPreferences} element={<DashboardPreferencesPage />} />
              <Route path={APP_ROUTES.appearancePreferences} element={<AppearancePreferencesPage />} />
              <Route path={APP_ROUTES.privacyData} element={<PrivacyDataPage />} />
              <Route path={APP_ROUTES.permissionsAccess} element={<PermissionsAccessPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
