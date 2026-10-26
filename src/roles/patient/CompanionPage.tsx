import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Send, Volume2 } from "lucide-react";
import { api } from "../../api/client";
import { askMyQuestion } from "../../api/patientPortal";
import { ROOT } from "../../api/continuity";
import type { CompanionReply } from "../../api/continuity";
import { LOCALES, useLanguage } from "../../i18n";
import {
  Empty,
  Feedback,
  Page,
  Panel,
  useAction,
} from "../../components/continuity/shared";
import { canSpeak, speak, stopSpeaking } from "./speech";
import { matchReferenceTopics, topicTitle } from "./referenceMatch";

interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
  reply?: CompanionReply;
  /** The patient's own words, kept so they can be sent to the doctor on request. */
  question?: string;
  sent?: boolean;
  /** Topics on the References page that are about the same thing as the question, when there is no reviewed note to show. */
  references?: string[];
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

export function CompanionPage() {
  const { t, language } = useLanguage();
  const action = useAction();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState<number | null>(null); // the reply being read aloud
  const recognizer = useRef<Recognizer | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages]);
  useEffect(() => () => {
    recognizer.current?.stop();
    stopSpeaking(); // leaving the page stops the voice
  }, []);

  // Each suggestion that is a question about a subject also names the References topics on that subject.
  const suggestions: { label: string; topics?: string[] }[] = [
    { label: t("Open my daily check-in") },
    { label: t("What should I eat in pregnancy?"), topics: ["eating-well", "iron-folic-calcium"] },
    { label: t("Tell me about exercise in pregnancy"), topics: ["staying-active"] },
    { label: t("Where can I upload my report?") },
    { label: t("When is my next appointment?") },
    { label: t("Tell me about breastfeeding"), topics: ["breastfeeding"] },
  ];

  async function ask(text: string, topics?: string[]) {
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
      // Only when the companion has nothing reviewed to show and is not handling a warning sign, a medical question or a way round the app.
      const references = reply.intent === "no_match" ? (topics ?? matchReferenceTopics(question, language)) : [];
      setMessages((old) => [
        ...old,
        { id: nextId.current++, role: "bot", text: reply.message, reply, question, references },
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

  function referenceIntro() {
    return t("The References page has general information on this from official sources. It is not advice about you.");
  }

  function readable(message: Message) {
    const cards = message.reply?.education.map((m) => `${m.title}. ${m.content}`) ?? [];
    const references = message.references?.length ? [referenceIntro(), ...message.references.map((id) => topicTitle(id, language))] : [];
    return [message.text, ...cards, ...references].join("\n");
  }

  // The reply is read in the language of the screen with a voice installed on this device; a second press stops it.
  function readAloud(message: Message) {
    if (reading === message.id) {
      stopSpeaking();
      setReading(null);
      return;
    }
    setNotice("");
    const result = speak(readable(message), language, () => setReading(null));
    if (result === "speaking") setReading(message.id);
    else {
      setReading(null);
      setNotice(t("Your device has no voice installed for this language."));
    }
  }

  async function sendToCareTeam(message: Message) {
    await action.run(async () => {
      await askMyQuestion(message.question ?? "");
      setMessages((old) => old.map((m) => (m.id === message.id ? { ...m, sent: true } : m)));
    }, t("Sent to your doctor. The reply will appear in My Questions once they have reviewed it."));
  }

  return (
    <Page
      title={t("Care companion")}
      subtitle={t("Find your way, learn from reviewed information, and ask your doctor.")}
    >
      <Feedback error={action.error} message={action.message} />
      <div className="continuity-note">
        {t(
          "Medical questions go to your doctor for review. This companion does not diagnose or recommend treatment.",
        )}
      </div>
      <div className="continuity-actions">
        <Link className="btn-primary" to="/patient/questions">{t("Ask my doctor")}</Link>
        <Link className="btn-secondary" to="/patient/records">{t("My records")}</Link>
        <Link className="btn-secondary" to="/patient/daily-log">{t("Daily check-in")}</Link>
        <Link className="btn-secondary" to="/patient/care-plan">{t("My care plan")}</Link>
      </div>
      <Panel title={t("Chat with your care companion")}>
        <div className="companion" lang={language}>
          <div className="companion-log" ref={log} role="log" aria-live="polite">
            <div className="companion-bubble bot">
              {t(
                "Hello! I can help you find things in the app and show information that your clinic has reviewed. I cannot answer medical questions. I will pass those to your doctor.",
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
                {message.references && message.references.length > 0 && (
                  <div className="companion-references">
                    <p>{referenceIntro()}</p>
                    <div className="continuity-actions">
                      {message.references.map((id) => (
                        <Link key={id} className="btn-secondary" to={`/patient/references?topic=${id}`}>
                          {t("Open References: {title}", { title: topicTitle(id, language) })}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {message.reply && (
                  <div className="continuity-actions">
                    {message.reply.actions.map((item, index) =>
                      item.type === "navigate" ? (
                        <Link key={index} className="btn-primary" to={item.route}>
                          {item.label}
                        </Link>
                      ) : message.sent ? (
                        <span key={index} className="continuity-muted">
                          {t("Sent to your doctor.")}
                        </span>
                      ) : (
                        <button
                          key={index}
                          className="btn-primary"
                          disabled={action.busy}
                          onClick={() => void sendToCareTeam(message)}
                        >
                          {t("Send this question to my doctor")}
                        </button>
                      ),
                    )}
                  </div>
                )}
                {message.role === "bot" && canSpeak() && (
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 8 }}
                    onClick={() => readAloud(message)}
                    aria-pressed={reading === message.id}
                  >
                    <Volume2 size={14} aria-hidden="true" /> {reading === message.id ? t("Stop reading") : t("Read aloud")}
                  </button>
                )}
              </div>
            ))}
            {busy && <p role="status" className="continuity-muted">{t("Thinking…")}</p>}
          </div>
          {!messages.length && (
            <div className="companion-chips" aria-label={t("Suggested questions")}>
              {suggestions.map((suggestion) => (
                <button key={suggestion.label} onClick={() => void ask(suggestion.label, suggestion.topics)}>
                  {suggestion.label}
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
