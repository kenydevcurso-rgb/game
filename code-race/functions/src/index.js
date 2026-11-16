const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

exports.evaluateSubmission = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Entre com uma conta autorizada.');
  }

  const {
    matchId,
    submissionId,
    solution,
    logic,
    demonstration,
    explanation,
    notes = '',
  } = request.data || {};

  if (
    typeof matchId !== 'string' || !/^[A-Z0-9]{6}$/.test(matchId) ||
    typeof submissionId !== 'string' || !submissionId.trim()
  ) {
    throw new HttpsError('invalid-argument', 'Identificação da sala ou submissão inválida.');
  }

  if (typeof notes !== 'string' || notes.length > 2000) {
    throw new HttpsError('invalid-argument', 'As observações devem ter até 2.000 caracteres.');
  }

  const scores = [solution, logic, demonstration, explanation];
  const limits = [5, 2, 2, 1];
  if (scores.some((value, index) =>
    !Number.isInteger(value) || value < 0 || value > limits[index]
  )) {
    throw new HttpsError('invalid-argument', 'Pontuação fora dos limites permitidos.');
  }

  const organizerRef = db.doc(`matches/${matchId}/organizers/${request.auth.uid}`);
  const organizer = await organizerRef.get();
  if (!organizer.exists) {
    throw new HttpsError('permission-denied', 'Somente o organizador desta sala pode avaliar.');
  }

  const submissionRef = db.doc(`matches/${matchId}/submissions/${submissionId}`);
  const evaluationRef = db.doc(`matches/${matchId}/evaluations/${submissionId}`);

  const total = scores.reduce((sum, value) => sum + value, 0);

  await db.runTransaction(async (transaction) => {
    const submissionSnapshot = await transaction.get(submissionRef);
    if (!submissionSnapshot.exists) {
      throw new HttpsError('not-found', 'Submissão não encontrada nesta sala.');
    }

    const submission = submissionSnapshot.data();
    if (submission.status === 'evaluated') {
      throw new HttpsError('already-exists', 'Esta submissão já foi avaliada.');
    }
    if (submission.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'A submissão não está aguardando avaliação.');
    }

    const teamRef = db.doc(`matches/${matchId}/teams/${submission.teamId}`);
    const teamSnapshot = await transaction.get(teamRef);
    if (!teamSnapshot.exists) {
      throw new HttpsError('not-found', 'Equipe vinculada à submissão não encontrada.');
    }

    const team = teamSnapshot.data();
    transaction.create(evaluationRef, {
      submissionId,
      teamId: submission.teamId,
      missionNumber: submission.missionNumber,
      solution,
      logic,
      demonstration,
      explanation,
      total,
      notes: notes.trim(),
      evaluatorUid: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.update(submissionRef, {
      status: 'evaluated',
      evaluatedAt: FieldValue.serverTimestamp(),
      score: total,
    });

    transaction.update(teamRef, {
      score: (Number(team.score) || 0) + total,
      completedMissions: (Number(team.completedMissions) || 0) + 1,
      lastScoreAt: FieldValue.serverTimestamp(),
    });

    transaction.create(db.doc(`matches/${matchId}/audit/${submissionId}`), {
      action: 'submission_evaluated',
      actorUid: request.auth.uid,
      teamId: submission.teamId,
      total,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, total };
});
