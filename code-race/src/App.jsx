import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Activity, ArrowRight, Award, BookOpen, CheckCircle2, ChevronRight, CircleHelp, Code2, Copy, Flag, Gauge, LockKeyhole, Monitor, Plus, Radio, ShieldCheck, Trophy, Users, Wifi, X } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, addDoc, where, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, firebaseApp, firebaseReady } from './lib/firebase';
import { emptyMissions, LANGUAGES, STAGES } from './lib/data';

const initialRoom = { code: '', name: '', team: '', members: '', role: 'participant' };
const demoRanking = [];
const fmt = (n) => String(n).padStart(2, '0');

export default function App() {
  const [view, setView] = useState('home');
  const [room, setRoom] = useState(initialRoom);
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState(emptyMissions);
  const [teams, setTeams] = useState([]);
  const [ranking, setRanking] = useState(demoRanking);
  const [submissions, setSubmissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState(1);
  const [language, setLanguage] = useState('JavaScript');
  const [code, setCode] = useState('// Escreva sua solução aqui\n');
  const [explanation, setExplanation] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [isRegister, setIsRegister] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [roomStatus, setRoomStatus] = useState('waiting');
  const [timerEnd, setTimerEnd] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [review, setReview] = useState({ solution: 0, logic: 0, demonstration: 0, explanation: 0, notes: '' });
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [missionJson, setMissionJson] = useState('');

  useEffect(() => {
    if (!firebaseReady) return;
    return onAuthStateChanged(auth, setCurrentUser);
  }, []);
  useEffect(() => {
    if (!firebaseReady || !room.code || !profile) return;
    const matchPath = ['matches', room.code];
    const stopRoom = onSnapshot(doc(db, ...matchPath), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRoomStatus(data.status || 'waiting');
        setTimerEnd(data.timerEndsAt?.toMillis?.() || null);
      } else setRoomStatus('waiting');
    }, (err) => toast(`Falha ao acompanhar a sala: ${err.message}`));
    const stopTeams = onSnapshot(query(collection(db, ...matchPath, 'teams')), (snap) => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => toast(`Falha ao carregar equipes: ${err.message}`));
    const stopRanking = onSnapshot(query(collection(db, ...matchPath, 'teams'), orderBy('score', 'desc')), (snap) => setRanking(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => toast(`Falha no ranking: ${err.message}`));
    const submissionsRef = collection(db, ...matchPath, 'submissions');
    const submissionsQuery = profile.role === 'organizer'
      ? query(submissionsRef, orderBy('createdAt', 'desc'))
      : query(submissionsRef, where('teamId', '==', profile.teamId), orderBy('createdAt', 'desc'));
    const stopSubs = onSnapshot(submissionsQuery, (snap) => setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (err) => toast(`Falha ao carregar submissões: ${err.message}`));
    const stopMissions = onSnapshot(query(collection(db, ...matchPath, 'missions'), orderBy('number')), (snap) => {
      setMissions(snap.empty ? emptyMissions : snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => toast(`Falha ao carregar missões: ${err.message}`));
    return () => { stopRoom(); stopTeams(); stopRanking(); stopSubs(); stopMissions(); };
  }, [room.code, profile?.role, profile?.teamId]);
  useEffect(() => {
    if (!timerEnd) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [timerEnd]);
  const activeMission = missions.find(m => m.number === selectedMission) || missions[0];
  const totalScore = useMemo(() => ranking.find(t => t.id === profile?.teamId)?.score || 0, [ranking, profile]);
  const configuredCount = missions.filter(m => m.statement.trim()).length;

  function toast(message) { setNotice(message); window.setTimeout(() => setNotice(''), 3600); }
  function go(next) { setView(next); setNotice(''); }
  async function authenticate(e) {
    e.preventDefault(); if (!firebaseReady) return toast('Configure o Firebase no arquivo .env para ativar contas reais.');
    setLoading(true);
    try { const result = isRegister ? await createUserWithEmailAndPassword(auth, authForm.email, authForm.password) : await signInWithEmailAndPassword(auth, authForm.email, authForm.password); setCurrentUser(result.user); toast('Autenticação realizada.'); }
    catch (err) { toast(err.message || 'Não foi possível autenticar.'); } finally { setLoading(false); }
  }
  async function createRoom(e) {
    e.preventDefault(); if (!room.name.trim()) return toast('Informe o nome da competição.');
    if (!firebaseReady) return toast('Para criar uma sala multiplayer real, configure o Firebase.');
    if (!currentUser) return go('auth');
    setLoading(true);
    try {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      await setDoc(doc(db, 'matches', code), { name: room.name.trim(), ownerUid: currentUser.uid, status: 'waiting', createdAt: serverTimestamp(), currentMission: 1, timerEndsAt: null });
      await setDoc(doc(db, 'matches', code, 'organizers', currentUser.uid), { uid: currentUser.uid, email: currentUser.email });
      setRoom(r => ({ ...r, code })); setProfile({ role: 'organizer', name: currentUser.email, teamId: null }); go('admin');
    } catch (err) { toast(err.message || 'Erro ao criar competição.'); } finally { setLoading(false); }
  }
  async function joinRoom(e) {
    e.preventDefault(); if (!room.code.trim() || !room.team.trim()) return toast('Informe o código e o nome da equipe.');
    if (!firebaseReady) return toast('Configure o Firebase para conectar equipes entre dispositivos.');
    if (!currentUser) return go('auth');
    setLoading(true);
    try {
      const codeKey = room.code.trim().toUpperCase();
      const matchSnapshot = await getDoc(doc(db, 'matches', codeKey));
      if (!matchSnapshot.exists()) throw new Error('Sala não encontrada. Confira o código informado.');
      if (matchSnapshot.data().status === 'finished') throw new Error('Esta competição já foi encerrada.');
      const teamId = currentUser.uid;
      await setDoc(doc(db, 'matches', codeKey, 'teams', teamId), { name: room.team.trim(), members: room.members.split(',').map(x => x.trim()).filter(Boolean), score: 0, completedMissions: 0, joinedAt: serverTimestamp(), online: true, uid: currentUser.uid }, { merge: true });
      setRoom(r => ({ ...r, code: codeKey })); setProfile({ role: 'participant', name: room.team, teamId }); go('game');
    } catch (err) { toast(err.message || 'Não foi possível entrar na sala.'); } finally { setLoading(false); }
  }
  async function submitSolution() {
    if (!firebaseReady || !profile?.teamId) return toast('Entre em uma sala conectada ao Firebase antes de enviar.');
    if (!activeMission?.statement) return toast('Esta missão ainda não foi configurada pelo organizador.');
    if (!code.trim()) return toast('Escreva sua solução antes de enviar.');
    const duplicate = submissions.some(s => s.teamId === profile.teamId && s.missionNumber === selectedMission && s.status === 'pending');
    if (duplicate) return toast('Já existe uma submissão pendente desta missão.');
    setLoading(true);
    try {
      await addDoc(collection(db, 'matches', room.code, 'submissions'), { teamId: profile.teamId, teamName: profile.name, missionNumber: selectedMission, language, code, explanation, status: 'pending', createdAt: serverTimestamp() });
      toast('Solução enviada para avaliação.');
    } catch (err) { toast(err.message || 'Falha ao enviar solução.'); } finally { setLoading(false); }
  }
  async function changeMatchStatus(status) {
    if (!firebaseReady || profile?.role !== 'organizer') return toast('Ação exclusiva do organizador autenticado.');
    try { await setDoc(doc(db, 'matches', room.code), { status, updatedAt: serverTimestamp() }, { merge: true }); setRoomStatus(status); toast(status === 'running' ? 'Competição iniciada.' : status === 'paused' ? 'Competição pausada.' : 'Competição encerrada.'); }
    catch (err) { toast(err.message || 'Não foi possível atualizar a partida.'); }
  }
  async function saveMissionImport(e) {
    e.preventDefault();
    try {
      const parsed = JSON.parse(missionJson);
      if (!Array.isArray(parsed) || parsed.length !== 20) throw new Error('O arquivo precisa conter exatamente 20 missões em formato JSON.');
      if (parsed.some((m, i) => Number(m.number) !== i + 1 || typeof m.statement !== 'string' || !m.title)) throw new Error('Cada missão precisa ter number (1–20), title e statement.');
      if (!firebaseReady || profile?.role !== 'organizer' || !room.code) throw new Error('Entre como organizador de uma sala conectada para salvar as missões.');
      const normalized = parsed.map((m, i) => ({
        ...emptyMissions[i], ...m,
        id: `mission-${String(i + 1).padStart(2, '0')}`,
        number: i + 1,
        title: String(m.title).trim(),
        statement: String(m.statement).trim(),
        languages: Array.isArray(m.languages) && m.languages.length ? m.languages.filter(x => LANGUAGES.includes(x)) : LANGUAGES,
        suggestedMinutes: Number.isFinite(Number(m.suggestedMinutes)) ? Number(m.suggestedMinutes) : 10,
        maxPoints: 10,
        rubric: { solution: 5, logic: 2, demonstration: 2, explanation: 1, ...m.rubric }
      }));
      if (normalized.some(m => !m.statement || !m.languages.length)) throw new Error('Todas as missões precisam de enunciado e ao menos uma linguagem válida.');
      const batch = writeBatch(db);
      normalized.forEach((mission) => {
        const { id, ...data } = mission;
        batch.set(doc(db, 'matches', room.code, 'missions', id), { ...data, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setMissions(normalized);
      toast('As 20 missões foram salvas no Firestore e já podem ser carregadas pelas equipes.');
      setMissionJson('');
    } catch (err) { toast(err.message || 'JSON inválido.'); }
  }
  async function saveEvaluation() {
    if (!firebaseReady || profile?.role !== 'organizer' || !selectedSubmission) return toast('Avaliação não autorizada.');
    if (selectedSubmission.status === 'evaluated') return toast('Esta submissão já foi avaliada.');
    const score = review.solution + review.logic + review.demonstration + review.explanation;
    if (score > 10) return toast('A avaliação não pode ultrapassar 10 pontos.');
    setLoading(true);
    try {
      const functions = getFunctions(firebaseApp);
      const evaluate = httpsCallable(functions, 'evaluateSubmission');
      await evaluate({
        matchId: room.code,
        submissionId: selectedSubmission.id,
        solution: review.solution,
        logic: review.logic,
        demonstration: review.demonstration,
        explanation: review.explanation,
        notes: review.notes
      });
      toast(`Avaliação confirmada: ${score}/10 pontos. O ranking será atualizado automaticamente.`);
      setSelectedSubmission(null);
      setActiveTab('submissions');
      setReview({ solution: 0, logic: 0, demonstration: 0, explanation: 0, notes: '' });
    } catch (err) {
      toast(err.message || 'Não foi possível confirmar a avaliação.');
    } finally {
      setLoading(false);
    }
  }
  const scoreTotal = review.solution + review.logic + review.demonstration + review.explanation;
  const isOrganizer = profile?.role === 'organizer';

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => go('home')}><span className="brand-mark"><Code2 size={22}/></span><span>CODE<span className="brand-accent">RACE</span><small>Gincana de Informática</small></span></button><nav><button onClick={() => go('home')}>Início</button><button onClick={() => go('ranking')}>Ranking</button><button onClick={() => go('rules')}>Como jogar</button></nav><div className="top-actions"><span className={`connection ${firebaseReady ? 'connected' : ''}`}><i/> {firebaseReady ? 'Firebase configurado' : 'Modo de configuração'}</span><button className="avatar" onClick={() => go('auth')}>{currentUser?.email?.[0]?.toUpperCase() || 'U'}</button></div></header>
    <main>
      {view === 'home' && <section className="hero-layout"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot"/> DESAFIO • ESTRATÉGIA • PROGRAMAÇÃO</div><h1>O código é seu.<br/><span>A corrida também.</span></h1><p className="hero-lead">Uma competição de programação em equipe. Resolva missões, conquiste pontos e avance até a linha de chegada.</p><div className="hero-buttons"><button className="btn-primary" onClick={() => { setRoom(initialRoom); go('create'); }}>Criar competição <ArrowRight size={17}/></button><button className="btn-secondary" onClick={() => { setShowJoin(true); go('join'); }}>Entrar em uma sala</button></div><div className="hero-meta"><span><Users size={15}/> Equipes simultâneas</span><span><Radio size={15}/> Ranking ao vivo</span><span><Flag size={15}/> 20 checkpoints</span></div></div><div className="race-visual"><div className="visual-glow"/><div className="visual-top"><span className="live-label"><i/> LIVE COMPETITION</span><span className="visual-code">CR / 2026</span></div><div className="track"><div className="track-line"/><div className="track-node node-a"><span>01</span></div><div className="track-node node-b"><span>08</span></div><div className="track-node node-c"><span>14</span></div><div className="track-node node-d"><Flag size={17}/></div><div className="racer racer-one">&lt;/&gt;</div><div className="racer racer-two">{ }</div></div><div className="visual-bottom"><div><small>OBJETIVO</small><strong>20 MISSÕES</strong></div><div><small>PONTUAÇÃO</small><strong>10 PTS / MISSÃO</strong></div><div><small>VITÓRIA</small><strong>LINHA DE CHEGADA</strong></div></div></div><div className="hero-stats"><div><strong>20</strong><span>missões</span></div><div><strong>10</strong><span>pontos por missão</span></div><div><strong>10</strong><span>linguagens possíveis</span></div><div><strong>∞</strong><span>espírito de equipe</span></div></div></section>}
      {view === 'create' && <section className="form-page"><button className="back-link" onClick={() => go('home')}>← Voltar ao início</button><div className="section-kicker">NOVA COMPETIÇÃO</div><h2>Prepare a <span>largada.</span></h2><p className="muted">Crie uma sala e convide as equipes com um código de acesso exclusivo.</p><form className="panel form-panel" onSubmit={createRoom}><label>Nome da competição<input required value={room.name} onChange={e => setRoom({...room,name:e.target.value})} placeholder="Ex.: Gincana de Informática 2026"/></label><div className="notice-box"><ShieldCheck size={18}/><span>O criador da sala será definido como organizador. É necessário autenticar-se com uma conta Firebase.</span></div><button className="btn-primary full" disabled={loading}>{loading ? 'Criando...' : 'Criar sala de competição'} <ArrowRight size={17}/></button></form></section>}
      {view === 'join' && <section className="form-page"><button className="back-link" onClick={() => go('home')}>← Voltar ao início</button><div className="section-kicker">ENTRAR NA CORRIDA</div><h2>Sua equipe está <span>pronta?</span></h2><p className="muted">Insira o código fornecido pelo organizador e identifique sua equipe.</p><form className="panel form-panel" onSubmit={joinRoom}><label>Código da sala<input required className="code-input" maxLength={6} value={room.code} onChange={e => setRoom({...room,code:e.target.value.toUpperCase()})} placeholder="ABC123"/></label><label>Nome da equipe<input required value={room.team} onChange={e => setRoom({...room,team:e.target.value})} placeholder="Ex.: Byte Hunters"/></label><label>Integrantes <small>(separe os nomes por vírgula)</small><input value={room.members} onChange={e => setRoom({...room,members:e.target.value})} placeholder="Ana, Pedro, João"/></label><button className="btn-primary full" disabled={loading}>{loading ? 'Conectando...' : 'Entrar na sala'} <ArrowRight size={17}/></button></form></section>}
      {view === 'auth' && <section className="form-page"><button className="back-link" onClick={() => go('home')}>← Voltar</button><div className="section-kicker">IDENTIFICAÇÃO</div><h2>Acesse sua <span>conta.</span></h2><p className="muted">Autenticação individual para proteger salas, equipes e ações administrativas.</p><form className="panel form-panel" onSubmit={authenticate}><label>E-mail<input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm,email:e.target.value})} placeholder="voce@escola.com"/></label><label>Senha<input type="password" minLength={6} required value={authForm.password} onChange={e => setAuthForm({...authForm,password:e.target.value})} placeholder="Mínimo de 6 caracteres"/></label><button className="btn-primary full" disabled={loading}>{loading ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'} <ArrowRight size={17}/></button><button type="button" className="text-button" onClick={() => setIsRegister(!isRegister)}>{isRegister ? 'Já tenho conta — entrar' : 'Primeiro acesso — criar conta'}</button></form></section>}
      {view === 'rules' && <section className="content-page"><div className="section-kicker">GUIA DA COMPETIÇÃO</div><h2>Como funciona a <span>corrida?</span></h2><div className="rule-grid">{[{n:'01',t:'Forme sua equipe',d:'Entre na sala usando o código da competição e informe os integrantes.'},{n:'02',t:'Receba a missão',d:'Quando o organizador liberar a etapa, leia o enunciado e escolha a linguagem.'},{n:'03',t:'Programe e envie',d:'Construa uma solução em equipe e envie o código para avaliação.'},{n:'04',t:'Conquiste pontos',d:'O professor avalia quatro critérios, totalizando até 10 pontos por missão.'},{n:'05',t:'Avance no percurso',d:'A pontuação confirmada atualiza a classificação e o progresso da equipe.'},{n:'06',t:'Cruze a chegada',d:'Complete as 20 missões e dispute o topo do ranking.'}].map(x=><article className="panel rule-card" key={x.n}><b>{x.n}</b><h3>{x.t}</h3><p>{x.d}</p></article>)}</div><div className="notice-box"><CircleHelp size={18}/><span>Critérios: solução (0–5), lógica e organização (0–2), demonstração/teste (0–2), explicação (0–1).</span></div></section>}
      {view === 'ranking' && <section className="content-page"><div className="section-kicker">CLASSIFICAÇÃO</div><h2>Ranking <span>da corrida.</span></h2><p className="muted">Os dados abaixo vêm da sala conectada. Sem uma competição ativa, nenhuma pontuação é exibida.</p><div className="panel ranking-panel"><div className="panel-head"><div><h3><Trophy size={18}/> Classificação geral</h3><small>{room.code ? `Sala ${room.code}` : 'Nenhuma sala selecionada'}</small></div><span className="live-pill"><i/> AO VIVO</span></div>{ranking.length ? ranking.map((t,i)=><div className="rank-row" key={t.id}><strong className={`rank-num rank-${i+1}`}>{fmt(i+1)}</strong><div className="team-avatar">{t.name?.slice(0,1)?.toUpperCase()}</div><div className="rank-team"><b>{t.name}</b><small>{t.completedMissions || 0} missões concluídas</small></div><div className="rank-progress"><div><span style={{width:`${Math.min(100,((t.completedMissions||0)/20)*100)}%`}}/></div></div><strong className="rank-score">{t.score || 0} <small>PTS</small></strong></div>) : <div className="empty-state"><Trophy size={30}/><b>A corrida ainda não começou</b><span>Quando equipes entrarem em uma sala, a classificação aparecerá aqui.</span></div>}</div></section>}
      {view === 'game' && <section className="game-page"><div className="game-header"><div><div className="section-kicker">SALA {room.code}</div><h2>{profile?.name || room.team}</h2><p className="muted">Sua equipe está na competição.</p></div><div className="game-metrics"><div><small>PONTUAÇÃO</small><b>{totalScore} <em>PTS</em></b></div><div><small>CRONÔMETRO</small><b>{fmt(Math.floor(seconds/60))}:{fmt(seconds%60)}</b></div><div><small>STATUS</small><b className="status-text">{roomStatus === 'running' ? 'EM ANDAMENTO' : roomStatus === 'paused' ? 'PAUSADA' : 'AGUARDANDO'}</b></div></div></div><div className="game-grid"><aside className="panel mission-sidebar"><div className="panel-head"><h3><Flag size={17}/> Percurso</h3><span>20 etapas</span></div>{STAGES.map(stage=><div className="stage-block" key={stage.name}><div className="stage-title"><b>{stage.name}</b><small>{stage.range}</small></div><div className="checkpoint-grid">{Array.from({length:5},(_,j)=>stage.from+j).map(n=><button key={n} className={`checkpoint ${n===selectedMission?'selected':''} ${n<selectedMission?'done':''}`} onClick={()=>setSelectedMission(n)}>{fmt(n)}</button>)}</div></div>)}<div className="team-progress"><small>PROGRESSO DA EQUIPE</small><div className="progress-bar"><span style={{width:`${(Math.max(0,selectedMission-1)/20)*100}%`}}/></div><b>{selectedMission-1} / 20 missões</b></div></aside><section className="panel mission-work"><div className="mission-top"><div><span className="mission-tag">MISSÃO {fmt(selectedMission)}</span><h3>{activeMission?.title}</h3></div><span className="points-tag">10 PTS</span></div>{activeMission?.statement ? <p className="mission-statement">{activeMission.statement}</p> : <div className="empty-mission"><BookOpen size={25}/><b>Missão ainda não liberada</b><span>O organizador precisa importar os 20 cartões oficiais e liberar esta missão.</span></div>}<div className="editor-toolbar"><label>Linguagem<select value={language} onChange={e=>setLanguage(e.target.value)}>{LANGUAGES.map(l=><option key={l}>{l}</option>)}</select></label><div><button className="icon-button" onClick={()=>{navigator.clipboard?.writeText(code);toast('Código copiado.')}} title="Copiar código"><Copy size={16}/></button><button className="icon-button" onClick={()=>setCode('')} title="Limpar editor"><X size={16}/></button></div></div><div className="editor-wrap"><Editor height="300px" language={({'C++':'cpp','C#':'csharp','JavaScript':'javascript'}[language] || language.toLowerCase())} theme="vs-dark" value={code} onChange={v=>setCode(v||'')} options={{fontSize:14,minimap:{enabled:false},scrollBeyondLastLine:false,automaticLayout:true,wordWrap:'on',padding:{top:14}}}/></div><label className="explanation-label">Explique brevemente a solução<textarea value={explanation} onChange={e=>setExplanation(e.target.value)} placeholder="Como sua equipe resolveu o desafio?" rows="3"/></label><button className="btn-primary submit-btn" onClick={submitSolution} disabled={loading || !activeMission?.statement}>{loading?'Enviando...':'Enviar solução para avaliação'} <ArrowRight size={17}/></button></section></div></section>}
      {view === 'admin' && <section className="admin-page"><div className="admin-header"><div><div className="section-kicker">CENTRAL DE CONTROLE • SALA {room.code}</div><h2>Painel do <span>organizador.</span></h2></div><div className="admin-controls"><button className="btn-secondary" onClick={()=>changeMatchStatus('paused')}>Pausar</button><button className="btn-primary" onClick={()=>changeMatchStatus('running')}>Iniciar corrida <ArrowRight size={16}/></button></div></div><div className="admin-tabs">{[['overview','Visão geral'],['missions','Missões'],['submissions','Submissões'],['screen','Modo telão']].map(([id,label])=><button className={activeTab===id?'active':''} onClick={()=>setActiveTab(id)} key={id}>{label}</button>)}</div>{activeTab==='overview' && <div className="admin-grid"><div className="panel admin-stat"><Users/><small>EQUIPES CONECTADAS</small><b>{teams.length}</b></div><div className="panel admin-stat"><Activity/><small>SUBMISSÕES</small><b>{submissions.length}</b></div><div className="panel admin-stat"><Trophy/><small>MISSÕES CONFIGURADAS</small><b>{configuredCount}/20</b></div><div className="panel admin-stat"><Gauge/><small>STATUS DA PARTIDA</small><b className="small-stat">{roomStatus==='running'?'EM ANDAMENTO':roomStatus==='paused'?'PAUSADA':'AGUARDANDO'}</b></div><div className="panel admin-wide"><div className="panel-head"><h3>Equipes na sala</h3><span>{teams.length} participantes</span></div>{teams.length?teams.map(t=><div className="simple-row" key={t.id}><span className="team-avatar">{t.name?.[0]}</span><b>{t.name}</b><span>{t.members?.length||0} integrantes</span><strong>{t.score||0} pts</strong></div>):<div className="empty-inline">Aguardando as equipes entrarem com o código <b>{room.code}</b>.</div>}</div><div className="panel admin-wide"><div className="panel-head"><h3>Ranking ao vivo</h3><button className="text-button" onClick={()=>go('ranking')}>Abrir ranking <ChevronRight size={14}/></button></div>{ranking.length?ranking.slice(0,5).map((t,i)=><div className="simple-row" key={t.id}><b>#{i+1} {t.name}</b><span>{t.completedMissions||0}/20 missões</span><strong>{t.score||0} pts</strong></div>):<div className="empty-inline">Nenhuma pontuação registrada.</div>}</div></div>}{activeTab==='missions'&&<div className="panel import-panel"><div className="panel-head"><h3><BookOpen size={18}/> Configurar as 20 missões oficiais</h3><span>{configuredCount}/20 configuradas</span></div><p>Importe um JSON com os enunciados originais. O arquivo de especificação recebido descreve a estrutura, mas não contém o texto dos 20 cartões; por isso, nenhum desafio foi inventado.</p><form onSubmit={saveMissionImport}><textarea rows="12" value={missionJson} onChange={e=>setMissionJson(e.target.value)} placeholder={'[\n  {"number":1,"title":"Título original","statement":"Enunciado do cartão...","suggestedMinutes":10,"languages":["Python","JavaScript"]}\n]'} /><button className="btn-primary">Validar e carregar 20 missões</button></form></div>}{activeTab==='submissions'&&<div className="panel submissions-panel"><div className="panel-head"><h3>Submissões recebidas</h3><span>{submissions.length} registros</span></div>{submissions.length?submissions.map(s=><button className="submission-row" key={s.id} onClick={()=>{setSelectedSubmission(s);setActiveTab('review')}}><div><b>{s.teamName}</b><small>Missão {fmt(s.missionNumber)} • {s.language}</small></div><span className="pending-tag">{s.status==='pending'?'PENDENTE':s.status}</span><ChevronRight size={17}/></button>):<div className="empty-inline">Ainda não há submissões.</div>}</div>}{activeTab==='review'&&selectedSubmission&&<div className="panel review-panel"><button className="back-link" onClick={()=>setActiveTab('submissions')}>← Submissões</button><h3>{selectedSubmission.teamName} • Missão {fmt(selectedSubmission.missionNumber)}</h3><p className="muted">Linguagem: {selectedSubmission.language}</p><pre className="code-review">{selectedSubmission.code}</pre><div className="rubric-grid">{[['solution','Código atende ao enunciado',5],['logic','Lógica e organização',2],['demonstration','Demonstração ou teste',2],['explanation','Explicação da equipe',1]].map(([key,label,max])=><label key={key}>{label}<select value={review[key]} onChange={e=>setReview({...review,[key]:Number(e.target.value)})}>{Array.from({length:max+1},(_,i)=><option key={i} value={i}>{i} / {max}</option>)}</select></label>)}</div><label>Observações<textarea rows="3" value={review.notes} onChange={e=>setReview({...review,notes:e.target.value})}/></label><div className="review-total">Total: <b>{scoreTotal}/10</b></div><button className="btn-primary" onClick={saveEvaluation} disabled={loading || selectedSubmission.status === 'evaluated'}>{loading ? 'Salvando avaliação...' : selectedSubmission.status === 'evaluated' ? 'Avaliação já concluída' : 'Confirmar avaliação'}</button><p className="security-note"><LockKeyhole size={15}/> Pontuação bloqueada no cliente: a confirmação será habilitada após implantação da Cloud Function de avaliação.</p></div>}{activeTab==='screen'&&<div className="panel big-screen"><div className="section-kicker">CODE RACE • AO VIVO</div><h2>RANKING <span>GERAL</span></h2>{ranking.length?ranking.slice(0,8).map((t,i)=><div className="screen-rank" key={t.id}><b>{fmt(i+1)}</b><strong>{t.name}</strong><span>{t.score||0} PTS</span></div>):<div className="empty-state">Aguardando pontuações confirmadas...</div>}<div className="screen-footer">SALA {room.code} • {roomStatus.toUpperCase()}</div></div>}</section>}
    </main>
    <footer><div className="footer-brand"><Code2 size={18}/> CODE<span>RACE</span></div><span>Aprender. Codificar. Competir.</span><span>© 2026 CODE RACE</span></footer>
    {notice && <div className="toast"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
  </div>;
}
