# NyayMitra

**NyayMitra** is an AI Legal Guidance and Case Preparation Assistant for Bharat. It helps users classify legal issues, organize proof, prepare drafts for review or Legal Aid Consultation Notes, view official action links, save cases locally, and export Legal Action Kit PDFs.

**NyayMitra is a legal self-help preparation tool, not a lawyer. Please verify with legal aid/lawyer before filing.**

## Features

### Core Preparation Features
- **Guided Complaint Intake** — Step-by-step wizard (7 steps) or full form mode; voice read-aloud for each step
- **25+ Case Types** — Cyber fraud, consumer complaints, salary disputes, property/land disputes, RTI delays, domestic violence, bail/criminal defense, consumer disputes, employment issues, medical negligence, loan/debt recovery, online abuse, neighbor disputes, police complaints, contract disputes, government documents, and more
- **Case-Type Adaptive UI** — Dynamic proof checklists, relief options, and risk routing per case type
- **Smart Evidence Organizer** — Annexure index mapping proofs to uploaded files with "what it helps prove" and "action needed" columns
- **Timeline Builder** — Auto-generates chronological event sequence from user story + incident date
- **Follow-up Questions** — AI-generated + rule-based case-type specific questions to fill gaps
- **Draft Generation** — Three output modes:
  - **Full Preparation Kit** — Structured complaint/application draft
  - **Limited Guidance Kit** — Representation draft for review
  - **Urgent Legal Aid Route** — Legal Aid Consultation Note (no legal strategy)
- **Editable Draft** — Review, edit, copy to clipboard before export
- **Legal Action Kit PDF** — Comprehensive PDF (jsPDF) with case snapshot, timeline, evidence index, missing proofs, AI analysis, quality score, official portal links, draft, hearing prep checklist, and legal aid routing
- **Case Quality Score (0–100)** — Heuristic scoring with actionable preparation suggestions
- **Risk & Safety Router** — Auto-routes high-risk case types (domestic violence, property disputes, family matters, bail/criminal) and urgent safety signals (immediate danger, arrest, eviction threat) to urgent legal-aid route
- **Official Portal Links** — Verified links to Cyber Crime Portal, 112 Emergency, Consumer Helpline, RTI Online, NALSA Legal Aid, State Police portals (with last-checked dates)
- **Verified Knowledge Base** — Curated legal/procedure snippets with source URLs and last-checked dates
- **Other / Not Sure Flow** — Describe your problem freely; AI classifies case type and routes to right checklist
- **Case Type Alias Search & Mismatch Detection** — Search by synonyms; detects when story contradicts selected case type
- **Draft Completeness Score** — Separate metric checking all required fields are filled before export
- **Knowledge Base: Dual-Tab UI** — Legal Knowledge + Official Portals tabs with case-type filter
- **Dashboard** — 6 stat cards, 7 filters, cross-field search, inline status updates, per-case JSON export
- **Edit Saved Cases** — `?edit=true` loads case back into intake wizard for modifications
- **Draft Language Selector** — Per-case English / Hindi / Hinglish selection
- **Start Fresh Case Button** — One-click reset to new intake

### AI Features (OpenRouter)
- **Case Classification** — Suggests case type, confidence, risk level, output mode, suggested proofs/reliefs, missing details, next steps
- **Fact Extraction** — Case summary, timeline, parties, evidence mentioned, missing details
- **Follow-up Generation** — Context-aware clarifying questions
- **Draft Improvement** — AI-refined complaint/consultation note
- **Case Review** — Quality score, strengths, weaknesses, missing proof, suggestions, verified sources
- **Advisor Chat** — Conversational Q&A with next steps, missing info, risk note, lawyer review flag, verified sources
- **Hallucination Risk Detection** — Flags AI legal citations (Section, IPC, BNS, BNSS, BSA, Act) without verified source mapping

### Multilingual Support
- English, Hindi (Devanagari), Hinglish (Romanized Hindi)
- Per-case draft language selection (English/Hindi/Hinglish)
- Persisted in localStorage

### Data Persistence (Local-First MVP)
- LocalStorage only — no backend, auth, or payments
- Draft auto-save / resume
- Dashboard with saved cases (search, filter by output mode/risk, status updates, edit, delete, export JSON)
- Case data export/import as JSON (includes official portal suggestions)

### Safety & Compliance
- **No legal advice** — Clear disclaimers on every page and in PDF
- **No outcome guarantees** — Explicit in UI and exports
- **No invented law sections** — AI instructed to cite only verified sources
- **High-risk routing** — Urgent legal-aid route for sensitive matters
- **API keys server-side only** — OpenRouter key in `.env.local`, never exposed to client
- **LocalStorage only** — No backend, auth, or cloud sync
- **Hallucination detection** — Flags AI legal citations without verified source mapping

## Tech Stack
- **Next.js 16** (App Router, React 19)
- **TypeScript** (strict) + `src/types/` for shared types
- **Tailwind CSS v4**
- **jsPDF** for PDF generation
- **OpenRouter** (configurable via `OPENROUTER_MODEL`) via serverless API route
- **ESLint 9** (Next.js config)

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Environment Setup
Create `.env.local` with (if AI features needed):

```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=your_preferred_model
```

> Do not create a public `NEXT_PUBLIC_OPENROUTER_API_KEY`. The API route keeps the key server-side.

### Install & Run
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build & QA
```bash
npm run lint
npm run build
npm start
```

