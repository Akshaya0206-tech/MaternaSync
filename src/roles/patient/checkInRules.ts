// A typing-mistake check for the numbers in a check-in. It only catches what cannot be a real entry, such as a blood pressure of 1180 or a
// weight of 6.6 kg, or the two blood pressure numbers the wrong way round. It says nothing about what a number means.
export const LIMITS = {
  systolic: { min: 30, max: 300 },
  diastolic: { min: 20, max: 200 },
  weightKg: { min: 20, max: 400 },
  movementCount: { min: 0, max: 1000 },
  movementMinutes: { min: 1, max: 1440 },
} as const;

export type CheckInField = keyof typeof LIMITS;
export type CheckInNumbers = Record<CheckInField, string>;
export type CheckInErrors = Partial<Record<CheckInField, string>>;
type Say = (text: string, values?: Record<string, string | number>) => string;

export function checkNumbers(values: CheckInNumbers, t: Say): CheckInErrors {
  const errors: CheckInErrors = {};
  for (const field of Object.keys(LIMITS) as CheckInField[]) {
    const text = values[field].trim();
    if (!text) continue;
    const { min, max } = LIMITS[field];
    const number = Number(text);
    if (!Number.isFinite(number) || number < min || number > max) {
      errors[field] = t('Please check this number. This box accepts values from {min} to {max}.', { min, max });
    }
  }
  const has = (field: CheckInField) => values[field].trim() !== '';
  if (has('systolic') !== has('diastolic')) {
    errors[has('systolic') ? 'diastolic' : 'systolic'] = t('Enter both numbers, or leave both empty.');
  } else if (has('systolic') && !errors.systolic && !errors.diastolic && Number(values.systolic) <= Number(values.diastolic)) {
    errors.diastolic = t('Please check both numbers. The first (systolic) is always higher than the second (diastolic).');
  }
  if (has('movementCount') !== has('movementMinutes')) {
    errors[has('movementCount') ? 'movementMinutes' : 'movementCount'] = t('Enter both the movements and the minutes, or leave both empty.');
  }
  return errors;
}
