import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider, ConfirmProvider } from './components/Overlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import CookieConsent from './components/CookieConsent'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import { PageFallback } from './components/Skeleton'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const CertificatesPage = lazy(() => import('./pages/CertificatesPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'))
const FoodPage = lazy(() => import('./pages/FoodPage'))
const MasterDataPage = lazy(() => import('./pages/MasterDataPage'))
const ParticipantsPage = lazy(() => import('./pages/ParticipantsPage'))
const ParticipantDetailPage = lazy(() => import('./pages/ParticipantDetailPage'))
const ProgramsListPage = lazy(() => import('./pages/ProgramsListPage'))
const ProgramDetailPage = lazy(() => import('./pages/ProgramDetailPage'))
const ProgramWizardPage = lazy(() => import('./pages/ProgramWizardPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SessionsPage = lazy(() => import('./pages/SessionsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const StatusMatrixPage = lazy(() => import('./pages/StatusMatrixPage'))
const ProgramLinksQrPage = lazy(() => import('./pages/ProgramLinksQrPage'))
const QrScannerPage = lazy(() => import('./pages/QrScannerPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const SecurityPage = lazy(() => import('./pages/SecurityPage'))
const PublicProgramPage = lazy(() => import('./pages/public/PublicProgramPage'))
const PublicRegisterPage = lazy(() => import('./pages/public/PublicRegisterPage'))
const PublicFeedbackPage = lazy(() => import('./pages/public/PublicFeedbackPage'))
const PublicAttendancePage = lazy(() => import('./pages/public/PublicAttendancePage'))
const CertificateVerifyPage = lazy(() => import('./pages/public/CertificateVerifyPage'))
const MyQrsPage = lazy(() => import('./pages/public/MyQrsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/public/LegalPages').then((m) => ({ default: m.PrivacyPolicyPage })))
const TermsPage = lazy(() => import('./pages/public/LegalPages').then((m) => ({ default: m.TermsPage })))
const CookiePolicyPage = lazy(() => import('./pages/public/LegalPages').then((m) => ({ default: m.CookiePolicyPage })))
const RefundPolicyPage = lazy(() => import('./pages/public/LegalPages').then((m) => ({ default: m.RefundPolicyPage })))

const PublicLayout = lazy(() => import('./layouts/PublicLayout'))

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <ErrorBoundary>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />

                  {/* Public portal */}
                  <Route element={<PublicLayout />}>
                    <Route path="/p/:token" element={<PublicProgramPage />} />
                    <Route path="/p/:token/register" element={<PublicRegisterPage />} />
                    <Route path="/p/:token/feedback" element={<PublicFeedbackPage />} />
                    <Route path="/p/:token/attendance" element={<PublicAttendancePage />} />
                    <Route path="/verify" element={<CertificateVerifyPage />} />
                    <Route path="/my-qrs" element={<MyQrsPage />} />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/cookies" element={<CookiePolicyPage />} />
                    <Route path="/refunds" element={<RefundPolicyPage />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/programs" element={<ProgramsListPage />} />
                    <Route path="/programs/wizard" element={<ProgramWizardPage />} />
                    <Route path="/programs/wizard/:id" element={<ProgramWizardPage />} />
                    <Route path="/programs/:id" element={<ProgramDetailPage />} />
                    <Route path="/programs/:id/links" element={<ProgramLinksQrPage />} />
                    <Route path="/sessions" element={<SessionsPage />} />
                    <Route path="/participants" element={<ParticipantsPage />} />
                    <Route path="/participants/:id" element={<ParticipantDetailPage />} />
                    <Route path="/participants/status" element={<StatusMatrixPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/food" element={<FoodPage />} />
                    <Route path="/food/scan" element={<QrScannerPage />} />
                    <Route path="/feedback" element={<FeedbackPage />} />
                    <Route path="/certificates" element={<CertificatesPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/documents" element={<DocumentsPage />} />
                    <Route path="/master-data" element={<MasterDataPage />} />
                    <Route path="/master-data/:key" element={<MasterDataPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/audit" element={<AuditPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/account/security" element={<SecurityPage />} />
                  </Route>

                  <Route path="*" element={<LoginPage />} />
                </Routes>
                <CookieConsent />
              </ErrorBoundary>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}