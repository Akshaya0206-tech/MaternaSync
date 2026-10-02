import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '../auth/roleHome';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { LandingPage } from '../pages/LandingPage';
import { NotFound } from '../pages/NotFound';
import { SignInPage } from './SignInPage';
import { SignUpPage } from './SignUpPage';
import { LegacyAppPage } from './LegacyAppPage';
import { RequireRole } from './RequireRole';
import { RequireAuth } from './RequireAuth';
import { PatientShell } from '../roles/patient/PatientShell';
import { MyCarePage } from '../roles/patient/MyCarePage';
import { MyRecordsPage } from '../roles/patient/MyRecordsPage';
import { MyQuestionsPage } from '../roles/patient/MyQuestionsPage';
import { AppointmentsPage } from '../roles/patient/AppointmentsPage';
import { UpdatesPage as PatientUpdatesPage } from '../roles/patient/UpdatesPage';
import { ProfilePage as PatientProfilePage } from '../roles/patient/ProfilePage';
import { JourneyPage } from '../roles/patient/JourneyPage';
import { CareTeamShell } from '../roles/careteam/CareTeamShell';
import { DashboardPage as CareTeamDashboardPage } from '../roles/careteam/DashboardPage';
import { PatientsListPage } from '../roles/careteam/PatientsListPage';
import { PatientWorkspacePage } from '../roles/careteam/PatientWorkspacePage';
import { DocumentsQueuePage } from '../roles/careteam/DocumentsQueuePage';
import { DocumentReviewPage } from '../roles/careteam/DocumentReviewPage';
import { QuestionsPage as CareTeamQuestionsPage } from '../roles/careteam/QuestionsPage';
import { TasksPage } from '../roles/careteam/TasksPage';
import { ReferralsPage } from '../roles/careteam/ReferralsPage';
import { HandoverPage } from '../roles/careteam/HandoverPage';
import { UpdatesPage as CareTeamUpdatesPage } from '../roles/careteam/UpdatesPage';
import { ProfilePage as CareTeamProfilePage } from '../roles/careteam/ProfilePage';
import { DoctorShell } from '../roles/doctor/DoctorShell';
import { DashboardPage as DoctorDashboardPage } from '../roles/doctor/DashboardPage';
import { PatientsListPage as DoctorPatientsListPage } from '../roles/doctor/PatientsListPage';
import { PatientWorkspacePage as DoctorPatientWorkspacePage } from '../roles/doctor/PatientWorkspacePage';
import { TodaysBriefPage } from '../roles/doctor/TodaysBriefPage';
import { ConsultationsPage } from '../roles/doctor/ConsultationsPage';
import { DocumentationHistoryPage } from '../roles/doctor/DocumentationHistoryPage';
import { QuestionsPage as DoctorQuestionsPage } from '../roles/doctor/QuestionsPage';
import { FollowUpsPage } from '../roles/doctor/FollowUpsPage';
import { HandoverPage as DoctorHandoverPage } from '../roles/doctor/HandoverPage';
import { UpdatesPage as DoctorUpdatesPage } from '../roles/doctor/UpdatesPage';
import { ProfilePage as DoctorProfilePage } from '../roles/doctor/ProfilePage';

function RootRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;
  return <LandingPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/legacy" element={<RequireAuth><LegacyAppPage /></RequireAuth>} />

      <Route path="/patient" element={<RequireRole role="patient"><PatientShell /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<MyCarePage />} />
        <Route path="records" element={<MyRecordsPage />} />
        <Route path="questions" element={<MyQuestionsPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="updates" element={<PatientUpdatesPage />} />
        <Route path="profile" element={<PatientProfilePage />} />
        <Route path="journey" element={<JourneyPage />} />
      </Route>

      <Route path="/care-team" element={<RequireRole role="care_team"><CareTeamShell /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CareTeamDashboardPage />} />
        <Route path="patients" element={<PatientsListPage />} />
        <Route path="patients/:episodeId" element={<PatientWorkspacePage />} />
        <Route path="documents" element={<DocumentsQueuePage />} />
        <Route path="documents/:documentId" element={<DocumentReviewPage />} />
        <Route path="questions" element={<CareTeamQuestionsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="referrals" element={<ReferralsPage />} />
        <Route path="handover" element={<HandoverPage />} />
        <Route path="updates" element={<CareTeamUpdatesPage />} />
        <Route path="profile" element={<CareTeamProfilePage />} />
      </Route>

      <Route path="/doctor" element={<RequireRole role="doctor"><DoctorShell /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DoctorDashboardPage />} />
        <Route path="patients" element={<DoctorPatientsListPage />} />
        <Route path="patients/:episodeId" element={<DoctorPatientWorkspacePage />} />
        <Route path="todays-brief" element={<TodaysBriefPage />} />
        <Route path="consultations" element={<ConsultationsPage />} />
        <Route path="questions" element={<DoctorQuestionsPage />} />
        <Route path="documentation" element={<DocumentationHistoryPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="handover" element={<DoctorHandoverPage />} />
        <Route path="updates" element={<DoctorUpdatesPage />} />
        <Route path="profile" element={<DoctorProfilePage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
