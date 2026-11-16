const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();

// A pontuação só é gravada no servidor. O navegador nunca recebe permissão de escrita.
exports.evaluateSubmission = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre com uma conta autorizada.');
  const { matchId, submissionId, solution, logic, demonstration, explanation, notes = '' } = request.data || {};
  if (![matchId, submissionId].every(v => typeof v === 'string' && v.length > 0)) throw new HttpsError('invalid-argument', 'Partida e submissão são obrigatórias.');
  const organizer = await db.doc(`matches/${matchId}/organizers/${request.auth.uid}`).get();
  if (!organizer.exists) throw new HttpsError('permission-denied', 'Somente o organizador pode avaliar.');
  const scores = [solution, logic, demonstration, explanation];
  const limits = [5, 2, 2, 1];
  if (scores.some((v, i) => !Number.isInteger(v) || v < 0 || v > limits[i])) throw new HttpsError('invalid-argument', 'Pontuação fora dos limites permitidos.');
  const total = scores.reduce((a, b) => a + b, 0);
  const submissionRef = db.doc(`matches/${matchId}/submissions/${submissionId}`);
  await db.runTransaction(async (tx) => {
    const sub = await tx.get(submissionRef);
    if (!sub.exists) throw new HttpsError('not-found', 'Submissão não encontrada.');
    if (sub.data().status === 'evaluated') throw new HttpsError('already-exists', 'Esta submissão já foi avaliada.');
    const teamRef = db.doc(`matches/${matchId}/teams/${sub.data().teamId}`);
    const team = await tx.get(teamRef);
    if (!team.exists) throw new HttpsError('not-found', 'Equipe não encontrada.');
    const evaluationRef = db.doc(`matches/${matchId}/evaluations/${submissionId}`);
    tx.set(evaluationRef, { submissionId, teamId: sub.data().teamId, missionNumber: sub.data().missionNumber, solution, logic, demonstration, explanation, total, notes, evaluatorUid: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
    tx.update(submissionRef, { status: 'evaluated', evaluatedAt: FieldValue.serverTimestamp(), score: total });
    tx.update(teamRef, { score: (team.data().score || 0) + total, completedMissions: (team.data().completedMissions || 0) + 1, lastScoreAt: FieldValue.serverTimestamp() });
    tx.set(db.doc(`matches/${matchId}/audit/${submissionId}`), { action: 'submission_evaluated', actorUid: request.auth.uid, teamId: sub.data().teamId, total, createdAt: FieldValue.serverTimestamp() });
  });
  return { success: true, total };
});
