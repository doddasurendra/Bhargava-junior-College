# Open Book: build report

Live: https://bhargava-junior-college.vercel.app
- Students: Student & Parent app → **Open Book** tab (`/app/openbook`).
- Staff: CRM → **📘 Open Book** (`/crm/openbook`).
- Public page: `/open-book`, also linked from the website Platform bar.

Commits on `main`: `29cab68` (domain logic), `ee7718e` (UI), `b11a1db`, `71495e8`, `1a9a003`, `94bb49f`, `f1efb67`, `be9ebd2` (fixes found by live testing) and this report. Every push deployed to Vercel Production. The Supabase migration `20261125154710_open_book` is applied. Architecture and table mapping: `docs/open-book-architecture.md`.

## Summary in one paragraph

Everything that does not need an AI key works for real on production and was tested end to end against the live Supabase database:

- library, reader, bookmarks, highlights, notes and their export
- paper upload with text-layer question extraction, answer keys and the Pattern Analyzer
- mock tests with timer, resume, automatic submission and reports
- learning path with diagnostic, daily plan and mastery
- flashcards with SM-2 scheduling
- daily challenge and leaderboards
- the moderated community
- the scanner's save and send-to-teacher actions
- the staff console for content, approvals, sources, question bank, teaching and moderation

**The AI features are fully built but cannot run yet: no AI key is configured** in the project. The affected features are question generation, explanations, OCR of scans and handwriting, the study assistant's written answers, reader Explain/Translate, the voice tutor and AI flashcards. Each of them tells the user "AI is not configured"; nothing is faked. Adding the keys below switches them on without code changes, but they have not yet been tested against the live AI service.

## Required API keys (add in Vercel → Project → Settings → Environment Variables, Production + Preview)

| Variable | Needed for | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | Question generator, Answer & Explanation Engine, "explain simpler/advanced", subjective marking, OCR of scanned/handwritten papers and photos, study assistant answers, reader Explain/Simplify/Translate/Summary, voice tutor, AI flashcards, community "AI suggestion" | **Missing**: these features show "not configured" |
| `VOYAGE_API_KEY` | Semantic (pgvector) duplicate check: paraphrases with different wording | **Missing**: exact fingerprint + lexical similarity run meanwhile |
| `GOOGLE_BOOKS_API_KEY` | Google Books import at production volume | **Missing**: the keyless API is rate-limited on Vercel's shared servers (the live import was refused with 429) |
| `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` | Neural Telugu/Hindi/English voices for the tutor and read-aloud | Optional; the browser voice is used meanwhile |

The AI model defaults to `claude-opus-5-5` and can be changed in Open Book → AI settings, as can the daily limits (default per student per day: 60 generated questions, 80 other AI requests, 40 voice turns).

## Cost notes

- Each generation call returns up to 25 questions with full explanations.
- The system prompt is cached (prompt caching), and effort is set per task: "low" for marking, explanations and flashcards, "medium" for generation and OCR, "high" only for solving a scanned question.
- Rejected duplicates are regenerated in at most 3 extra rounds.
- Per-student daily limits cap spending. Usage is shown in Open Book → Overview.
- Nothing calls the AI without a student or teacher action.

## Completed features

