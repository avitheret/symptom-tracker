import type { Condition } from '../types';

const makeSymptoms = (conditionId: string, names: string[]) =>
  names.map((name, i) => ({ id: `${conditionId}-s${i + 1}`, name, conditionId }));

export const PREDEFINED_CONDITIONS: Condition[] = [
  {
    id: 'migraine',
    name: 'Migraine',
    color: '#6366f1',
    symptoms: makeSymptoms('migraine', [
      'Throbbing headache', 'Nausea', 'Light sensitivity', 'Sound sensitivity',
      'Visual aura', 'Vomiting', 'Neck stiffness', 'Dizziness',
    ]),
  },
  {
    id: 'ibs',
    name: 'Irritable Bowel Syndrome (IBS)',
    color: '#f59e0b',
    symptoms: makeSymptoms('ibs', [
      'Abdominal pain', 'Bloating', 'Diarrhea', 'Constipation',
      'Cramping', 'Gas', 'Mucus in stool', 'Urgency to defecate',
    ]),
  },
  {
    id: 'arthritis',
    name: 'Arthritis',
    color: '#ef4444',
    symptoms: makeSymptoms('arthritis', [
      'Joint pain', 'Joint stiffness', 'Swelling', 'Reduced range of motion',
      'Morning stiffness', 'Warmth around joints', 'Fatigue', 'Tenderness',
    ]),
  },
  {
    id: 'asthma',
    name: 'Asthma',
    color: '#06b6d4',
    symptoms: makeSymptoms('asthma', [
      'Shortness of breath', 'Wheezing', 'Chest tightness', 'Coughing',
      'Rapid breathing', 'Difficulty sleeping', 'Exercise-induced symptoms', 'Mucus production',
    ]),
  },
  {
    id: 'diabetes',
    name: 'Diabetes',
    color: '#10b981',
    symptoms: makeSymptoms('diabetes', [
      'Increased thirst', 'Frequent urination', 'Fatigue', 'Blurred vision',
      'Slow-healing wounds', 'Tingling hands/feet', 'Unexplained weight loss', 'Increased hunger',
    ]),
  },
  {
    id: 'anxiety',
    name: 'Anxiety',
    color: '#8b5cf6',
    symptoms: makeSymptoms('anxiety', [
      'Excessive worry', 'Restlessness', 'Racing heart', 'Sweating',
      'Trembling', 'Shortness of breath', 'Difficulty concentrating', 'Sleep disturbance',
    ]),
  },
  {
    id: 'depression',
    name: 'Depression',
    color: '#64748b',
    symptoms: makeSymptoms('depression', [
      'Persistent sadness', 'Loss of interest', 'Fatigue', 'Sleep changes',
      'Appetite changes', 'Difficulty concentrating', 'Feelings of worthlessness', 'Social withdrawal',
    ]),
  },
  {
    id: 'fibromyalgia',
    name: 'Fibromyalgia',
    color: '#ec4899',
    symptoms: makeSymptoms('fibromyalgia', [
      'Widespread pain', 'Fatigue', 'Cognitive difficulties (fog)', 'Sleep problems',
      'Headaches', 'Depression', 'Irritable bowel', 'Sensitivity to temperature',
    ]),
  },
  {
    id: 'eczema',
    name: 'Eczema',
    color: '#f97316',
    symptoms: makeSymptoms('eczema', [
      'Itching', 'Dry skin', 'Redness', 'Rash',
      'Scaly patches', 'Oozing or crusting', 'Skin thickening', 'Inflammation',
    ]),
  },
  {
    id: 'lupus',
    name: 'Lupus',
    color: '#dc2626',
    symptoms: makeSymptoms('lupus', [
      'Butterfly rash', 'Joint pain', 'Fatigue', 'Fever',
      'Hair loss', 'Chest pain', 'Sensitivity to sunlight', 'Kidney problems',
    ]),
  },
  {
    id: 'crohns',
    name: "Crohn's Disease",
    color: '#84cc16',
    symptoms: makeSymptoms('crohns', [
      'Abdominal pain', 'Diarrhea', 'Bloody stool', 'Weight loss',
      'Fatigue', 'Fever', 'Mouth sores', 'Nausea',
    ]),
  },
  {
    id: 'hypertension',
    name: 'Hypertension',
    color: '#0ea5e9',
    symptoms: makeSymptoms('hypertension', [
      'Headache', 'Dizziness', 'Chest pain', 'Shortness of breath',
      'Nosebleeds', 'Blurred vision', 'Nausea', 'Flushing',
    ]),
  },
];
