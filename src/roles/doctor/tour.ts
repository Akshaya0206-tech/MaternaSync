import { tx } from '../../i18n';
import type { TourLabels, TourStep } from '../../tour/tourContext';

// The doctor's guided tour. Titles reuse the menu names; every sentence has a Hindi, Tamil and Telugu translation.
const STEPS = [
  { to: '/doctor/dashboard', title: tx('Dashboard'), text: tx('Today at a glance: the patients you are seeing, questions waiting for you, documents to review and drafts to approve.') },
  { to: '/doctor/patients', title: tx('My Patients'), text: tx('Everyone assigned to you. Open a patient to see their journey, appointments and records.') },
  { to: '/doctor/todays-brief', title: tx("Today's Brief"), text: tx('A brief before each visit, with the last 30 days of what the patient reported and any review flags for you to look at. Nothing is sent or assigned until you decide.') },
  { to: '/doctor/consultations', title: tx('Consultations'), text: tx('Type or dictate a visit in English, Hindi, Tamil or Telugu. The app drafts the note from what you said, and nothing reaches the record until you approve it.') },
  { to: '/doctor/questions', title: tx('Patient Questions'), text: tx('Questions from patients and the care team. Replies are drafts that you check and approve before the patient sees them.') },
  { to: '/doctor/assistant', title: tx('Care Assistant'), text: tx('The clinic’s assistant does routine admin: it checks new uploads, routes questions and sends fixed reminders. Anything that needs a decision lands here as a one-click proposal. It never diagnoses or advises on treatment, every step is logged, and you can pause it, undo any step or ask to review every step first.') },
  { to: '/doctor/documentation', title: tx('Documentation'), text: tx('Every note you have approved, in one place.') },
  { to: '/doctor/draft-studio', title: tx('Document Studio'), text: tx('Prepare visit summaries, lab report explanations, patient explanations, prescriptions, certificates and letters. Each stays a draft until you sign it.') },
  { to: '/doctor/care-workspace', title: tx('Connected Care'), text: tx('One workspace per patient: trends and follow-up flags, documents, reminders and WhatsApp messages, tasks and visits.') },
  { to: '/doctor/library', title: tx('Reference Library'), text: tx('Your own shelf of references to look things up in. Search in plain words, add your own, and keep private notes. Nothing here is used anywhere else in the app.') },
  { to: '/doctor/clinical-settings', title: tx('Clinical Settings'), text: tx('The lists the rest of the app reads from: follow-up rules, ICD-10 code sets, patient education and note layouts. Approve them here before they are used.') },
  { to: '/doctor/clinic', title: tx('Clinic Overview'), text: tx('The whole caseload: open and overdue tasks, upcoming visits and which patients to look at first.') },
  { to: '/doctor/follow-ups', title: tx('Follow-ups'), text: tx('Tasks that are waiting for you or your team.') },
  { to: '/doctor/guidelines', title: tx('Guidelines'), text: tx('Upload guideline PDFs and search the ones you have approved. You get back the passage and its page.') },
  { to: '/doctor/handover', title: tx('Handover'), text: tx('Paused for now, while its rules and the way it works are being refined. Earlier handovers can still be read.') },
  { to: '/doctor/updates', title: tx('Updates'), text: tx('Notifications about documents, questions and tasks.') },
  { to: '/doctor/profile', title: tx('Profile'), text: tx('Your details. You can start this tour again from here whenever you like.') },
];

export const doctorTourSteps = (t: (text: string) => string): TourStep[] => STEPS.map((s) => ({ to: s.to, title: t(s.title), text: t(s.text) }));

export const doctorTourLabels = (t: (text: string, values?: Record<string, string | number>) => string): TourLabels => ({
  welcomeTitle: t('Welcome to MaternaSync'),
  welcomeText: t('Take a short tour to see what each part of the app is for. It takes about two minutes, you can stop at any time, and you can start it again from your Profile.'),
  start: t('Start a tour'),
  later: t('Maybe later'),
  next: t('Next'),
  back: t('Back'),
  finish: t('Finish'),
  skip: t('Skip tour'),
  stepOf: (step, total) => t('Step {step} of {total}', { step, total }),
});
