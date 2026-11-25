# Open Book: architecture and mapping onto the BJC app

Open Book lives in `lib/openbook/` (domain logic), `app/app/(authed)/openbook/` (student screens in the Student & Parent app), `app/crm/(app)/openbook/` (staff console), `components/openbook/` (reader, generator, exam screen, scanner, chat) and `app/api/openbook/` (file access, notes export, large-upload signing). Public page: `/open-book`.

## Why most tables are record collections

The BJC app keeps every school module (attendance, tests, homework, practice, hostel, wellbeing…) in one `records` table: typed, zod-validated collections with two index keys, RLS on, service role only, and a JSON file store for local development. Open Book follows the same pattern so it works locally and in production without a second data layer. The only new SQL table is the one `records` cannot serve: pgvector similarity search.

The prompt assumed tables named `curricula`, `syllabus_nodes`, `questions`, `kb_files` and `kb_chunks`. These don't exist in this project: the equivalents are record collections and in-code catalogues. That is why the mapping below differs from the prompt's table.

## Section 12 tables → what was built

| Spec table | Implementation | Notes |
|---|---|---|
| educational_categories | `lib/openbook/taxonomy.ts` `CATEGORIES` | Fixed list A–D. |
| educational_boards / examinations | `taxonomy.ts` `EXAMS` (id, subjects, classes, **pattern**) | Each exam carries its real pattern (question types, marks, negative marking, duration). The generator refuses formats an exam doesn't use. |
| subjects / chapters / concepts | `taxonomy.ts` `BASE_CHAPTERS` (NCERT Class 11/12) + `ob_taxonomy` collection | Admins add subjects, chapters and concepts at runtime. The existing practice-bank chapter names are mapped with `PRACTICE_CHAPTER_ALIAS`. |
| books + book_resources | `ob_books` | Metadata, licence, `fileKey` only when the licence allows storing, Google preview/purchase links, `downloadAllowed`. |
| (page text) | `ob_book_pages` | Text per page for in-book search, the study assistant and page citations. |
| book_bookmarks | `ob_bookmarks` | Private (k1 = studentId). |
| book_notes | `ob_notes` | Highlights in 4 colours, notes, revision list. Private. |
| reading_history | `ob_reading` | Last page, pages read, seconds, favourite. |
| previous_year_papers | `ob_papers` | The original file is stored unchanged. Extraction status, method and confidence are recorded. |
| extracted_questions + question_bank + generated_questions | `ob_questions` (`origin` = extracted / generated / teacher / scan / community) | k1 = `p:<paper>`, `s:<student>` or `bank`; k2 = conceptKey. |
| question_fingerprints | `ob_fingerprints` + `fingerprint` on each question | SHA-256 of the normalised text. |
| (rejections) | `ob_rejections` | Duplicate-detection review for admins. |
| (semantic vectors) | **SQL table `ob_question_vectors` + function `ob_match_questions`** (migration `20261125154710_open_book.sql`) | pgvector (1024-d, HNSW, cosine), RLS on, service role only. Used when `VOYAGE_API_KEY` is set. |
| question_attempts | `ob_attempts` | Every mark. 4-option MCQs are also written to the existing `practice_attempts`, so the existing XP, levels, streaks and badges count Open Book work. |
| mock_tests + mock_test_questions | `ob_mocks` (ordered `questionIds`) | Personal mocks plus teacher mocks shared with a batch. |
| mock_test_attempts | `ob_mock_attempts` | Answers, review marks and time per question are saved live (resume), with automatic submission. |
| student_performance | `ob_mastery` (per concept, 0–100, spaced-repetition schedule) | Dashboards are computed live from attempts and mastery. |
| ai_agent_sessions | `ob_sessions` | Assistant, tutor, reader and scanner transcripts; the student can delete them. |
| content_uploads | `status` / `uploadedBy` / `reviewNote` on `ob_books` and `ob_papers` + `ob_audit` | Approval queues are in the CRM. |
| teacher_assignments | `ob_assignments` | Concept exercises, book recommendations and shared mocks per batch. |
| (Part B) | `ob_paths`, `ob_cards`, `ob_decks`, `ob_challenges`, `ob_challenge_attempts`, `ob_profiles`, `ob_posts`, `ob_usage`, `ob_settings` | Learning path, flashcards, daily challenge, nickname/opt-out/reputation, community, daily AI limits, AI settings. |