| Area | What works | Notes |
|---|---|---|
| Categories A–D, exams with real patterns | Done | Phase 1 content (Inter MPC/BiPC, JEE Main/Advanced, NEET, EAPCET) has NCERT Class 11/12 chapters and concepts. Categories with no content show "Coming soon" (§25). |
| Official sources + link checker | Done | 33 official sources seeded and checked on production; weekly cron at `/api/cron/openbook`. Latest result: 24 reachable, 1 moved (SBI Careers → sbi.bank.in), 8 unreachable from Vercel's servers. Seven of those (Railways, RRB, RBI, APPSC, TG EAPCET, BIEAP, TGBIE) open from an Indian connection, so the sites appear to block cloud servers; ePathshala didn't respond from either. Three Telangana URLs that no longer existed were corrected (TGPSC, TG EAPCET, TGBIE). Admins can edit sources. |
| Google Books import | Built | **Blocked on production** by Google's keyless rate limit (needs `GOOGLE_BOOKS_API_KEY`). Copyright rules are enforced: metadata, preview and purchase links only; download only for public-domain books with a free PDF/EPUB. |
| Digital library | Done | Search (title, author, subject, publisher, ISBN), filters (category, exam, subject, year, type), pagination, Official/BJC/Reference badges, recently added, recommendations with reasons, favourites, reading history, continue reading. |
| Uploads with licence rules | Done | Only public-domain, open-licence, free-official or college-owned books can be stored; copyrighted ones are refused. Teacher uploads wait for admin approval. Large files go straight to private storage with a progress bar. |
| Smart PDF reader | Done | pdf.js page and selectable text, zoom, page jump, thumbnails, fullscreen, night/sepia, search inside the PDF, resume across devices, 4-colour highlights, notes, revision list, read-aloud (EN/TE/HI, speed), Markdown and print-to-PDF export, pages-read and time tracking. AI selection actions and the AI side panel need `ANTHROPIC_API_KEY`. |
| Previous-year papers | Done | PDF/DOCX/JPG/PNG upload. Old `.doc` files are refused with a "save as .docx" message (they can't be parsed safely). The original is kept unchanged. Text-layer question extraction, answer-key parsing and keyword tagging to chapter/concept. Student uploads go to the approval queue. Teachers can correct extracted questions. Preview, download and solutions file. **OCR of scans and handwriting needs the AI key.** |
| Pattern Analyzer | Done | Chapter × year heatmap table, weightage %, rising/falling trend, question-type and difficulty distribution, most repeated concepts, similar questions across years, high-yield list, "not asked yet" list, the data basis shown, "generate a practice test with this pattern". |
| AI question generator + uniqueness engine | Built; **needs AI key** | 17 question types, 6 difficulty levels, 5–50 or a custom count. It refuses formats the chosen exam doesn't use. Normalisation, SHA-256 fingerprints, lexical similarity, pgvector similarity (with the Voyage key), comparison with uploaded papers and the student's history, automatic regeneration, rejection log, per-question record of which checks ran. Engine verified by unit tests. |
| Answer & explanation engine | Built | Answer, explanation, steps, formulas, concepts, outcome, mistakes, related concepts, why each option is right or wrong; reveal/hide; attempt before viewing. "Explain simpler / advanced" needs the AI key. Practice-bank and past-paper questions already show their worked solutions and answers. |
| Mock tests | Done | Built from the question bank, the analysed pattern, or AI questions (AI needs the key). Timer, question palette, mark for review, autosave and resume, automatic submission at 0:00, instant objective marking with negative marking, AI rubric marking for subjective answers (needs the key; otherwise self-marking against the model answer), report with topic-wise score, time per question and improvement areas. Teachers can share a test with a batch. |
| Learning analytics | Done | Books and pages read, reading time, questions generated and attempted, mocks, accuracy, subject-wise results, strong and weak concepts, 14-day trend, recommended books and practice. |
| Learning path | Done | Exam, exam date and minutes per day; diagnostic (12 bank questions per subject); concepts ordered weakest first with reasons; target dates; mastery at ≥80% over ≥10 questions; spaced review; today's plan (book pages, questions, flashcards); roadmap per subject. Teachers adjust paths; parents see progress % only. |
| Flashcards | Done | SM-2 scheduling (Again/Hard/Good/Easy), due count on the home page, decks, quick 10 / before-exam / weak-cards modes, cards from wrong answers, manual cards, sharing with teacher approval, copying shared decks. AI cards from a concept, chapter or passage need the key. **Not done: offline review and image-occlusion cards; auto-generated formula-sheet export** (revision notes need the AI key). |
| Community | Done | College-only; nicknames; phone/email/link/handle and abuse blocked; no private messages; similar-question check; accept, upvote, teacher-verified, staff answers; report, auto-hide at 3 reports, moderation queue, hide/restore, suspend; audit log; distress screening through the existing counsellor protocol; reputation and badges. AI-suggested answers need the key. |
| Daily challenge + leaderboards | Done | Same 5 questions per subject per batch per day, open 06:00–23:00, weighted to chapters the batch has covered; streaks; XP (also written to the existing Practice XP); boards for effort, score and streak by day/week/month for the batch and the whole college; top 10 plus "your position"; opt-out; private encouragement; house points from the Sports houses. **Weekly winners announced in Notices: the list is computed (`weeklyWinners`) but not posted automatically. Admin rewards: not built.** |
| Scanner | Partial | Camera/photo upload with contrast enhancement and downscaling, stored privately and unchanged; editable text box; confidence display; reclassify subject/chapter/concept; save to my questions; flashcard; post to community; send to a teacher (existing Doubts). **OCR, step-by-step solving and "5 similar questions" need the AI key. True auto-crop and deskew are not implemented** (left to the vision model). |
| Study assistant | Partial | Answers come from Open Book book pages and cite book and page; it says when something isn't in the sources. Without the AI key it returns the matching passages with page references. Summaries, notes, mind maps and revision notes need the key. |
| Voice tutor | Built; **needs AI key** | Explain / quiz / Socratic / discuss-a-page modes; speech in (browser) and speech out (Azure or the browser), barge-in, speed; transcripts saved and deletable; refuses during a live mock; distress screening; daily limit. **Weak points found in tutor sessions are not yet added to the Learning Path.** |
| Teacher/admin controls | Done | Upload books and papers, approve or reject, remove content, edit metadata, add chapters and concepts, question bank (add, generate for review, approve AI questions), import the 310 practice-bank questions (done on production), sources, batch performance, path adjustments, concept exercises, book recommendations, shared tests, deck approvals, moderation, AI settings and limits, monitoring (generation, duplicate review, usage, activity log). |
| Permissions | Done | New `ob.manage`, `ob.teach` and `ob.moderate` in the Super Admin's permission matrix. The existing `openbook.manage` (earlier open-book assignments) is untouched. |
| Interface languages | Partial | The Open Book menu and main labels are in English, Telugu and Hindi (chosen on the Open Book home). AI answers, read-aloud and translation follow the chosen language. **Page text and forms beyond the menu are English only.** |

## Test results

### Unit / integration (Vitest, real record-store operations on the file store)

`npx vitest run`: **284 tests in 44 files, all passed.** That is 271 earlier tests plus 13 Open Book tests covering:

- fingerprints, similarity, exact and near-duplicate rejection, and the pgvector branch
- MCQ, multi-correct with partial marks, numerical tolerance and one-word marking
- community safety filters
- paper splitting and answer keys
- SM-2 and spaced review
- library upload, extraction, search, reading, bookmarks and notes, with another student blocked from them
- papers across 3 years → pattern analysis → pattern mock
- AI says "not configured"
- practice-bank import, pool mock with save/submit/report, flashcards and the learning path
- the community flow, including a staff answer and moderation

### Live end-to-end on production (`QA_RUN_OPENBOOK=1 npx playwright test tests/e2e/openbook.spec.ts`)

Final run: **15 of 15 tests passed in 5.9 minutes**. Results by spec item:

| # | Test | Result |
|---|---|---|
| 1 | Student logs in | PASS (QA student, developer test OTP) |
| 2 | Searches for a book | PASS |
| 3 | Opens and reads it | PASS (pdf.js canvas rendered, 2 pages) |
| 4 | Bookmarks a page | PASS (plus text selection → yellow highlight, shown in My Notes) |
| 5 | Uploads a previous-year paper | PASS (pending teacher approval) |
| 6 | System extracts questions | PASS (text layer: 3 questions; scans need OCR, see 22) |
| 7–9 | Selects a concept, AI generates questions, duplicate detection | **BLOCKED**: `ANTHROPIC_API_KEY` not set; the app shows the honest message. The duplicate engine is verified by unit tests. |
| 10–11 | Attempts questions, sees answers | PASS (approved past-paper question: correct +4, answer from the key; worked solutions on practice-bank questions) |
| 12–13 | Generates and completes a mock | PASS (bank-based mock; timer, palette, review marks, autosave, submit, report) |
| 14 | Dashboard updates | PASS (mock-test count increased) |
| 15 | Learning path from the diagnostic, today's plan | PASS |
| 16 | Reader Explain / Translate / AI flashcards / questions with page citations | **BLOCKED** (AI key); highlight and bookmark PASS |
| 17 | Pattern Analyzer over ≥3 papers + pattern test | PASS (12 approved papers at the time, 36 questions, 2023–2025; pattern test created after a bug fix, see below) |
| 18 | Flashcards: due cards, rating reschedules | PASS (due 23 → 22) |
| 19 | Community: post, answer, accept, teacher-verify, report → queue, phone blocked, non-BJC blocked | PASS |
| 20 | Voice tutor in Telugu with citation | **BLOCKED** (AI key) |
| 21 | Daily challenge, streak, leaderboard, opt-out hides the name | PASS |
| 22 | Scanner: photo → OCR → solution → 5 similar → doubt | **PARTIAL**: photo stored and sent as a doubt PASS; OCR, solving and similar questions BLOCKED (AI key) |
| 23 | RLS / privacy | PASS: anonymous file and notes requests return 401, and the Supabase anon key reads 0 Open Book rows. Student A vs B isolation: unit test PASS. The live suite has only one QA student account, so the A-vs-B check was not repeated live. |
| 24 | No duplicates on a second generation run | **BLOCKED live** (AI key); engine PASS in unit tests |
| 25 | `npm run build` with 0 errors, 390 px phone width | PASS (build OK; no horizontal overflow on 10 Open Book screens at 390 px) |
| setup | Practice-bank import (310 questions now in the production bank), 33 official sources and link check, book upload with text extraction, Google Books import | PASS except Google Books (**BLOCKED**, 429 rate limit without a key) |

**Bugs found and fixed by the live runs:**
1. A pattern test picked no questions: the owner filter excluded shared questions.
2. Staff with long role names couldn't answer in the community: the display name exceeded the length limit.
3. Three outdated Telangana official URLs.
4. The link checker now tells dead domains, broken certificate chains and servers that block cloud requests apart.

QA data created by the test runs was removed or hidden (books removed, papers rejected, community posts hidden; nothing deleted).

## Second round (26 Nov): the previously pending items, now built

Commit `4153eff`. All of these were deployed and checked on production.

| Item | What was built | Evidence |
|---|---|---|
| Offline flashcard review | The flashcards page saves the next 14 days of text cards on the phone and registers the offline service worker (`/kb-sw.js`, now covering `/app/openbook/flashcards`). `/app/cards-offline` reviews them with the same SM-2 rules (`lib/openbook/sm2.ts`, shared by server and phone) and queues ratings. `/api/openbook/cards/sync` applies them in order when the phone is back online, and only to the signed-in student's own cards. | Unit test; live E2E (cards saved message, offline page served) |
| Image-occlusion (diagram-label) cards | Upload a diagram, drag boxes over the labels and type each answer. One card per box: the front hides every label and highlights the one asked; the back reveals it. The image is private (`k=card`, owner only). Copied shared decks keep working. | Unit test; live E2E (draw box → 1 card) |
| Chapter formula sheets and revision notes, exported to PDF | `/app/openbook/revision`: key concepts, formulas taken from explanations and worked solutions (general formulas only, not numeric results), the student's formula and definition cards, weak concepts, the revision list, and optional AI revision notes. Print-ready view; "Save as PDF". | Unit test; live E2E (Maths chapter shows −b/a) |
| Weekly winners posted to Notices, with admin rewards | Every Sunday (Vercel cron), or on demand from AI settings: top 3 per batch by challenge XP for the past 7 days, opted-out students excluded, posted to the existing Notices module for that batch with the admin-set reward text and optional bonus XP. Posts once per week per batch. | Unit test (notice text, reward, opt-out, once per week); live E2E (button runs). On production nothing was posted yet, correctly: no batch has completed challenge days in the previous 7-day window |
| Voice-tutor weak points into the Learning Path | In tutor modes the AI also reports concepts the student struggled with. They are matched to the syllabus and the concept moves to "in progress" in the path, with the reason "Voice tutor (date): …", and the student is told. | Unit test (path update). The AI step needs `ANTHROPIC_API_KEY` |
| Scanner auto-crop and deskew | `lib/openbook/imagefix.ts`: Otsu ink threshold, auto-crop to the ink, projection-profile deskew (±15°). The browser crops, straightens and enhances the photo before upload, and tells the student what it did. | Unit tests on synthetic tilted pages (+6° and −4° detected) |
| Telugu and Hindi for full page text | Every Open Book student page heading and description, and the buttons and messages of the generator, question cards, quizzes, mock test screen and builder, flashcards and scanner, follow the student's language choice. | Live E2E (Telugu heading and button) |
| Supabase Edge Function + pg_cron | `supabase/functions/openbook-link-check` is deployed. pg_cron job `openbook-link-check` runs Sundays 03:00 UTC through pg_net, with a secret kept in Supabase Vault (migration `20261126164609`). The function refuses calls without the secret, and keeps the app checker's verified "certificate chain incomplete" result for sites like NCERT that Deno can't verify. | Live: unauthenticated call → 401; the pg_cron-style call → HTTP 200 `{"checked":33}` and an audit entry |
| Real library content | "Add the official NCERT and OpenStax catalogue": the 13 NCERT Class 11/12 Physics, Chemistry, Mathematics and Biology textbooks (official, linked to ncert.nic.in, not re-hosted) and 6 OpenStax CC BY textbooks (Physics, Chemistry, Biology, Calculus 1 and 2, Precalculus), tagged to exams, subjects and chapters. | Live E2E (NCERT Physics Part I opens, Official page link) |

Unit tests after this round: **287 passed in 45 files**. Live E2E after this round: **16 of 16 passed** (	ests/e2e/openbook.spec.ts, 6.7 min), including the new test for the catalogue, formula sheet, diagram cards, offline review, the Telugu interface and the winners trigger. The live run also found and fixed one more bug: a diagram box drawn with a quick release was lost.

## Third round (27 Nov): removing the remaining blockers

Commits `c9b4a7e` … `dcef4d1` on `main`, each deployed to Vercel Production.

### API keys: configured and verified?

Checked with `vercel env ls production` on 27 Nov. Only names were printed, never values.

| Key | In Vercel? | Result |
|---|---|---|
| `ANTHROPIC_API_KEY` | **No** | AI generation, explanations, OCR of scans, tutor and assistant cannot run. All code paths are built, validated with zod and show "AI is not configured" when the key is missing. **Not tested against the live AI service.** |
| `GOOGLE_BOOKS_API_KEY` | **No** | Search runs without a key, but Google refuses keyless requests (HTTP 429). The screen shows that message. |
| `VOYAGE_API_KEY` | **No** | Semantic duplicate check is off. The exact fingerprint and lexical similarity checks run instead (the fallback). |

No key is hard-coded anywhere. All three are read only on the server (`lib/openbook/llm.ts`, `lib/openbook/library.ts`, `lib/openbook/vectors.ts`), and none of them appears in browser code.

**Administrator setup (exact steps):**

1. **Anthropic.**
   - Go to console.anthropic.com → API keys → Create key.
   - Then Vercel → project `bhargava-junior-college` → Settings → Environment Variables → add `ANTHROPIC_API_KEY`, for the Production and Preview environments.
   - Optionally set a monthly spend limit in the Anthropic console.
2. **Google Books.**
   - Go to console.cloud.google.com → create or choose a project → APIs & Services → Library → enable **Books API**.
   - Then Credentials → Create credentials → API key.
   - Restrict the key to the Books API, and add it in Vercel as `GOOGLE_BOOKS_API_KEY`.
3. **Voyage AI.**
   - Go to dash.voyageai.com → API keys → create a key.
   - Add it in Vercel as `VOYAGE_API_KEY`.
   - The pgvector table and the `ob_match_questions` function are already migrated.
4. **Redeploy** (Vercel → Deployments → Redeploy) so the new variables take effect.
5. **Re-run the live tests:** `QA_RUN_OPENBOOK=1 npx playwright test tests/e2e/openbook.spec.ts`. Tests 7–9, 16, 20, 22 (OCR) and 24 then exercise the real AI service.

### Task by task

| Task | Status | What was done / what is missing |
|---|---|---|
| 1. Anthropic AI | **Built, blocked by the missing key** | Generation, explanations, scanned-paper OCR (Claude vision), tutor and assistant are implemented with loading states, schema validation of every AI answer, daily limits and clear errors. Nothing is simulated. |
| 2. Google Books | **Built; live search blocked by the missing key** | New search in CRM → Open Book → Books: search by **title, author, subject or ISBN** (Google's `intitle:` / `inauthor:` / `subject:` / `isbn:`), with cover, authors, publisher, year, ISBN, description, licence, preview level, **Preview** and **Publisher/buy** links, and "Already in the library". **Add to library** comes with category, subjects, year, language, type and exams. Quota (429), key (400/403) and network errors each show a specific message. Copyrighted books are added as details and links only. |
| 3. Duplicate detection | **Built; semantic layer waits for the key** | Exact fingerprint + lexical similarity (word-bag cosine and character trigrams) run today against the whole bank, across subjects, chapters and extracted previous-paper questions. AI-generated near-repeats are rejected, logged and regenerated. With `VOYAGE_API_KEY`, pgvector embeddings add a check for reworded questions. Without it the lexical checks are the fallback. |
| 4. Library & previous papers | **Done and tested live** | CRM upload of books and documents (PDF, Word .docx, PowerPoint .pptx) and of papers (PDF, Word, JPG/PNG, scans) for Intermediate, JEE, NEET, IIT and other exams. Files go to the private Supabase bucket `kb-files`; metadata goes to Supabase (`records`). New fields: **language, academic year, document type** (textbook, reference, notes, question bank, lab manual, syllabus). Library screen: search plus filters (category, type, language, academic year, status), pagination, **Preview, Download, Student view, Edit details, Remove**. Word/PowerPoint documents open as page-by-page text for students. Permissions: teachers upload and wait for approval; managers approve, edit and remove; students see approved items only and download only when the licence allows; staff may always download college documents; signed-out requests get 401. |
| 5. Telugu & Hindi for the staff CRM | **Done (see coverage below)** | |
| 6. Security & deployment | **Checked** | See below. |
| 7. Testing | **Done for everything that doesn't need a key** | See below. |

### Localization coverage (staff CRM)

How it works:

- One dictionary, `lib/crm-i18n` (rows of English, Telugu, Hindi), with a browser translator, `components/crm/CrmTranslator.tsx`.
- It translates every CRM page, the sign-in pages, menus, tables, buttons, form labels, placeholders, tooltips, validation and server messages, notifications and browser confirm/alert dialogs. Text that appears later (results of actions, lists that load) is translated too.
- English text is the key, so database columns, values, IDs, URLs and code are never changed.
- Messages with numbers or names use `{x}` patterns, for example "Waiting for approval (3)".
- Knowledge Hub centre names and topics reuse their existing Telugu/Hindi. Knowledge Hub article titles that have a Telugu/Hindi version are added for signed-in staff only, through `/api/crm-i18n/<lang>/content`, limited to articles that person may read.
- Language menu at the top of every CRM page. It uses the site's existing `bjc_lang` cookie, so the choice stays across pages and sessions.
- Unicode fonts: Noto Sans Telugu and Noto Sans Devanagari.

Coverage, measured:

- **Source strings:** `node scripts/i18n-extract.mjs` then `npx vite-node scripts/i18n-coverage.ts`. **2,201 of 2,208 CRM UI strings (99.7%)** are translated in both Telugu and Hindi.
- **Kept in English on purpose:**
  - the three printable official certificates (Bonafide, Study/Conduct, Transfer); they are legal documents;
  - brand names such as WhatsApp;
  - 155 non-UI strings: CSS class names, log tags and sample names.
- **Live audit on production** (`tests/e2e/crm-language.spec.ts`): opens every menu page of 7 role/language combinations and fails if any phrase the dictionary knows is still shown in English.

| Role · language | Pages | Visible text items in Telugu/Hindi | Dictionary phrases still in English |
|---|---|---|---|
| Super Admin · Telugu | 63 | 11,161 / 17,203 | none |
| Super Admin · Hindi | 63 | 11,161 / 17,204 | none |
| Principal · Telugu | 48 | 6,804 / 11,611 | none |
| Accounts · Hindi | 26 | 2,748 / 4,240 | none |
| Telecaller · Telugu | 21 | 1,726 / 2,582 | none |
| Faculty · Hindi | 28 | 3,020 / 5,135 | none |
| Hostel Warden · Telugu | 24 | 2,462 / 3,906 | none |

What the remaining English is (from the audit's list of untranslated visible text):

- data that should not be translated: people's names (including the QA accounts), device names, IDs, numbers and audit action IDs such as `paper.reject`;
- **Knowledge Hub articles the college wrote in English only.** The Knowledge Hub editor already has Telugu and Hindi fields, so the college should add those versions;
- a few chapter names, which Indian syllabi print in English.

The Telugu and Hindi were written for this project and **have not been reviewed by a native speaker yet.** That review is recommended before relying on them for official communication.

### Database and storage status

- Supabase project `nkhpahcmldfuwydeglml`. **RLS is enabled on all 35 public tables**, and none allows anonymous or signed-in database access. The app reads and writes only on the server with the service role, after its own session and permission checks.
- Storage buckets `kb-files` (50 MB limit) and `applicant-docs` (5 MB limit) are both **private**. Files are served only through `/api/openbook/file`, which checks the session, role, approval status and licence. A signed-out request returned **401** in the live test.
- New metadata fields are optional and default to empty, so existing records stay valid. No migration was needed, and nothing was deleted or overwritten.
- Supabase security advisors (27 Nov), all items that already existed:
  - "RLS enabled, no policy" on 10 tables. This is the intended deny-all model.
  - `pg_net` installed in the public schema. It is used by the link-check cron.
  - `has_any_role` is callable by signed-in users. It is a role-check helper that only answers about the caller's own roles.
  - Leaked-password protection is off. To turn it on: Supabase → Authentication → Settings.

### Testing results (27 Nov)

- **Unit tests:** 293 passed in 46 files. New: the dictionary-integrity test (every row has Telugu/Devanagari script, matching `{x}` markers, no conflicting duplicates) and the translation-engine test.
- **Live, `tests/e2e/crm-language.spec.ts`:** 9 of 9 passed on production.
  - Every menu page for super admin, principal, accounts, telecaller, faculty and hostel warden, in Telugu and Hindi, with the language kept while navigating.
  - Switching back to English.
  - **Library:** upload a PDF with language, academic year and type → filter by all three → preview (inline PDF) → download (attachment) → signed-out request refused (401) → edit details → remove.
  - The first full run was interrupted when this computer went to sleep (network suspended). The six affected tests were re-run and passed.
- **Fixes found by live testing:**
  - the language menu's own label;
  - chart labels drawn in SVG were not translated;
  - the edit panel closed when an edit moved the book out of the current filter.
- **Live, `tests/e2e/openbook.spec.ts` (regression):** 16 of 16 passed on production in 5.4 minutes. Its QA data was removed or hidden afterwards. In that run:
  - the new Google Books search was exercised and recorded as **BLOCKED**: "Google Books refused the request (rate limit for requests without a key)";
  - AI steps were recorded as **BLOCKED** (`ANTHROPIC_API_KEY` not set).
- **Not testable without keys:** AI generation, explanations, OCR, tutor and assistant, a live Google Books search and semantic duplicates.

### Deployment

- Vercel Production auto-deploys from `main`. The latest deployment is Ready.
- One deployment failed and was fixed: `next/font` could not load Noto Sans Telugu. The fonts now load from a stylesheet instead. The previous deployment stayed live throughout, so users saw no break.
- Locally, `tsc` is clean and the unit tests pass. `next build` couldn't run locally because this computer couldn't reach Google Fonts (`ECONNRESET`); Vercel's build succeeds.

### Remaining actions that need an administrator

1. Add `ANTHROPIC_API_KEY`, `GOOGLE_BOOKS_API_KEY` and `VOYAGE_API_KEY` (steps above), redeploy, and re-run the Open Book live tests.
2. Upload the college's own documents through CRM → Open Book: textbooks and notes it owns, lab manuals and syllabi under Books; approved official previous-year papers under Papers. Missing today:
   - TS Intermediate (TSBIE) previous papers, 1st and 2nd year, for each subject;
   - JEE Main and Advanced papers;
   - NEET papers;
   - the college's own notes and question banks.
   No book file is stored yet. The NCERT and OpenStax catalogue is linked.
3. Ask a native Telugu and a native Hindi speaker to review the staff CRM wording in `lib/crm-i18n/dict/*.ts`, and add Telugu/Hindi versions of Knowledge Hub articles in the Knowledge Hub editor.
4. Optional: turn on Supabase leaked-password protection.

## Still pending (honest list)

1. **Add the API keys above.** Until then the AI features don't run, and the AI-dependent live tests (7–9, 16, 20, 22-OCR, 24) can't pass. Re-run the suite after adding them.
2. **Google Books import:** keyless requests are refused (HTTP 429) both from Vercel and from the developer's computer, so `GOOGLE_BOOKS_API_KEY` is required.
3. **The college's own books and past papers:** the official NCERT/OpenStax catalogue is linked, but no book file is stored yet. The college should upload the books it owns (or open-licence PDFs) and the official past papers through the CRM.
4. **Telugu/Hindi:** done for the staff CRM in the third round (above). Still to do: a review by native speakers, and Telugu/Hindi versions of the Knowledge Hub articles the college wrote in English.
5. pgvector semantic duplicate search is built and migrated but inactive until `VOYAGE_API_KEY` is set.
6. Supabase Auth-level RLS per student doesn't apply: the app uses its own sessions and server-side checks, and all tables deny anonymous and authenticated access. This is the same model as the rest of BJC.
7. `npm run seed:demo` was not run: it is for staging only.
