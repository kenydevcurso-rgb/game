export const LANGUAGES = ['Java','JavaScript','SQL','Python','C','C++','C#','PHP','HTML','CSS'];
export const STAGES = [
  { name: 'Primeiros passos', range: '01–05', from: 1, to: 5 },
  { name: 'Lógica de programação', range: '06–10', from: 6, to: 10 },
  { name: 'Desafios intermediários', range: '11–15', from: 11, to: 15 },
  { name: 'Missões finais', range: '16–20', from: 16, to: 20 },
];
// O documento de especificação não contém os enunciados dos 20 cartões oficiais.
// Não inventamos desafios: o organizador deve importar o conteúdo original.
export const emptyMissions = Array.from({ length: 20 }, (_, i) => ({
  id: `mission-${String(i + 1).padStart(2,'0')}`, number: i + 1,
  title: `Missão ${String(i + 1).padStart(2,'0')}`, statement: '',
  suggestedMinutes: 10, languages: LANGUAGES, maxPoints: 10,
  status: 'not_configured', rubric: { solution: 5, logic: 2, demonstration: 2, explanation: 1 },
}));
