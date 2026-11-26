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

## Pending / not done (honest list)

1. **Add the API keys above.** Until then the AI features don't run, and the AI-dependent live tests (7–9, 16, 20, 22-OCR, 24) can't pass. Re-run the suite after adding them.
2. Real content: the library currently has no real books stored in Open Book. QA test files were removed. The Google import was rate-limited, and the official sources are links. The college needs to upload its own or open-licence books, and approved official past papers, through the CRM.
3. Not built:
   - flashcard offline review
   - image-occlusion (diagram-label) cards
   - formula-sheet PDF export
   - automatic posting of weekly winners to Notices, and admin-set rewards
   - tutor weak points feeding the Learning Path
   - auto-crop and deskew in the browser
   - Telugu/Hindi for full page text (menus and labels only)
   - Edge Function + pg_cron (a Vercel cron is used instead, like the rest of the project)
4. pgvector semantic duplicate search is built and migrated but inactive until `VOYAGE_API_KEY` is set.
5. Supabase Auth-level RLS per student doesn't apply: the app uses its own sessions and server-side checks, and all tables deny anonymous and authenticated access. This is the same model as the rest of BJC.
6. `supabase functions deploy` and `npm run seed:demo` were not run: there are no Edge Functions, and demo seeding is for staging only.
