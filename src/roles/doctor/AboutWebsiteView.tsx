import { Link } from 'react-router-dom';
import { tx, useLanguage } from '../../i18n';
import { doctorTourSteps } from './tour';

// The "About Website" tab of the References page: a guide for a doctor who is new to the app, in sections. Every sentence has a Hindi, Tamil and
// Telugu translation (src/i18n/dicts/doctor-about.ts). The menu section reuses the guided tour's own texts, so the two cannot disagree.
interface Section {
  id: string;
  title: string;
  intro?: string;
  items?: string[];
  ordered?: boolean;
  kind?: 'menu' | 'find';
}

const SECTIONS: Section[] = [
  { id: 'what', title: tx('What MaternaSync is'),
    intro: tx('MaternaSync is a clinician-first workspace for antenatal care. It brings a patient’s records, check-ins and questions together, helps you write and approve documents, and keeps routine admin moving. You stay in charge: it does not make clinical decisions.'),
    items: [
      tx('Patients, trusted people (such as a husband or a mother) and doctors each have their own sign-in and their own screens.'),
      tx('Everything the app prepares for a patient is a draft until a doctor reads, edits and signs it.'),
    ] },
  { id: 'start', title: tx('Your first five minutes'), ordered: true,
    items: [
      tx('Take the tour: open Profile and choose Start a tour. It opens each page in turn and explains it in about two minutes.'),
      tx('Choose your language and text size at the bottom of the menu.'),
      tx('Open My Patients, choose a patient and read the brief: the last 30 days of what she reported, shown as entered, with any review flags for you to look at.'),
      tx('Open Clinical Settings and approve the note layouts, follow-up rules, ICD-10 code sets and patient education you want to use. Starter items arrive as drafts, and nothing is used until a doctor approves it.'),
      tx('Open Care Assistant to see what the assistant does for your clinic, and choose how much it should wait for you.'),
    ] },
  { id: 'menu', title: tx('The menu, tab by tab'), kind: 'menu',
    intro: tx('Each item in the left menu and what it is for. Choose a name to open it.') },
  { id: 'visit', title: tx('A visit from start to finish'), ordered: true,
    items: [
      tx('Before the visit: open My Patients and the patient to read her brief. Nothing is sent or assigned until you decide.'),
      tx('During the visit: open Consultations, choose the patient, then type or dictate in English, Hindi, Tamil or Telugu. The original transcript stays editable.'),
      tx('After the visit: read the drafted note, edit it and approve it. Only then does it reach her record. Documentation history lists every note you have approved.'),
      tx('For the patient: in Connected Care, open the Document studio tab to prepare a plain-language visit summary, a patient explanation, a lab report explanation, a prescription, a certificate or a letter. Each stays a draft until you sign it.'),
      tx('Follow-up: in Connected Care, approve reminders under Reminders & outreach, and confirm visits and track tasks under Tasks, visits & outcomes.'),
      tx('Questions: open Patient Questions. A reply is a draft until you approve it, and only then does she see it.'),
    ] },
  { id: 'approve', title: tx('What needs your approval'),
    intro: tx('MaternaSync prepares and proposes; you decide. These need a doctor’s approval before they take effect:'),
    items: [
      tx('Consultation notes, before they enter the patient’s record.'),
      tx('Documents a patient uploads, before they are used.'),
      tx('Every document draft: summaries, explanations, prescriptions, certificates and letters.'),
      tx('Replies to patient questions.'),
      tx('Medicine, vaccine and visit reminders. A medicine or vaccine reminder can only be based on one of your own approved visits.'),
      tx('Anything the Care Assistant proposes, such as confirming a visit, sending a referral or sending a reminder.'),
      tx('The lists in Clinical Settings, and the guideline documents under Guideline sources.'),
      tx('Each approval is recorded with your name and the time.'),
    ] },
  { id: 'assistant', title: tx('The Care Assistant'),
    items: [
      tx('It does routine admin only: it checks new uploads, routes questions to you, sends fixed reminders for missed check-ins and visits, raises overdue tasks, and prepares visit requests, referrals and paperwork drafts for you to approve.'),
      tx('It never diagnoses, advises on treatment, answers a clinical question, interprets a document or releases anything to a patient by itself. Everything a patient reads from it is fixed wording.'),
      tx('You can undo any step that can be reversed, pause it for everyone or for one patient, or ask it to wait for your approval on every step.'),
      tx('If a message contains a warning sign, the patient always gets the fixed emergency message and you are told, even when the assistant is paused.'),
    ] },
  { id: 'trusted', title: tx('Working with a patient’s trusted people'),
    items: [
      tx('A woman can invite a relative or friend to help her. She chooses what each person may do and can remove them at any time; you cannot change it.'),
      tx('To see who they are and what she allows, open Connected Care, then Reminders & outreach, then the Trusted people card.'),
      tx('You can ask one person who already does check-ins with her to help with them. They can say no, she is told, and if she misses a check-in they are reminded first.'),
      tx('To help her get ready for a visit, write a short list in the Visit preparation checklist card under Connected Care, Tasks, visits & outcomes. She and the people she allows can tick it, and you see who did.'),
      tx('Questions from a trusted person arrive in Patient Questions together with hers.'),
    ] },
  { id: 'references', title: tx('Using References'),
    items: [
      tx('Reference Library: your own shelf of real published documents from WHO, MoHFW and other Indian bodies, NICE and the major societies. You can add your own references and keep private notes on them.'),
      tx('Search in plain words. A result shows the document’s own passage and its page. When the optional language model is installed, a question typed in Hindi, Tamil or Telugu also finds the English passage.'),
      tx('Guideline sources: upload a guideline PDF and approve it. No guideline comes with the app.'),
      tx('Guideline search: finds passages, with their page, in the guideline documents you approved.'),
      tx('Nothing in References is written by the app, and nothing in it is used anywhere else in the app.'),
    ] },
  { id: 'languages', title: tx('Languages and accessibility'),
    items: [
      tx('The whole website works in English, Hindi, Tamil and Telugu. Change the language at the bottom of the menu; it is remembered for your account.'),
      tx('What people write (names, notes, transcripts) is shown as written and is not machine-translated. A review note warns you when a summary is set to a different language from your notes.'),
      tx('You can make the text larger (large or extra large) at the bottom of the menu. There is a skip-to-content link, and the pages fit a phone screen.'),
    ] },
  { id: 'limits', title: tx('What this website will not do'),
    items: [
      tx('It does not diagnose, recommend treatment, grade risk or interpret a result. Values are shown as entered, and a lab report shows the range printed on it with no label.'),
      tx('It does not check medicines, doses, allergies or interactions. A prescription holds only what you enter.'),
      tx('Messages it sends to patients are fixed wording, such as a reminder to fill in a check-in. WhatsApp messages are only a short “please sign in” prompt, sent only with her permission, and never contain a name, a result or a medicine.'),
      tx('It is not an emergency service. Check-ins are not monitored continuously. A patient who describes a warning sign is shown a fixed message to contact her unit or call the emergency number (112 in India).'),
      tx('Handover is paused for now. Earlier handovers can still be read.'),
    ] },
  { id: 'privacy', title: tx('Privacy, consent and records'),
    items: [
      tx('You see only the patients assigned to you.'),
      tx('Access, edits, approvals and consent changes are recorded in an audit log with the person’s name and the time.'),
      tx('Anything shared outside the app needs her recorded permission, with a purpose and an end date, and she can withdraw it.'),
      tx('The demonstration accounts and records on this copy are synthetic. Do not enter a real patient’s details into a demonstration copy.'),
    ] },
  { id: 'find', title: tx('Where to find things'), kind: 'find' },
];

