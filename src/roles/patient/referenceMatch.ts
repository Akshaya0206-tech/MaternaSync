import { patientReferences } from '../../data/patientReferences';
import type { Lang } from '../../data/patientReferencesTypes';

// Words that say nothing about the subject of a question.
const STOP = new Set([
  'the', 'and', 'for', 'are', 'can', 'did', 'does', 'how', 'what', 'when', 'where', 'why', 'who', 'which', 'should', 'would', 'could', 'will', 'shall', 'may', 'might', 'must',
  'tell', 'say', 'about', 'please', 'need', 'want', 'know', 'give', 'get', 'got', 'have', 'has', 'had', 'with', 'that', 'this', 'these', 'those', 'there', 'their', 'any', 'some',
  'you', 'your', 'mine', 'myself', 'also', 'much', 'many', 'more', 'most', 'very', 'from', 'into', 'than', 'then', 'them', 'they', 'out', 'not', 'but', 'its', 'during',
  'pregnancy', 'pregnant',
]);

// A question that asks about HER own value, symptom or safety is for her doctor. Pointing it at a general topic would read like an answer
// ("is my blood pressure too high?" -> the blood pressure topic), so no topic is suggested for it.
const PERSONAL = /\d|\b(?:is my|are my|am i|too (?:high|low|much|little|many|few)|normal|abnormal|safe|safely|dangerous|risk|risky|worried|worry|enough|serious|my (?:bp|blood|sugar|result|results|report|scan|test|weight))\b/i;

const wordsOf = (text: string): string[] => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const stem = (word: string) => (word.length > 4 ? word.replace(/(ing|es|s)$/, '') : word);

/** The topics on the patient References page that are about the same thing as a question, best first. Only the subject words are compared
 *  with each topic's title and search words (and, less strongly, its text). This finds reading to point to; it never answers the question. */
export function matchReferenceTopics(question: string, language: Lang, max = 3): string[] {
  if (PERSONAL.test(question)) return [];
  const tokens = [...new Set(wordsOf(question).filter((word) => word.length >= 3 && !STOP.has(word)).map(stem))];
  if (!tokens.length) return [];
  const needed = language === 'en' ? 3 : 2; // the search words are English, so a question in another language leans on the topic's own text
  return patientReferences.topics
    .map((topic) => {
      const titleWords = new Set([...wordsOf(topic.title[language]), ...wordsOf(topic.title.en)].map(stem));
      const keywordWords = new Set(topic.keywords.flatMap(wordsOf).map(stem));
      const bodyWords = new Set(wordsOf([topic.summary[language], ...topic.keyPoints[language], topic.summary.en].join(' ')).map(stem));
      let score = 0;
      for (const token of tokens) {
        if (titleWords.has(token) || keywordWords.has(token)) score += 3;
        else if (bodyWords.has(token)) score += 1;
      }
      return { id: topic.id, score };
    })
    .filter((item) => item.score >= needed)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((item) => item.id);
}

export const topicTitle = (id: string, language: Lang): string => patientReferences.topics.find((topic) => topic.id === id)?.title[language] ?? id;
