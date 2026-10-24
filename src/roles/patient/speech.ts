import type { Language } from '../../i18n';

const LOCALES: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN' };

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Read text aloud in the patient's language using the voices installed on their own device.
 *  Returns 'no-voice' when the device has none for this language, so the page can say so instead of staying silent. */
export function speak(text: string, language: Language, onEnd: () => void): 'speaking' | 'no-voice' | 'unsupported' {
  if (!canSpeak()) return 'unsupported';
  const prefix = LOCALES[language].slice(0, 2);
  if (!window.speechSynthesis.getVoices().some((voice) => voice.lang.toLowerCase().startsWith(prefix))) return 'no-voice';
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALES[language];
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
  return 'speaking';
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