// A task and where to do it.
const FIND: [string, string][] = [
  [tx('Read a patient’s brief'), tx('My Patients, then the patient. Or Dashboard, Today’s Patients, Open Brief.')],
  [tx('Write or dictate a note'), tx('Consultations, New consultation.')],
  [tx('Find a note I approved'), tx('Consultations, Documentation history.')],
  [tx('Prepare a summary, prescription or letter'), tx('Connected Care, Document studio.')],
  [tx('Answer a patient’s question'), tx('Patient Questions.')],
  [tx('Approve a reminder'), tx('Connected Care, Reminders & outreach.')],
  [tx('Find an ICD-10 code'), tx('Connected Care, Document studio, Look up an ICD-10 code. Approve a code set in Clinical Settings first.')],
  [tx('Add a guideline'), tx('References, Guideline sources.')],
  [tx('See what the assistant did, or pause it'), tx('Care Assistant.')],
  [tx('Start the tour again'), tx('Profile, Start a tour.')],
];

export function AboutWebsiteView() {
  const { t } = useLanguage();
  const menu = doctorTourSteps(t);
  return (
    <div className="about-site">
      <nav className="glass-panel continuity-panel about-toc" aria-labelledby="about-toc-title">
        <div className="continuity-panel-heading">
          <h2 id="about-toc-title">{t('On this page')}</h2>
        </div>
        <ol className="about-list">
          {SECTIONS.map((section) => (
            <li key={section.id}><a href={`#about-${section.id}`}>{t(section.title)}</a></li>
          ))}
        </ol>
      </nav>
      {SECTIONS.map((section, index) => {
        const List = section.ordered ? 'ol' : 'ul';
        return (
          <section key={section.id} id={`about-${section.id}`} aria-labelledby={`about-${section.id}-title`} className="glass-panel continuity-panel about-section">
            <div className="continuity-panel-heading">
              <h2 id={`about-${section.id}-title`}>{index + 1}. {t(section.title)}</h2>
            </div>
            {section.intro && <p>{t(section.intro)}</p>}
            {section.items && (
              <List className="about-list">
                {section.items.map((item) => <li key={item}>{t(item)}</li>)}
              </List>
            )}
            {section.kind === 'menu' && (
              <dl className="about-menu">
                {menu.map((step) => (
                  <div key={step.to}>
                    <dt><Link to={step.to}>{step.title}</Link></dt>
                    <dd>{step.text}</dd>
                  </div>
                ))}
              </dl>
            )}
            {section.kind === 'find' && (
              <dl className="about-menu">
                {FIND.map(([task, where]) => (
                  <div key={task}>
                    <dt>{t(task)}</dt>
                    <dd>{t(where)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}
