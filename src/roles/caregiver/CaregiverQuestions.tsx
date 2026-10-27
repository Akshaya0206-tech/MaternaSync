import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Paperclip } from 'lucide-react';
import { askCaregiverQuestion, caregiverQuestions } from '../../api/caregiver';
import type { CaregiverQuestion } from '../../api/caregiver';
import { MOST_QUESTION_FILES, MOST_QUESTION_FILE_BYTES, attachCaregiverQuestionFile, caregiverQuestionInfo, followUpCaregiverQuestion } from '../../api/caregiverCheckIns';
import { formatTime } from '../../api/continuity';
import { useLanguage } from '../../i18n';
import { Badge, Empty, Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';
import { friendlyQuestionStatus } from '../patient/format';
import { Needs } from './CaregiverGuards';
import { useForWoman } from './useForWoman';

export function CaregiverQuestionsPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="questions" title={t('Questions')}>
      {(linkId) => <Questions linkId={linkId} />}
    </Needs>
  );
}

function Questions({ linkId }: { linkId: string }) {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const list = useForWoman<CaregiverQuestion[]>(caregiverQuestions);
  const action = useAction();
  const follow = useAction();
  // Another page can send them here with the question already started (?draft=...): the words are the link's, not ours. It is read once and
  // then taken out of the address, so a reload does not bring it back.
  const [text, setText] = useState(() => params.get('draft') ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [replyTime, setReplyTime] = useState('');
  const [followOpen, setFollowOpen] = useState<string | null>(null);
  const [followText, setFollowText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const fileBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!params.get('draft')) return;
    box.current?.scrollIntoView({ block: 'center' });
    box.current?.focus();
    box.current?.setSelectionRange(box.current.value.length, box.current.value.length);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    caregiverQuestionInfo(linkId).then((info) => { if (active) setReplyTime(info.replyTime); }).catch(() => { if (active) setReplyTime(''); });
    return () => { active = false; };
  }, [linkId]);

  const chooseFiles = (chosen: FileList | null) => {
    setFileError('');
    if (!chosen) return;
    const next = [...files];
    for (const file of Array.from(chosen)) {
      if (next.length >= MOST_QUESTION_FILES) { setFileError(t('You can attach up to {count} files.', { count: MOST_QUESTION_FILES })); break; }
      if (file.size > MOST_QUESTION_FILE_BYTES) { setFileError(t('This file is larger than 10 MB: {name}', { name: file.name })); continue; }
      next.push(file);
    }
    setFiles(next);
    if (fileBox.current) fileBox.current.value = '';
  };

  return (
    <Page title={t('Questions')} subtitle={t('Ask the doctor a question. The doctor reads it, and the reply appears here once they have approved it.')}>
      <Feedback error={list.error || action.error} message={action.message} />
      <Panel title={t('Ask a question')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const sent = await askCaregiverQuestion(linkId, text);
              // The question is sent first; each file follows it, so a file that fails never loses the question.
              let failed = 0;
              for (const file of files) {
                try { await attachCaregiverQuestionFile(linkId, sent.id, file); } catch { failed += 1; }
              }
              setText('');
              setFiles([]);
              await list.reload();
              if (failed) return t('Your question was sent. Some of the files could not be attached.');
            }, t('Your question was sent to the doctor.'));
          }}
        >
          <Field label={t('Your question')}>
            <textarea ref={box} required rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Field label={t('Attach a photo or report (optional)')}>
            <input ref={fileBox} type="file" multiple accept="image/*,.pdf,.jpg,.jpeg,.png" onChange={(e) => chooseFiles(e.target.files)} />
          </Field>
          <p className="continuity-muted">{t('A photo or a PDF, up to {count} files and 10 MB each. Her doctor can open them.', { count: MOST_QUESTION_FILES })}</p>
          {files.length > 0 && (
            <ul className="continuity-list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <Paperclip size={14} aria-hidden="true" /> <span>{file.name}</span>{' '}
                  <button type="button" className="btn-secondary" aria-label={t('Remove {name}', { name: file.name })} onClick={() => setFiles(files.filter((_, i) => i !== index))}>{t('Remove')}</button>
                </li>
              ))}
            </ul>
          )}
          {fileError && <div role="alert" className="continuity-alert">{fileError}</div>}
          <p className="continuity-muted">{t('If it is an emergency, call 112 or your local emergency number instead of waiting for a reply.')}</p>
          <div className="continuity-actions">
            <button className="btn-primary" disabled={action.busy || !text.trim()}>{t('Send question')}</button>
          </div>
          {replyTime && <p className="continuity-muted">{t('Her doctor’s clinic usually replies: {time}. If it is urgent, call 112 or your local emergency number now.', { time: replyTime })}</p>}
        </form>
      </Panel>
      <Panel title={t('Your questions')}>
        {list.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {list.data && !list.data.length && <Empty>{t('You have not asked any questions yet.')}</Empty>}
        <Feedback error={follow.error} message={follow.message} />
        {list.data?.map((q) => (
          <article key={q.id} className="continuity-item">
            <h3>{q.text} <Badge>{friendlyQuestionStatus(q.status)}</Badge></h3>
            <p className="continuity-muted">{formatTime(q.createdAt)}</p>
            {q.followUpOfText && <p className="continuity-muted">{t('About your earlier question: “{text}”', { text: q.followUpOfText })}</p>}
            {(q.attachments ?? []).length > 0 && (
              <p className="continuity-muted">
                {(q.attachments ?? []).map((file) => (
                  <span key={file.id}><Paperclip size={13} aria-hidden="true" /> {t('Attached')}: {file.filename}{' '}</span>
                ))}
              </p>
            )}
            {q.replies.map((r, index) => <div key={index} className="continuity-copy">{r.text}</div>)}
            {q.status === 'ANSWERED' && (
              followOpen !== q.id ? (
                <button type="button" className="btn-secondary" onClick={() => { setFollowOpen(q.id); setFollowText(''); }}>{t('I still have a question')}</button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void follow.run(async () => {
                      await followUpCaregiverQuestion(linkId, q.id, followText);
                      setFollowOpen(null);
                      setFollowText('');
                      await list.reload();
                    }, t('Your question was sent to the doctor.'));
                  }}
                >
                  <Field label={t('Your question about this answer')}>
                    <textarea required autoFocus rows={3} maxLength={2000} value={followText} onChange={(e) => setFollowText(e.target.value)} />
                  </Field>
                  <div className="continuity-actions">
                    <button className="btn-primary" disabled={follow.busy || !followText.trim()}>{t('Send my question')}</button>
                    <button type="button" className="btn-secondary" onClick={() => setFollowOpen(null)}>{t('Cancel')}</button>
                  </div>
                </form>
              )
            )}
          </article>
        ))}
      </Panel>
    </Page>
  );
}
