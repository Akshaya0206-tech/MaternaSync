import { useCallback, useState } from 'react';

// The topics a patient has starred on the References page. They are kept on her own phone, for the person signed in, and go nowhere else.
const keyFor = (userId: string) => `maternasync.saved-topics.${userId}`;

function read(userId: string): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '[]');
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function useSavedTopics(userId: string) {
  const [saved, setSaved] = useState<string[]>(() => read(userId));
  const toggle = useCallback((topicId: string) => {
    setSaved((old) => {
      const next = old.includes(topicId) ? old.filter((id) => id !== topicId) : [...old, topicId];
      try {
        localStorage.setItem(keyFor(userId), JSON.stringify(next));
      } catch {
        // The phone's storage is full or blocked: the star works for this visit only.
      }
      return next;
    });
  }, [userId]);
  return { saved, toggle };
}