## Section 24 reuse map

| Open Book need | Reused / extended | How |
|---|---|---|
| Subjects, chapters, concepts | Syllabus progress (`syllabus_progress`) + practice-bank chapters | Concept level added in `taxonomy.ts` and `ob_taxonomy`. The daily challenge prefers chapters the batch has covered (syllabus progress). |
| Question bank | Practice bank (`lib/practice/bank.ts`, 310 formula-generated questions) | "Import the practice bank" copies it into `ob_questions` with tags and worked solutions. |
| Online exams | Existing batch tests stay as they are | Open Book mocks are personal (or teacher-shared to a batch), with their own exam screen (timer, palette, review, autosave). |
| OCR, extraction, storage | Knowledge Hub pipeline: `lib/kb/extract.ts` (byte-sniffing, PDF/DOCX text), `lib/kb/ocr.ts` pattern, `lib/kb/storage.ts` (private `kb-files` bucket, `openbook/` prefix, signed uploads) | Paper and book text extraction, the large-file direct upload. |
| Embeddings / pgvector | Same Voyage model as the KB (`voyage-multilingual-2`, 1024-d) | Stored in `ob_question_vectors`. |
| AI | Anthropic SDK (already a dependency) | `lib/openbook/llm.ts`: server-side calls only, structured JSON outputs (`output_config.format`) validated again with zod, prompt caching on the system prompt, typed error handling, daily limits. |
| Voice tutor | `/api/voice/tts` (Azure neural voices when configured, browser voice otherwise) + browser speech recognition | Barge-in stops playback when the student speaks or sends. |
| Wellbeing / safety | `screenText()` from `lib/studentLife/wellbeing.ts` | Assistant, tutor and community text is screened; distress raises the existing counsellor + Principal safety alert. |
| XP, streaks, houses | `practice_attempts` (XP) and `sports_houses` | Challenge attempts feed XP; house points sum challenge XP per house. |
| Doubts | `askDoubt()` | The scanner's "Send to a teacher" creates a real doubt in the existing inbox. |
| Library (physical) | Existing `/crm/library` is unchanged | Books without a stored file tell students to borrow the physical copy. |
| Auth and roles | Student & Parent app login; CRM roles | New permissions `ob.manage`, `ob.teach` and `ob.moderate` in the permission matrix (editable by the Super Admin). Parents see path progress % only. Applicants and alumni have no access. |
| Earlier open-book module | `/app/open-book` and `/crm/open-book` are unchanged | Still linked. Its permission `openbook.manage` is untouched. |

## Privacy and security

- Every private read or write checks the signed-in student's id on the server (notes, bookmarks, highlights, history, attempts, mocks, transcripts, cards, path).
- Files are served only through `/api/openbook/file`, which checks the session and each file's rules. There is no public bucket.
- The `records` and `ob_question_vectors` tables have RLS on with no anon or authenticated policies, so the browser's anon key reads nothing.
- Student uploads go to an approval queue. AI-generated bank questions need a teacher's approval before anyone else sees them.
- The community blocks phone numbers, emails, links and handles, and filters abuse. There are no private messages. A post is hidden automatically after 3 reports. Suspensions are available, and every moderation action is in `ob_audit`.

## Jobs

`/api/cron/openbook` runs on Sundays at 03:30 UTC (Vercel cron). It checks every official source link, flags moved or broken ones, and writes the result to the activity log. It runs as a Vercel cron, like every other job in this project, rather than a Supabase Edge Function with pg_cron.
