# CODE RACE — Gincana de Informática

Aplicação React + Vite com interface responsiva, Monaco Editor, autenticação Firebase, salas, equipes, listeners de ranking/submissões e painel de organização. A integração real depende de configurar um projeto Firebase e publicar as regras e Cloud Functions.

## Requisitos
- Node.js 20+
- Projeto Firebase com Authentication (E-mail/Senha) e Cloud Firestore
- Firebase CLI (`npm i -g firebase-tools`) para publicar regras e Functions

## Instalação
```bash
npm install
cp .env.example .env
# Preencha as variáveis VITE_FIREBASE_* com as credenciais do seu projeto Firebase
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`.

## Firebase
1. Crie um projeto no Firebase Console.
2. Ative Authentication > E-mail/senha.
3. Crie o banco Cloud Firestore.
4. Copie as credenciais do app Web para `.env`.
5. Faça login na aplicação, crie a competição e convide equipes pelo código.
6. Publique as regras: `firebase deploy --only firestore:rules`.
7. Publique a função de avaliação: `cd functions && npm install`, depois `firebase deploy --only functions`.

**Atenção:** a tela de avaliação já apresenta os critérios, mas a chamada da Cloud Function ainda precisa ser conectada ao botão de confirmação antes de operar com pontuação real. Não habilite a gincana oficial antes de concluir essa ligação e validar as regras no emulador Firebase.

## Missões oficiais
O documento de especificação recebido define as 20 missões como requisito, mas não traz os enunciados dos cartões. Para não inventar conteúdo, o sistema começa com 20 posições não configuradas. No painel do organizador > Missões, importe um JSON com exatamente 20 objetos:
```json
[
  {"number":1,"title":"Título original","statement":"Enunciado integral do cartão","suggestedMinutes":10,"languages":["JavaScript","Python"]}
]
```
O exemplo acima ilustra somente o formato; para a competição, use os 20 cartões oficiais. A importação atual é mantida na sessão do navegador; para uso definitivo, persista a coleção de missões no Firestore e carregue-a por partida.

## Rotas/telas incluídas
- Início, criar competição, entrar em sala e autenticação
- Guia de regras
- Área da equipe com checkpoints, Monaco Editor e envio
- Ranking por listener Firestore
- Painel do organizador: equipes, missões, submissões, avaliação e modo telão

## Antes de produção — itens obrigatórios
- Conectar o botão de avaliação à callable `evaluateSubmission` (Cloud Functions) e tratar idempotência/revisões de nota.
- Persistir missões por partida no Firestore e publicar apenas enunciado/linguagens aos participantes; gabaritos em coleção restrita.
- Implementar início/pausa/retomada com timestamp de servidor e cronômetro autoritativo.
- Ajustar as regras para leitura de equipes/submissões conforme a política de privacidade da escola e testar com Firebase Emulator Suite.
- Criar fluxo seguro de convite/entrada para evitar que qualquer usuário autenticado assuma o código de outra equipe.
- Adicionar testes automatizados (regras, callable, concorrência, empate, reconexão) e monitoramento.

## Build
```bash
npm run build
```
A pasta `dist` será gerada para publicação na Vercel (Framework Preset: Vite, Build Command: `npm run build`, Output Directory: `dist`). Configure as mesmas variáveis `VITE_FIREBASE_*` nas Environment Variables da Vercel.
