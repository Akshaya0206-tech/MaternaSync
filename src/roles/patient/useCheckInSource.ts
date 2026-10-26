import { useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useWorkspace } from '../../components/continuity/shared';
import { rememberEpisode, rememberedEpisode } from '../../offline/pendingCheckIns';

/** Where a patient's check-in page gets her record from. When the phone cannot reach the server to ask for it, the record number kept from the
 *  last visit lets the form open anyway, so a check-in can still be filled in and kept for when there is a signal. */
export function useCheckInSource() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const userId = user?.id ?? '';
  useEffect(() => {
    if (userId && workspace.data) rememberEpisode(userId, workspace.episodeId);
  }, [userId, workspace.data, workspace.episodeId]);
  const episodeId = workspace.episodeId || rememberedEpisode(userId);
  const offlineForm = !workspace.data && !workspace.loading && Boolean(workspace.error) && Boolean(episodeId);
  return { workspace, userId, episodeId, offlineForm, canFill: Boolean(workspace.data) || offlineForm };
}
