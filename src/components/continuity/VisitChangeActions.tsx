import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ROOT } from "../../api/continuity";
import { useLanguage } from "../../i18n";
import { Feedback, useAction } from "./shared";

interface Preview {
  kind: "reschedule" | "cancel";
  visitWhen: string;
  note: string | null;
  newWhen: string | null;
  outsideRules: string | null;
  freeTimes: string[];
}
type Step = "confirm" | "offer" | "cancel" | null;
type Translate = ReturnType<typeof useLanguage>["t"];

// The server explains in English why a time is outside the booking rules; each reason is shown in the doctor's language.
function reasons(t: Translate, text: string): string {
  return text
    .split("; ")
    .map((reason) => {
      const notice = /^it is less than (\d+) hours away$/.exec(reason);
      if (notice) return t("it is less than {hours} hours away", { hours: notice[1] });
      const hours = /^it is outside clinic hours \((.+)\)$/.exec(reason);
      if (hours) return t("it is outside clinic hours ({hours})", { hours: hours[1] });
      return t(reason);
    })
    .join("; ");
}

/** The doctor's answers to a patient's request to cancel or move a confirmed visit, shown on the doctor's task about it. Nothing here happens
 *  by itself: each answer is a click and then a confirm step that says exactly what will change and that she will be told. */
export function VisitChangeActions({ appointmentId, onDone }: { appointmentId: string; onDone: (message: string) => Promise<void> }) {
  const { t } = useLanguage();
  const action = useAction();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get<Preview>(`${ROOT}/appointments/${appointmentId}/change-preview`)
      .then((result) => { if (active) setPreview(result); })
      .catch((error) => { if (active) setProblem(error instanceof Error ? error.message : ""); });
    return () => { active = false; };
  }, [appointmentId]);

  if (!preview) return problem ? <p role="alert" className="continuity-alert">{t(problem)}</p> : null;

  // Once answered the request is closed and this block goes away, so the message that says what happened is shown by the page around it.
  const answer = (path: string, body: object | undefined, done: string) =>
    action.run(async () => {
      await api.post(`${ROOT}/appointments/${appointmentId}/change/${path}`, body);
      setStep(null);
      await onDone(done);
    }, "");

  const moving = preview.kind === "reschedule";
  const outside = preview.outsideRules ? reasons(t, preview.outsideRules) : "";
  return (
    <div className="visit-change" role="group" aria-label={t("Visit change request")}>
      <p>
        <strong>
          {moving
            ? t("She asks to move the visit on {visit} to {when}.", { visit: preview.visitWhen, when: preview.newWhen ?? "" })
            : t("She asks to cancel the visit on {visit}.", { visit: preview.visitWhen })}
        </strong>
      </p>
      {preview.note && <p className="continuity-muted">{t("Her note")}: {preview.note}</p>}
      <p className="continuity-muted">{t("Nothing changes until you choose one of the answers below. She is told in her language.")}</p>
      <Feedback error={action.error || problem} message={action.message} />

      {!step && (
        <div className="continuity-actions">
          {moving ? (
            <>
              <button type="button" className="btn-primary" disabled={action.busy} onClick={() => setStep("confirm")}>{t("Confirm new time")}</button>
              <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => setStep("offer")}>{t("Offer other times")}</button>
            </>
          ) : (
            <button type="button" className="btn-primary" disabled={action.busy} onClick={() => setStep("cancel")}>{t("Cancel the visit")}</button>
          )}
        </div>
      )}

      {step === "confirm" && (
        <div className="continuity-note" role="group" aria-label={t("Confirm new time")}>
          <p>{t("Confirm the visit on {when} and cancel the visit on {visit}? She will be told both.", { when: preview.newWhen ?? "", visit: preview.visitWhen })}</p>
          {outside && <p role="alert"><strong>{t("That time is outside the clinic's booking rules ({reason}). Confirming sets the rules aside.", { reason: outside })}</strong></p>}
          <div className="continuity-actions">
            <button type="button" className="btn-primary" disabled={action.busy}
              onClick={() => void answer("confirm-new-time", { acceptOutsideRules: Boolean(outside) }, t("The new time is confirmed and the old visit is cancelled. She has been told."))}>
              {outside ? t("Confirm anyway and cancel the old visit") : t("Confirm and cancel the old visit")}
            </button>
            <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => setStep(null)}>{t("Go back")}</button>
          </div>
        </div>
      )}

      {step === "offer" && (
        <div className="continuity-note" role="group" aria-label={t("Offer other times")}>
          {preview.freeTimes.length ? (
            <p>{t("Close her request and send her these free times: {times}? Her visit on {visit} stays as it is.", { times: preview.freeTimes.join(", "), visit: preview.visitWhen })}</p>
          ) : (
            <p role="alert">{t("No free time was found in the next three weeks inside the booking rules. Please answer her yourself.")}</p>
          )}
          <div className="continuity-actions">
            {preview.freeTimes.length > 0 && (
              <button type="button" className="btn-primary" disabled={action.busy} onClick={() => void answer("offer-other-times", undefined, t("The times were sent to her."))}>
                {t("Send her these times")}
              </button>
            )}
            <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => setStep(null)}>{t("Go back")}</button>
          </div>
        </div>
      )}

      {step === "cancel" && (
        <div className="continuity-note" role="group" aria-label={t("Cancel the visit")}>
          <p>{t("Cancel the visit on {visit}? She will be told.", { visit: preview.visitWhen })}</p>
          <div className="continuity-actions">
            <button type="button" className="btn-primary" disabled={action.busy} onClick={() => void answer("cancel-visit", undefined, t("The visit is cancelled. She has been told."))}>
              {t("Cancel the visit")}
            </button>
            <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => setStep(null)}>{t("Go back")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
