# NyayMitra

NyayMitra is an AI Legal Guidance and Case Preparation Assistant for Bharat. It helps users classify legal issues, organize proof, prepare drafts for review or Legal Aid Consultation Notes, view official action links, save cases locally, and export Legal Action Kit PDFs.

NyayMitra is a legal self-help preparation tool, not a lawyer. Please verify with legal aid/lawyer before filing.

## Getting Started

First, create `.env.local` from `.env.local.example` if AI features are needed:

```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=google/gemini-2.0-flash-001
```

Then run the development server:

```bash
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Build and QA commands:

```bash
npm.cmd run lint
npm.cmd run build
npm.cmd start
```

## Safety Boundaries

- NyayMitra does not provide legal advice.
- NyayMitra does not guarantee outcomes.
- NyayMitra does not invent legal sections.
- High-risk matters are routed to legal-aid/lawyer review.
- OpenRouter API keys must stay server-side only in `.env.local`.

## LocalStorage MVP

This MVP stores cases in browser localStorage. It does not include backend database, authentication, or payments.

## Deploy

Set these environment variables in the deployment platform:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

Do not create a public OpenRouter key variable.