### Visual Regression Testing (Playwright)
```bash
# Run baseline tests (captures screenshots to tests/screenshots/)
npm run test

# Update baseline screenshots after intentional UI changes
npm run test:update
```

Test fixtures (4 cases): garbage string, cyber fraud, domestic violence, property dispute

## Project Structure
```
src/
├── app/
│   ├── (main)/
│   │   ├── page.tsx              # Landing page
│   │   ├── intake/page.tsx       # Complaint intake (wizard + full mode)
│   │   ├── dashboard/page.tsx    # Saved cases dashboard
│   │   ├── knowledge-base/page.tsx  # Verified legal knowledge + official portals
│   │   └── layout.tsx
│   ├── legal-kit/page.tsx        # Legal Action Kit preview + PDF export
│   ├── api/ai/case-assistant/route.ts  # OpenRouter proxy (server-side)
│   ├── layout.tsx                # Root layout, fonts, metadata
│   └── globals.css               # Tailwind + custom CSS
├── components/
│   ├── site-shell.tsx            # Layout shell + nav + language switcher
│   ├── section-heading.tsx
│   └── language-switcher.tsx
├── data/
│   ├── officialPortals.ts        # 10 verified official portals
│   └── legalKnowledgeBase.ts     # 9 curated legal knowledge entries
├── lib/
│   ├── aiClient.ts               # Typed AI functions (classify, extract, followups, draft, review, advisor)
│   ├── caseConfig.ts             # 25 case types with proofs, reliefs, output modes, risk messages
│   ├── caseUtils.ts              # Helpers: missing proofs, evidence rows, timeline, amount mismatch, source notes, hallucination check, next steps, followups, legal routes
│   ├── draftTemplates.ts         # generateComplaintDraft() — 3 output modes
│   ├── i18n.ts                   # i18n (en/hi/hinglish) + translations
│   ├── legalKnowledge.ts         # Case-type filtered knowledge context builder
│   ├── officialPortals.ts        # Portal matcher + action suggestions builder
│   └── qualityScore.ts           # calculateCaseQualityScore() — case-type-aware scoring
└── types/
    └── case.ts                   # Shared TypeScript types (CaseData, FormData, AiClassification, etc.)
```

## Key Files to Understand
- `src/lib/caseConfig.ts` — All case types, proofs, reliefs, output modes, risk routing
- `src/lib/aiClient.ts` — Typed OpenRouter calls with Zod-like validation, error handling, fallback
- `src/lib/caseUtils.ts` — Shared helpers: missing proofs, evidence rows, timeline, amount mismatch, hallucination check, next steps, legal routes
- `src/lib/draftTemplates.ts` — `generateComplaintDraft()` for all three output modes
- `src/lib/qualityScore.ts` — `calculateCaseQualityScore()` with case-type-specific branches
- `src/app/(main)/intake/page.tsx` — Core intake logic (1000+ lines): form, validation, AI actions, guided mode, draft generation, alias search, mismatch detection, edit mode
- `src/app/legal-kit/page.tsx` — Preview, PDF generation, quality scoring, verified sources, official links, output-mode-specific titles
- `src/app/(main)/dashboard/page.tsx` — Case management, search/filter, stats, export, inline status
- `src/data/officialPortals.ts` — Verified portal list with metadata
- `src/data/legalKnowledgeBase.ts` — Curated knowledge snippets
- `src/lib/i18n.ts` — Full translation dictionary (EN/HI/Hinglish)
- `src/types/case.ts` — All shared TypeScript types

## Output Modes (Risk Routing)
| Mode | Trigger | Output |
|------|---------|--------|
| `full-preparation-kit` | Standard cases | Full complaint draft + evidence index |
| `limited-guidance-kit` | Sensitive but not urgent | Representation draft for review |
| `urgent-legal-aid-route` | High-risk case types OR urgent safety keywords in story | Legal Aid Consultation Note + safety checklist + urgent next steps |

**High-risk case types:** Domestic Violence, Property/Land Dispute, Divorce/Custody, Bail/Arrest/Criminal Defence

**Urgent safety keywords:** immediate danger, arrest, detention, custody, eviction threat, court deadline, suicide, self-harm, serious criminal, serious violence, threat to safety, violence

## Safety Boundaries (Non-Negotiable)
- ❌ No legal advice
- ❌ No outcome guarantees
- ❌ No invented law sections (IPC/BNS/BNSS/BSA/Act citations without verified source)
- ✅ High-risk → urgent legal-aid route only
- ✅ OpenRouter API key server-side only
- ✅ LocalStorage only — no cloud sync

## Deployment
Set these environment variables in your deployment platform (Vercel, Netlify, etc.):
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional)

**Never** create a `NEXT_PUBLIC_OPENROUTER_API_KEY`.

## LocalStorage Keys
| Key | Purpose |
|-----|---------|
| `nyaymitra_intake_draft` | In-progress intake form draft |
| `nyaymitra_case_data` | Current case for Legal Kit |
| `nyaymitra_saved_cases` | Dashboard case array |
| `nyaymitra_edit_case` | Case being edited (intake?edit=true) |
| `nyaymitra_language` | User language preference (en/hi/hinglish) |

## Contributing
This is a self-help preparation MVP. PRs welcome for:
- Additional verified official portals
- Curated legal knowledge entries (with source URLs)
- Case type configurations
- Translation improvements (Hindi/Hinglish)
- Accessibility enhancements

## License
MIT — but remember: this is not legal advice. Consult a lawyer.