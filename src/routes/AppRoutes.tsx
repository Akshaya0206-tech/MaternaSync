import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '../auth/roleHome';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { LandingPage } from '../pages/LandingPage';
import { NotFound } from '../pages/NotFound';
import { SignInPage } from './SignInPage';
import { SignUpPage } from './SignUpPage';
import { RequireRole } from './RequireRole';
import { RequireAuth } from './RequireAuth';
import { lazyPage, named } from './lazyPage';

// Only the landing, sign-in and sign-up pages come with the first download. Every other screen, and each role's
// shell, is downloaded the first time it is opened (see lazyPage), so a patient's phone never fetches the doctor's
// or the care team's screens.
const shell = <LoadingScreen />;

const LegacyAppPage = lazyPage(() => import('./LegacyAppPage').then(named('LegacyAppPage')), shell);
const ExternalSimulatorPage = lazyPage(() => import('../pages/ExternalSimulatorPage').then(named('ExternalSimulatorPage')), shell);

// Patient
const PatientShell = lazyPage(() => import('../roles/patient/PatientShell').then(named('PatientShell')), shell);
const MyCarePage = lazyPage(() => import('../roles/patient/MyCarePage').then(named('MyCarePage')));
const MyRecordsPage = lazyPage(() => import('../roles/patient/MyRecordsPage').then(named('MyRecordsPage')));
const MyQuestionsPage = lazyPage(() => import('../roles/patient/MyQuestionsPage').then(named('MyQuestionsPage')));
const AppointmentsPage = lazyPage(() => import('../roles/patient/AppointmentsPage').then(named('AppointmentsPage')));
const PatientUpdatesPage = lazyPage(() => import('../roles/patient/UpdatesPage').then(named('UpdatesPage')));
const PatientProfilePage = lazyPage(() => import('../roles/patient/ProfilePage').then(named('ProfilePage')));
const JourneyPage = lazyPage(() => import('../roles/patient/JourneyPage').then(named('JourneyPage')));
const DailyLogPage = lazyPage(() => import('../roles/patient/DailyLogPage').then(named('DailyLogPage')));
const CarePlanPage = lazyPage(() => import('../roles/patient/SupportPages').then(named('CarePlanPage')));
const ConsentPage = lazyPage(() => import('../roles/patient/SupportPages').then(named('ConsentPage')));
const CompanionPage = lazyPage(() => import('../roles/patient/CompanionPage').then(named('CompanionPage')));
const EmergencyPage = lazyPage(() => import('../roles/patient/EmergencyPage').then(named('EmergencyPage')));
const GuidedCheckInPage = lazyPage(() => import('../roles/patient/GuidedCheckInPage').then(named('GuidedCheckInPage')));
// The References page carries a lot of text in four languages.
const ReferencesPage = lazyPage(() => import('../roles/patient/ReferencesPage').then(named('ReferencesPage')));

// Caregiver (a relative or friend the woman has invited)
const CaregiverShell = lazyPage(() => import('../roles/caregiver/CaregiverShell').then(named('CaregiverShell')), shell);
const CaregiverHomePage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverHomePage')));
const CaregiverAppointmentsPage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverAppointmentsPage')));
const CaregiverCheckInPage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverCheckInPage')));
const CaregiverNewCheckInPage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverNewCheckInPage')));
const CaregiverCarePlanPage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverCarePlanPage')));
const CaregiverQuestionsPage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverQuestionsPage')));
const CaregiverEmergencyPage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverEmergencyPage')));
const CaregiverUpdatesPage = lazyPage(() => import('../roles/caregiver/CaregiverPages').then(named('CaregiverUpdatesPage')));

// Care team (the sign-in is switched off on the server, but these screens are kept so it can be switched back on)
const CareTeamShell = lazyPage(() => import('../roles/careteam/CareTeamShell').then(named('CareTeamShell')), shell);
const CareTeamDashboardPage = lazyPage(() => import('../roles/careteam/DashboardPage').then(named('DashboardPage')));
const PatientsListPage = lazyPage(() => import('../roles/careteam/PatientsListPage').then(named('PatientsListPage')));
const PatientWorkspacePage = lazyPage(() => import('../roles/careteam/PatientWorkspacePage').then(named('PatientWorkspacePage')));
const DocumentsQueuePage = lazyPage(() => import('../roles/careteam/DocumentsQueuePage').then(named('DocumentsQueuePage')));
const DocumentReviewPage = lazyPage(() => import('../roles/careteam/DocumentReviewPage').then(named('DocumentReviewPage')));
const CareTeamQuestionsPage = lazyPage(() => import('../roles/careteam/QuestionsPage').then(named('QuestionsPage')));
const TasksPage = lazyPage(() => import('../roles/careteam/TasksPage').then(named('TasksPage')));
const ReferralsPage = lazyPage(() => import('../roles/careteam/ReferralsPage').then(named('ReferralsPage')));
const CareTeamReferralDetailPage = lazyPage(() => import('../roles/careteam/ReferralDetailPage').then(named('ReferralDetailPage')));
const HandoverPage = lazyPage(() => import('../roles/careteam/HandoverPage').then(named('HandoverPage')));
const CareTeamUpdatesPage = lazyPage(() => import('../roles/careteam/UpdatesPage').then(named('UpdatesPage')));
const CareTeamProfilePage = lazyPage(() => import('../roles/careteam/ProfilePage').then(named('ProfilePage')));

