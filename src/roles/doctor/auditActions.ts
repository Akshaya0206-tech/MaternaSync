import { tx } from '../../i18n';

// One plain sentence for each action the audit log records, in the passive voice so it reads on its own in a printed or exported list (who did it is a
// separate column). A test (backend/tests/test_doctor_workspace.py) keeps this list and backend/app/audit_trail.py in step. An action that is not here
// falls back to the sentence the log itself stored, or to the action's code in sentence case.
export const AUDIT_SENTENCES: Record<string, string> = {
  // check-ins
  patient_log_recorded: tx('A check-in was saved'),
  patient_log_corrected: tx('A check-in was corrected'),
  caregiver_checkin_recorded: tx('A trusted person saved a check-in for her'),
  monitoring_plan_agreed: tx('A follow-up schedule for check-ins was agreed'),
  follow_up_flag_confirmed: tx('A follow-up flag was confirmed'),
  patient_entries_exported: tx('Her check-in entries were printed or exported'),
  checkin_helper_asked: tx('A trusted person was asked to help with her check-ins'),
  checkin_helper_cleared: tx('The request for help with check-ins was withdrawn'),
  caregiver_helper_answered: tx('A trusted person answered the request to help with check-ins'),
  // documents
  document_uploaded: tx('A document was uploaded'),
  document_verified: tx('A document was verified'),
  document_rejected: tx('A document was rejected'),
  document_edited: tx('A document’s details were edited'),
  document_sent_to_doctor: tx('A document was sent to the doctor'),
  referral_document_attached: tx('A document was attached to a referral'),
  question_file_attached: tx('A file was attached to a question'),
  // questions
  question_asked: tx('A question was sent to the doctor'),
  question_answered: tx('A question was answered'),
  question_assigned: tx('A question was assigned'),
  question_closed: tx('A question was closed'),
  question_closed_offline: tx('A question was closed as handled by phone or in clinic'),
  question_logged: tx('A question was logged for her'),
  question_routed_by_rule: tx('A question was passed to the doctor by a fixed rule'),
  response_approved: tx('A reply to a question was approved'),
  talk_to_a_person: tx('A request to talk to a person was sent'),
  caregiver_question_asked: tx('A trusted person asked a question for her'),
  caregiver_question_followup: tx('A trusted person asked a follow-up question for her'),
  caregiver_question_file_attached: tx('A trusted person attached a file to a question for her'),
  // visits, reminders and tasks
  appointment_requested: tx('A visit was requested'),
  appointment_status_changed: tx('A visit’s status was changed'),
  visit_change_requested: tx('She asked to change or cancel a visit'),
  visit_change_withdrawn: tx('A request about a visit was withdrawn'),
  visit_change_confirmed_new_time: tx('A new visit time was confirmed and the old visit cancelled'),
  visit_change_other_times_offered: tx('Other visit times were offered'),
  visit_prep_released: tx('A visit checklist was released'),
  visit_prep_ticked: tx('A line of a visit checklist was ticked'),
  caregiver_visit_prep_ticked: tx('A trusted person ticked a line of a visit checklist'),
  caregiver_visit_prep_unticked: tx('A trusted person unticked a line of a visit checklist'),
  visit_prep_line_removed: tx('A line of a visit checklist was removed'),
  caregiver_visit_help: tx('A trusted person said whether they can take her to a visit'),
  caregiver_visit_help_cleared: tx('A trusted person’s answer about a visit was cleared'),
  reminder_schedule_approved: tx('A reminder schedule was approved'),
  reminder_response_recorded: tx('She answered a reminder'),
  reminders_checked: tx('Reminders that are due were checked'),
  task_created: tx('A task was created'),
  task_assigned: tx('A task was assigned'),
  task_reassigned: tx('A task was reassigned'),
  task_status_changed: tx('A task’s status was changed'),
  task_owner_reassigned_login_off: tx('A task was moved to the doctor because the care-team login is off'),
  monitoring_owner_reassigned_login_off: tx('A follow-up owner was moved to the doctor because the care-team login is off'),
  follow_up_task_confirmed: tx('A follow-up task was confirmed'),
  pathway_confirmed: tx('A care pathway was confirmed for her'),
  outcome_recorded: tx('An outcome was recorded'),
  // consents and sharing
  sharing_consent_granted: tx('Permission to send WhatsApp messages was given'),
  sharing_consent_revoked: tx('Permission to send WhatsApp messages was withdrawn'),
  outreach_prepared: tx('A WhatsApp message was prepared'),
  whatsapp_link_prepared: tx('A WhatsApp message link was prepared'),
  whatsapp_marked_sent: tx('A WhatsApp message was marked as sent'),
  whatsapp_sent: tx('A WhatsApp message was sent'),
  whatsapp_send_failed: tx('A WhatsApp message could not be sent'),
  whatsapp_status: tx('A WhatsApp delivery status arrived'),
  caregiver_whatsapp_code_sent: tx('A code was sent to a trusted person’s WhatsApp'),
  caregiver_whatsapp_on: tx('A trusted person turned WhatsApp reminders on'),
  caregiver_whatsapp_off: tx('A trusted person turned WhatsApp reminders off'),
  // trusted people
  caregiver_invited: tx('A trusted person was invited'),
  caregiver_invite_accepted: tx('A trusted person accepted the invite'),
  caregiver_permissions_changed: tx('A trusted person’s permissions were changed'),
  caregiver_removed: tx('A trusted person was removed'),
  caregiver_access_limit_changed: tx('A trusted person’s end date was changed'),
  caregiver_code_renewed: tx('An invite code was renewed'),
  caregiver_nudge_reminder: tx('A trusted person reminded her about a reminder'),
  caregiver_nudge_check_in: tx('A trusted person reminded her to fill in a check-in'),
  caregiver_hospital_card_opened: tx('A trusted person opened the hospital card'),
  caregiver_stopped_helping: tx('A trusted person stopped helping her'),
  // notes and documents the doctor approved
  consultation_started: tx('A consultation was started'),
  transcript_generated: tx('A transcript was generated'),
  draft_approved: tx('A consultation note was approved'),
  draft_edited: tx('A consultation note was edited'),
  draft_rejected: tx('A consultation note was rejected'),
  ai_draft_generated: tx('A note draft was prepared for the doctor to review'),
  brief_reviewed: tx('Today’s brief was marked as reviewed'),
  clinical_output_drafted: tx('A document draft was prepared'),
  clinical_output_edited: tx('A document draft was edited'),
  clinical_output_approved: tx('A document was approved and released'),
  handover_regenerated: tx('A handover draft was prepared again'),
  handover_edited: tx('A handover was edited'),
  handover_shared: tx('A handover was shared'),
  // account
  password_changed: tx('The password was changed'),
  other_devices_signed_out: tx('Other devices were signed out'),
  account_closed: tx('The account was closed at her request'),
  my_data_downloaded: tx('A copy of her data was downloaded'),
  language_preference_updated: tx('The screen language was changed'),
  // everything else
  referral_created: tx('A referral was created'),
  referral_sent: tx('A referral was sent'),
  referral_acknowledged: tx('A referral was acknowledged'),
  referral_appointment_recorded: tx('A referral appointment was recorded'),
  referral_response_received: tx('A referral response was received'),
  referral_review_doctor: tx('A referral response was reviewed by the doctor'),
  referral_closed: tx('A referral was closed'),
  audit_trail_exported: tx('The audit trail was printed or exported'),
  continuity_viewed: tx('Her care records were opened'),
  companion_query: tx('A question was typed into the Care Companion'),
  clinic_report_viewed: tx('The clinic overview was opened'),
  episode_seeded: tx('A demonstration record was prepared for her'),
};

