import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AssistantBookingRules } from "../../roles/doctor/AssistantBookingRules";
import { AssistantReplyTime } from "../../roles/doctor/AssistantReplyTime";
import { ClinicEmergencySettings } from "../../roles/doctor/ClinicEmergencySettings";
import { useLanguage } from "../../i18n";

// The settings that belong to the whole clinic, in one place at the top of Clinical Settings. They are the very same cards the Care Assistant
// page shows (booking rules, usual reply time) and the Emergency help details, so what is saved in one place is what the other shows: they all read
// and write the same data on the server.
//
// Addresses (the Dashboard's "Set up your clinic" list and other pages link to these):
//   /doctor/clinical-settings#clinic-setup     the whole group
//   /doctor/clinical-settings#clinic-details   Clinic details for your patients' Emergency help
//   /doctor/clinical-settings#booking-rules    Booking rules
//   /doctor/clinical-settings#reply-time       Usual reply time
// Opening an address opens that card, scrolls it into view and puts the keyboard focus on its heading.
const CLINIC_SETUP_ANCHORS = ["clinic-setup", "clinic-details", "booking-rules", "reply-time"] as const;

function Fold({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <details id={id} className="glass-panel continuity-panel clinic-setup-fold" open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <h2 style={{ display: "inline" }}>{title}</h2>
      </summary>
      {children}
    </details>
  );
}

export function ClinicSetup() {
  const { t } = useLanguage();
  const { hash } = useLocation();
  const group = useRef<HTMLElement>(null);
  const details = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState({ rules: false, reply: false });

  // An address with a # opens that card, scrolls to it and focuses its heading (the first thing a keyboard or screen-reader user should hear).
  useEffect(() => {
    const id = hash.replace("#", "");
    if (!(CLINIC_SETUP_ANCHORS as readonly string[]).includes(id)) return;
    if (id === "booking-rules") setOpen((old) => ({ ...old, rules: true }));
    if (id === "reply-time") setOpen((old) => ({ ...old, reply: true }));
    if (id === "clinic-details") details.current?.querySelector("details")?.setAttribute("open", "");
    const timer = window.setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ block: "start", behavior: "smooth" });
      const focusable = target.matches("details") ? target.querySelector<HTMLElement>("summary") : id === "clinic-details" ? target.querySelector<HTMLElement>("summary") : target;
      focusable?.focus({ preventScroll: true });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [hash]);

  return (
    <section id="clinic-setup" ref={group} tabIndex={-1} className="clinic-setup" aria-labelledby="clinic-setup-title">
      <h2 id="clinic-setup-title">{t("Clinic setup")}</h2>
      <p className="continuity-muted">
        {t("The settings that belong to the whole clinic, in one place: what your patients see on their Emergency help page, how visit requests are checked, and the usual reply time patients see on My Questions. The Care Assistant page shows the same booking rules and reply time, so changing them in either place changes both.")}
      </p>
      <p className="continuity-muted clinic-setup-jump">
        {t("Jump to")}:{" "}
        <a href="#clinic-details">{t("Clinic details for your patients’ Emergency help")}</a> · <a href="#booking-rules">{t("Booking rules")}</a> · <a href="#reply-time">{t("Usual reply time")}</a>
      </p>
      {/* This card is its own folding card already. */}
      <div id="clinic-details" ref={details}>
        <ClinicEmergencySettings />
      </div>
      <Fold id="booking-rules" title={t("Booking rules")} open={open.rules} onToggle={(value) => setOpen((old) => ({ ...old, rules: value }))}>
        <AssistantBookingRules />
      </Fold>
      <Fold id="reply-time" title={t("Usual reply time")} open={open.reply} onToggle={(value) => setOpen((old) => ({ ...old, reply: value }))}>
        <AssistantReplyTime />
      </Fold>
    </section>
  );
}
