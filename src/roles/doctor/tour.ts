import type { TourLabels, TourStep } from '../../tour/tourContext';

export const doctorTourSteps: TourStep[] = [
  { to: '/doctor/dashboard', title: 'Dashboard', text: 'Today at a glance: the patients you are seeing, questions waiting for you, documents to review and drafts to approve.' },
  { to: '/doctor/patients', title: 'My Patients', text: 'Everyone assigned to you. Open a patient to see their journey, appointments and records.' },
  { to: '/doctor/todays-brief', title: "Today's Brief", text: 'A brief before each visit, with the last 30 days of what the patient reported and any review flags for you to look at. Nothing is sent or assigned until you decide.' },
  { to: '/doctor/consultations', title: 'Consultations', text: 'Type or dictate a visit in English, Hindi, Tamil or Telugu. The app drafts the note from what you said, and nothing reaches the record until you approve it.' },
  { to: '/doctor/questions', title: 'Patient Questions', text: 'Questions from patients and the care team. Replies are drafts that you check and approve before the patient sees them.' },
  { to: '/doctor/documentation', title: 'Documentation', text: 'Every note you have approved, in one place.' },
  { to: '/doctor/draft-studio', title: 'Document Studio', text: 'Prepare visit summaries, lab report explanations, patient explanations, prescriptions with a safety check, certificates and letters. Each stays a draft until you sign it.' },
  { to: '/doctor/care-workspace', title: 'Connected Care', text: 'One workspace per patient: trends and risk review, documents, reminders and WhatsApp messages, tasks and visits.' },
  { to: '/doctor/library', title: 'Reference Library', text: 'Your own shelf of references to look things up in. Search in plain words, add your own, and keep private notes. Nothing here is used anywhere else in the app.' },
  { to: '/doctor/clinical-settings', title: 'Clinical Settings', text: 'The lists the rest of the app reads from: review rules, ICD-10 code sets, drug safety checks, patient education and note layouts. Approve them here before they are used.' },
  { to: '/doctor/clinic', title: 'Clinic Overview', text: 'The whole caseload: open and overdue tasks, upcoming visits and which patients to look at first.' },
  { to: '/doctor/follow-ups', title: 'Follow-ups', text: 'Tasks that are waiting for you or your team.' },
  { to: '/doctor/guidelines', title: 'Guidelines', text: 'Upload guideline PDFs and search the ones you have approved. You get back the passage and its page.' },
  { to: '/doctor/handover', title: 'Handover', text: 'Paused for now, while its rules and the way it works are being refined. Earlier handovers can still be read.' },
  { to: '/doctor/updates', title: 'Updates', text: 'Notifications about documents, questions and tasks.' },
  { to: '/doctor/profile', title: 'Profile', text: 'Your details. You can start this tour again from here whenever you like.' },
];

export const doctorTourLabels: TourLabels = {
  welcomeTitle: 'Welcome to MaternaSync',
  welcomeText: 'Take a short tour to see what each part of the app is for. It takes about two minutes, you can stop at any time, and you can start it again from your Profile.',
  start: 'Start a tour',
  later: 'Maybe later',
  next: 'Next',
  back: 'Back',
  finish: 'Finish',
  skip: 'Skip tour',
  stepOf: (step, total) => `Step ${step} of ${total}`,
};