/** The care assistant's own steps all read the same way, with the step's name: "Care assistant step: Verify a document". */
export const ASSISTANT_STEP = tx('Care assistant step: {step}');
export const ASSISTANT_UNDO = tx('A care assistant step was undone: {step}');

/** The care assistant's steps by name, in the same words as the Care Assistant page's own list, so the doctor reads one wording in both places. A step that
 *  is not here shows its code in sentence case. */
export const ASSISTANT_STEP_NAMES: Record<string, string> = {
  verify_document: tx('Verify a document'),
  reject_document: tx('Reject a document'),
  answer_question: tx('Send a reply'),
  assign_question_to_doctor: tx('Assigned a question to a doctor'),
  confirm_appointment: tx('Confirm a visit'),
  offer_new_times: tx('Offer other times'),
  record_missed_visit: tx('Record a missed visit'),
  send_outreach: tx('Send a WhatsApp reminder'),
  send_caregiver_whatsapp: tx('Send a WhatsApp message to a trusted person'),
  prepare_draft: tx('Prepare a draft'),
  create_attention: tx('Handed to a doctor'),
  notify_user: tx('Sent a fixed reminder'),
  send_urgent_message: tx('Showed the fixed emergency message'),
  send_referral: tx('Send a referral'),
  chase_referral: tx('Chase a referral'),
};

const sentenceCase = (code: string) => {
  const words = code.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
};

type Say = (text: string, values?: Record<string, string | number>) => string;

/** The sentence for one row. Unmapped actions use the log's own stored sentence, else the action's code in sentence case. */
export function auditSentence(row: { action: string; summary?: string | null }, t: Say): string {
  const known = AUDIT_SENTENCES[row.action];
  if (known) return t(known);
  const step = /^assistant_(undo_)?(.+)$/.exec(row.action);
  if (step) {
    const name = ASSISTANT_STEP_NAMES[step[2]];
    return t(step[1] ? ASSISTANT_UNDO : ASSISTANT_STEP, { step: name ? t(name) : sentenceCase(step[2]) });
  }
  return row.summary?.trim() || sentenceCase(row.action);
}