// Doctor
const DoctorShell = lazyPage(() => import('../roles/doctor/DoctorShell').then(named('DoctorShell')), shell);
const DoctorDashboardPage = lazyPage(() => import('../roles/doctor/DashboardPage').then(named('DashboardPage')));
const DoctorPatientsListPage = lazyPage(() => import('../roles/doctor/PatientsListPage').then(named('PatientsListPage')));
const DoctorPatientWorkspacePage = lazyPage(() => import('../roles/doctor/PatientWorkspacePage').then(named('PatientWorkspacePage')));
const TodaysBriefPage = lazyPage(() => import('../roles/doctor/TodaysBriefPage').then(named('TodaysBriefPage')));
const ConsultationsPage = lazyPage(() => import('../roles/doctor/ConsultationsPage').then(named('ConsultationsPage')));
const DocumentationHistoryPage = lazyPage(() => import('../roles/doctor/DocumentationHistoryPage').then(named('DocumentationHistoryPage')));
const DoctorQuestionsPage = lazyPage(() => import('../roles/doctor/QuestionsPage').then(named('QuestionsPage')));
const FollowUpsPage = lazyPage(() => import('../roles/doctor/FollowUpsPage').then(named('FollowUpsPage')));
const GuidelinesPage = lazyPage(() => import('../roles/doctor/GuidelinesPage').then(named('GuidelinesPage')));
const DoctorReferralDetailPage = lazyPage(() => import('../roles/doctor/ReferralDetailPage').then(named('ReferralDetailPage')));
const DoctorHandoverPage = lazyPage(() => import('../roles/doctor/HandoverPage').then(named('HandoverPage')));
const DoctorUpdatesPage = lazyPage(() => import('../roles/doctor/UpdatesPage').then(named('UpdatesPage')));
const DoctorProfilePage = lazyPage(() => import('../roles/doctor/ProfilePage').then(named('ProfilePage')));
const ReferenceLibraryPage = lazyPage(() => import('../roles/doctor/ReferenceLibraryPage').then(named('ReferenceLibraryPage')));
const AssistantPage = lazyPage(() => import('../roles/doctor/AssistantPage').then(named('AssistantPage')));

// Used by both the doctor and the care team
const CareWorkspacePage = lazyPage(() => import('../components/continuity/CareWorkspacePage').then(named('CareWorkspacePage')));
const LibraryPage = lazyPage(() => import('../components/continuity/LibraryPage').then(named('LibraryPage')));
const ClinicPage = lazyPage(() => import('../components/continuity/ClinicPage').then(named('ClinicPage')));

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
      <Route path="/external-simulator" element={<ExternalSimulatorPage />} />

      <Route path="/patient" element={<RequireRole role="patient"><PatientShell /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<MyCarePage />} />
        <Route path="records" element={<MyRecordsPage />} />
        <Route path="questions" element={<MyQuestionsPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="updates" element={<PatientUpdatesPage />} />
        <Route path="profile" element={<PatientProfilePage />} />
        <Route path="journey" element={<JourneyPage />} />
        <Route path="daily-log" element={<DailyLogPage />} />
        <Route path="care-plan" element={<CarePlanPage />} />
        <Route path="companion" element={<CompanionPage />} />
        <Route path="guided-check-in" element={<GuidedCheckInPage />} />
        <Route path="emergency" element={<EmergencyPage />} />
        <Route path="references" element={<ReferencesPage />} />
        <Route path="consent" element={<ConsentPage />} />
      </Route>

      <Route path="/caregiver" element={<RequireRole role="caregiver"><CaregiverShell /></RequireRole>}>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<CaregiverHomePage />} />
        <Route path="appointments" element={<CaregiverAppointmentsPage />} />
        <Route path="check-in" element={<CaregiverCheckInPage />} />
        <Route path="check-in/new" element={<CaregiverNewCheckInPage />} />
        <Route path="care-plan" element={<CaregiverCarePlanPage />} />
        <Route path="questions" element={<CaregiverQuestionsPage />} />
        <Route path="emergency" element={<CaregiverEmergencyPage />} />
        <Route path="updates" element={<CaregiverUpdatesPage />} />
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
        <Route path="referrals/:referralId" element={<CareTeamReferralDetailPage />} />
        <Route path="handover" element={<HandoverPage />} />
        <Route path="updates" element={<CareTeamUpdatesPage />} />
        <Route path="profile" element={<CareTeamProfilePage />} />
        <Route path="care-workspace" element={<CareWorkspacePage />} />
        <Route path="draft-studio" element={<CareWorkspacePage initialTab="drafts" />} />
        <Route path="guidelines" element={<Navigate to="/care-team/dashboard" replace />} />
        <Route path="clinic" element={<ClinicPage />} />
      </Route>

      <Route path="/doctor" element={<RequireRole role="doctor"><DoctorShell /></RequireRole>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DoctorDashboardPage />} />
        <Route path="patients" element={<DoctorPatientsListPage />} />
        <Route path="patients/:episodeId" element={<DoctorPatientWorkspacePage />} />
        <Route path="todays-brief" element={<TodaysBriefPage />} />
        <Route path="consultations" element={<ConsultationsPage />} />
        <Route path="questions" element={<DoctorQuestionsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="documentation" element={<DocumentationHistoryPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="guidelines" element={<GuidelinesPage />} />
        <Route path="referrals/:referralId" element={<DoctorReferralDetailPage />} />
        <Route path="handover" element={<DoctorHandoverPage />} />
        <Route path="updates" element={<DoctorUpdatesPage />} />
        <Route path="profile" element={<DoctorProfilePage />} />
        <Route path="care-workspace" element={<CareWorkspacePage />} />
        <Route path="draft-studio" element={<CareWorkspacePage initialTab="drafts" />} />
        <Route path="library" element={<ReferenceLibraryPage />} />
        <Route path="clinical-settings" element={<LibraryPage />} />
        <Route path="clinic" element={<ClinicPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
