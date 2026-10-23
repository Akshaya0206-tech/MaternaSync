import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Send, Volume2 } from "lucide-react";
import { api } from "../../api/client";
import { askMyQuestion } from "../../api/patientPortal";
import { ROOT } from "../../api/continuity";
import type { CompanionReply, Language } from "../../api/continuity";
import { LOCALES, useLanguage } from "../../i18n";
import {
  Empty,
  Feedback,
  Field,
  Page,
  Panel,
  useAction,
} from "../../components/continuity/shared";

interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
  reply?: CompanionReply;
  /** The patient's own words, kept so they can be sent to the care team on request. */
  question?: string;
  sent?: boolean;
}

interface Recognizer {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognizerConstructor = new () => Recognizer;
const SpeechRecognitionApi = (
  window as unknown as {
    SpeechRecognition?: RecognizerConstructor;
    webkitSpeechRecognition?: RecognizerConstructor;
  }
).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognizerConstructor })
    .webkitSpeechRecognition;

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  hi: "हिन्दी · Hindi",
  ta: "தமிழ் · Tamil",
  te: "తెలుగు · Telugu",
};

export function CompanionPage() {
  const { t, language, setLanguage } = useLanguage();
  const action = useAction();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const recognizer = useRef<Recognizer | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);
  useEffect(() => () => recognizer.current?.stop(), []);

  const suggestions = [
    t("Open my daily check-in"),
    t("What should I eat in pregnancy?"),
    t("Tell me about exercise in pregnancy"),
    t("Where can I upload my report?"),
    t("When is my next appointment?"),
    t("Tell me about breastfeeding"),
  ];

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setDraft("");
    setNotice("");
    setBusy(true);
    const userMessage: Message = { id: nextId.current++, role: "user", text: question };
    setMessages((old) => [...old, userMessage]);
    try {
      const reply = await api.post<CompanionReply>(`${ROOT}/companion/ask`, {
        question,
        language,
      });
      setMessages((old) => [
        ...old,
        { id: nextId.current++, role: "bot", text: reply.message, reply, question },
      ]);
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          id: nextId.current++,
          role: "bot",
          text:
            error instanceof Error
              ? error.message
              : t("The companion could not answer. Please try again."),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function toggleListening() {
    if (!SpeechRecognitionApi) return;
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionApi();
    recognition.lang = LOCALES[language];
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) setDraft((old) => (old ? `${old} ${transcript}` : transcript));
    };
    recognition.onerror = () => setNotice(t("Voice input is not available right now. You can type your question."));
    recognition.onend = () => setListening(false);
    recognizer.current = recognition;
    setListening(true);
    recognition.start();
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    const locale = LOCALES[language];
    const hasVoice = window.speechSynthesis
      .getVoices()
      .some((voice) => voice.lang.toLowerCase().startsWith(locale.slice(0, 2)));
    if (!hasVoice) {
      setNotice(t("Your device has no voice installed for this language."));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    window.speechSynthesis.speak(utterance);
  }

  function readable(message: Message) {
    const cards = message.reply?.education.map((m) => `${m.title}. ${m.content}`) ?? [];
    return [message.text, ...cards].join("\n");
  }

  async function sendToCareTeam(message: Message) {
    await action.run(async () => {
      await askMyQuestion(message.question ?? "");
      setMessages((old) => old.map((m) => (m.id === message.id ? { ...m, sent: true } : m)));
    }, t("Sent to your care team. A doctor will review it and the reply will appear in My Questions."));
  }

  return (
    <Page
      title={t("Care companion")}
      subtitle={t("Find your way, learn from reviewed information, and ask your care team.")}
    >
      <Feedback error={action.error} message={action.message} />
      <div className="continuity-note">
        {t(
          "Medical questions go to your care team for review. This companion does not diagnose or recommend treatment.",
        )}
      </div>
      <div className="continuity-fields">
        <Field label={t("Language")}>
          <select
            value={language}
            onChange={(e) => void setLanguage(e.target.value as Language)}
          >
            {Object.entries(LANGUAGE_NAMES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="continuity-actions">
        <Link className="btn-primary" to="/patient/questions">{t("Ask my care team")}</Link>
        <Link className="btn-secondary" to="/patient/records">{t("My records")}</Link>
        <Link className="btn-secondary" to="/patient/daily-log">{t("Daily check-in")}</Link>
        <Link className="btn-secondary" to="/patient/care-plan">{t("My care plan")}</Link>
      </div>
      <Panel title={t("Chat with your care companion")}>
        <div className="companion" lang={language}>
          <div className="companion-log" ref={log} role="log" aria-live="polite">
            <div className="companion-bubble bot">
              {t(
                "Hello! I can help you find things in the app and show information that your clinic has reviewed. I cannot answer medical questions. I will pass those to your care team.",
              )}
            </div>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`companion-bubble ${message.role}${message.reply?.safety === "urgent" ? " urgent" : ""}`}
              >
                <div>{message.text}</div>
                {message.reply?.education.map((module) => (
                  <article className="companion-card" key={module.id}>
                    <h4>{module.title}</h4>
                    <div>{module.content}</div>
                    <small>
                      {t("Reviewed by {name}", { name: module.approvedByName ?? "" })} ·{" "}
                      v{module.version} · {t("Review due {date}", { date: module.reviewDue ?? "" })}
                    </small>
                    {module.sourceUrl && (
                      <small>
                        <a href={module.sourceUrl} target="_blank" rel="noreferrer">
                          {t("Original source")} · {module.section}
                        </a>
                      </small>
                    )}
                  </article>
                ))}
                {message.reply && (
                  <div className="continuity-actions">
                    {message.reply.actions.map((item, index) =>
                      item.type === "navigate" ? (
                        <Link key={index} className="btn-primary" to={item.route}>
                          {item.label}
                        </Link>
                      ) : message.sent ? (
                        <span key={index} className="continuity-muted">
                          {t("Sent to your care team.")}
                        </span>
                      ) : (
                        <button
                          key={index}
                          className="btn-primary"
                          disabled={action.busy}
                          onClick={() => void sendToCareTeam(message)}
                        >
                          {t("Send this question to my care team")}
                        </button>
                      ),
                    )}
                  </div>
                )}
                {message.role === "bot" && "speechSynthesis" in window && (
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 8 }}
                    onClick={() => speak(readable(message))}
                    aria-label={t("Read aloud")}
                  >
                    <Volume2 size={14} /> {t("Read aloud")}
                  </button>
                )}
              </div>
            ))}
            {busy && <p role="status" className="continuity-muted">{t("Thinking…")}</p>}
          </div>
          {!messages.length && (
            <div className="companion-chips" aria-label={t("Suggested questions")}>
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => void ask(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          {notice && <Empty>{notice}</Empty>}
          <form
            className="companion-form"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <textarea
              rows={2}
              maxLength={1000}
              value={draft}
              placeholder={t("Type your question…")}
              aria-label={t("Type your question…")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(draft);
                }
              }}
            />
            {SpeechRecognitionApi && (
              <button
                type="button"
                className="btn-secondary"
                onClick={toggleListening}
                aria-pressed={listening}
                aria-label={listening ? t("Stop listening") : t("Speak your question")}
              >
                <Mic size={16} /> {listening ? t("Listening…") : t("Speak")}
              </button>
            )}
            <button className="btn-primary" disabled={busy || !draft.trim()}>
              <Send size={16} /> {t("Send")}
            </button>
          </form>
        </div>
      </Panel>
    </Page>
  );
}
