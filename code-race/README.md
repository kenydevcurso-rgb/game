# CODE RACE — Gincana de Informática

Aplicação web responsiva para competição de programação em equipes. Stack: React + Vite, Firebase Authentication, Cloud Firestore, Cloud Functions e Monaco Editor.

## O que foi atualizado nesta versão

- Projeto Firebase padrão configurado para `game-3ce00` (as credenciais do app Web continuam em variáveis de ambiente).
- Importação das 20 missões salva no Firestore, para que organizador e equipes vejam a mesma configuração em tempo real.
- Participantes consultam apenas as próprias submissões; o organizador acompanha as submissões da sala.
- Entrada em sala verifica se o código existe e se a competição não foi encerrada.
- Avaliação conectada à callable Cloud Function `evaluateSubmission`.
- Pontuação, progresso da equipe, avaliação e auditoria são gravados em uma transação no servidor.
- Regras Firestore atualizadas para restringir operações administrativas e impedir gravação de pontuação pelo navegador.

> Os enunciados originais dos 20 cartões não estavam no documento de requisitos. O projeto mantém 20 posições vazias; importe os cartões oficiais. Não há desafios fictícios incluídos.

## Requisitos

- Node.js 20 ou superior
- npm
- Projeto Firebase `game-3ce00`
- Firebase CLI: `npm install -g firebase-tools`

## 1. Configurar o Firebase

No [Firebase Console — game-3ce00](https://console.firebase.google.com/project/game-3ce00/overview):

1. Em **Authentication > Sign-in method**, habilite **E-mail/senha**.
2. Em **Firestore Database**, crie o banco de dados.
3. Em **Configurações do projeto > Geral > Seus aplicativos**, registre um aplicativo Web (ícone `</>`) e copie a configuração do SDK.
4. Na raiz do projeto, crie `.env` copiando `.env.example` e preencha os valores do app Web:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=game-3ce00
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

A configuração Web do Firebase é destinada ao cliente. A segurança dos dados depende das regras do Firestore e da autorização no servidor. Nunca coloque chaves privadas ou arquivos de conta de serviço no projeto.

## 2. Executar localmente

Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
# Edite .env e preencha as credenciais do app Web
npm run dev
```

Abra o endereço local informado pelo Vite (normalmente `http://localhost:5173`).

## 3. Publicar as regras e a função no Firebase

Faça login na CLI:

```bash
firebase login
firebase use game-3ce00
firebase deploy --only firestore:rules
cd functions
npm install
cd ..
firebase deploy --only functions
```

A função `evaluateSubmission` usa a região padrão `us-central1`. O cliente também chama essa região padrão.

## 4. Publicar no GitHub

Na pasta raiz do projeto:

```bash
git init
git add .
git commit -m "Atualiza integração Firebase do CODE RACE"
git branch -M main
git remote add origin https://github.com/kenydevcurso-rgb/game.git
git push -u origin main
```

Se o repositório já tiver arquivos/commits, faça `git pull --rebase origin main` antes do push e resolva eventuais conflitos. Não force push sem revisar o conteúdo remoto.

## 5. Configurar a Vercel

Importe o repositório `kenydevcurso-rgb/game` na Vercel ou conecte o projeto existente. Use:

- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Em **Project Settings > Environment Variables**, cadastre as seis variáveis `VITE_FIREBASE_*` listadas acima para Production, Preview e Development conforme necessário. Depois faça um novo deploy.

Não envie o arquivo `.env` ao GitHub. Ele já está listado no `.gitignore`.

## 6. Fluxo de uso

1. Crie uma conta com e-mail e senha.
2. Entre e crie uma competição; a conta criadora recebe o papel de organizador.
3. Compartilhe o código de seis caracteres com as equipes.
4. As equipes criam uma conta e entram com o código.
5. O organizador importa um JSON com exatamente 20 missões.
6. As missões são salvas no Firestore e sincronizadas para os participantes.
7. As equipes enviam o código e a explicação.
8. O organizador avalia pelos critérios: solução (0–5), lógica/organização (0–2), demonstração/teste (0–2) e explicação (0–1).
9. A Cloud Function grava a avaliação e atualiza o ranking.

### Formato de importação das missões

```json
[
  {
    "number": 1,
    "title": "Título original",
    "statement": "Enunciado integral do cartão",
    "suggestedMinutes": 10,
    "languages": ["JavaScript", "Python"]
  }
]
```

O exemplo ilustra o formato, não é um desafio oficial. O JSON real precisa conter 20 missões numeradas de 1 a 20.

## Limitações que ainda exigem validação antes de uma competição oficial

- Não há importação automática dos cartões originais: o organizador precisa fornecer o JSON oficial.
- O cronômetro autoritativo com início, pausa e retomada no servidor ainda precisa ser implementado.
- O fluxo de convite usa código de sala e autenticação; não há sistema de convites individuais nem limite configurável de equipes.
- O projeto precisa ser testado com Firebase Emulator Suite, incluindo regras, concorrência, reconexão e empate.
- O ranking é ordenado por pontuação; regras de desempate oficiais ainda precisam ser definidas.
- A tela de telão e a interface devem ser validadas em dispositivos reais.

## Build local

```bash
npm run build
```

O Vite gera os arquivos de publicação na pasta `dist`.
