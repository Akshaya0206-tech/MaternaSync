import {
  cloneElement,
  isValidElement,
  useId,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { getContext, getWorkspace } from "../../api/continuity";
import type { Context, Workspace } from "../../api/continuity";
import { useLanguage } from "../../i18n";
// continuity.css is loaded once, from main.tsx: it styles the menu and tour as well as these pages.

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function run(action: () => Promise<void>, success = "Saved.") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return { busy, error, message, run, setError };
}

export function useWorkspace() {
  const [params, setParams] = useSearchParams();
  const [context, setContext] = useState<Context | null>(null);
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const activeEpisode = useRef("");
  const requested = params.get("episodeId");
  const episodeId = requested ?? context?.episodes[0]?.id ?? "";
  useEffect(() => {
    let active = true;
    getContext()
      .then((c) => {
        if (active) {
          setContext(c);
          if (!c.episodes.length) setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const reload = useCallback(async () => {
    if (!episodeId || activeEpisode.current !== episodeId) return;
    const current = ++generation.current;
    const result = await getWorkspace(episodeId);
    if (current === generation.current && activeEpisode.current === episodeId)
      setData(result);
  }, [episodeId]);
  useEffect(() => {
    let active = true;
    if (!episodeId) return;
    activeEpisode.current = episodeId;
    setData(null);
    setError("");
    setLoading(true);
    reload()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      activeEpisode.current = "";
    };
  }, [episodeId, reload]);
  const select = (id: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("episodeId", id);
      return next;
    });
  };
  return {
    data: data?.episodeId === episodeId ? data : null,
    context,
    episodeId,
    select,
    reload,
    error,
    loading,
    selectedEpisode: context?.episodes.find((e) => e.id === episodeId),
  };
}

export function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <main className="continuity-page">
      <header className="continuity-heading">
        <div className="eyebrow">{t("MATERNASYNC · CONNECTED CARE")}</div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </main>
  );
}
export function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="glass-panel continuity-panel">
      <div className="continuity-panel-heading">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <div role="alert" className="continuity-alert">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="continuity-success">
          {message}
        </div>
      )}
    </>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="continuity-empty">{children}</p>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="continuity-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id })
        : children}
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="continuity-badge">{children}</span>;
}
export function PatientSelect({
  workspace,
}: {
  workspace: ReturnType<typeof useWorkspace>;
}) {
  return (
    <>
      <Feedback error={workspace.error} />
      {workspace.context && workspace.context.episodes.length > 0 && (
        <Field label="Patient">
          <select
            value={workspace.episodeId}
            onChange={(e) => workspace.select(e.target.value)}
          >
            {workspace.context.episodes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.patientName}
              </option>
            ))}
          </select>
        </Field>
      )}
      {workspace.loading && <p role="status">Loading care workspace…</p>}
      {workspace.context?.episodes.length === 0 && (
        <Empty>No patient episode is assigned to this account.</Empty>
      )}
    </>
  );
}
