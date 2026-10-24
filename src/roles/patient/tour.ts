import { tx } from '../../i18n';
import type { TourLabels, TourStep } from '../../tour/tourContext';

// The patient's guided tour. Titles reuse the menu names; every sentence has a Hindi, Tamil and Telugu translation.
const STEPS = [
  { to: '/patient/dashboard', title: tx('My Care'), text: tx('Your home page. It shows how far along your pregnancy is, your next appointment and anything your care team needs from you. You can change the language at the bottom of the menu.') },
  { to: '/patient/daily-log', title: tx('Daily Check-in'), text: tx('Write down your blood pressure, weight, mood and symptoms in about two minutes. Tap the symptom buttons instead of typing. If someone is helping you, such as an ASHA worker or a family member, use the step-by-step version: one question at a time, in large letters, and it can read each question aloud. Your care team can read what you share.') },
  { to: '/patient/care-plan', title: tx('My Care Plan'), text: tx('Summaries of your visits, explanations of your reports and your plan appear here, in your language, once your doctor has approved them.') },
  { to: '/patient/companion', title: tx('Care Companion'), text: tx("Ask a question about pregnancy in your own language. Answers come from information your clinic's doctors have approved, and you can send any question to your care team.") },
  { to: '/patient/consent', title: tx('Sharing & Consent'), text: tx('Choose who may send you WhatsApp reminders, and for what. You can take your permission back at any time.') },
  { to: '/patient/records', title: tx('My Records'), text: tx('Upload your reports and scans. Your care team checks each one before it is used.') },
  { to: '/patient/questions', title: tx('My Questions'), text: tx('Ask your care team a question and read their replies here.') },
  { to: '/patient/appointments', title: tx('Appointments'), text: tx('See your visits, ask for a new one, and read the summary of each visit.') },
  { to: '/patient/emergency', title: tx('Emergency help'), text: tx('Numbers to call, your emergency contact, your preferred hospital and the hospitals near you. Opening this page does not alert anyone, so it is safe to look at.') },
  { to: '/patient/references', title: tx('References'), text: tx('Trusted information about pregnancy to read whenever you need it, including the warning signs to watch for.') },
  { to: '/patient/updates', title: tx('Updates'), text: tx('Messages about reminders, new documents and replies from your team.') },
  { to: '/patient/profile', title: tx('Profile'), text: tx('Your details and your emergency details. You can start this tour again from here whenever you like.') },
];

export const patientTourSteps = (t: (text: string) => string): TourStep[] => STEPS.map((s) => ({ to: s.to, title: t(s.title), text: t(s.text) }));

export const patientTourLabels = (t: (text: string, values?: Record<string, string | number>) => string): TourLabels => ({
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
