# Curriculum v1.2 (ages 5-7, vocabulary assumed, acquisition-first)

The child already knows enough English words. The job is proper teaching: build sentences, extend them, and grow toward narration and real conversation. Language is absorbed through use and conversation, never through grammar instruction.

## Teaching model (the learning mode's mandated behavior)

Each concept moves through a quiet three-step cycle:

1. Model: tutor gives clear, natural examples in context.
2. Guide: tutor and child complete examples together, tutor carrying most of the load.
3. Produce: child generates instances independently.

Move up the cycle only after out-loud production by the child. Correction is recast only. Introduce at most one new sentence pattern or two or three words per turn. Session ceiling: two new elements plus review.

## L1 — From Words to Sentences

Turn a vocabulary base into correct, complete spoken sentences.

- Sentence patterns: subject plus verb statements; I can ___, This is ___, I like ___, I am ___.
- Absorbed concepts (never taught as rules): singular and plural of familiar nouns; a and an; high-frequency agreement (is/are, has/have).
- Phonics: letter-sound review, CVC blending and reading of already-known spoken words.
- Interest-driven expansion: patterns rebuilt around the child's own interests.

Exit: produces three pattern families independently; reads 10 CVC words aloud that the child already uses in speech.

## L2 — Building Real Language

- Description: adjectives with ___ is ___ and adjective plus noun frames; opposites as contrast pairs.
- Place and time: in, on, under, behind, next to; Where is ___? It's ___ ___.
- Possession: I have ___; my/your/his/her.
- Questions: yes/no forms and what, where, who, how many; asking and answering.
- Speaking about now and before: present continuous; simple past of a small set of high-frequency verbs (went, saw, ate, played).
- Phonics: common blends and digraphs (sh, ch, th, st, bl); reading short phrases.

Exit: five-turn unrehearsed conversation on a familiar topic; answers wh-questions about a spoken four-sentence story.

## L3 — Expression and Comprehension

- Narration: first, next, then, finally; story retell; simple past narration of the child's day.
- Description depth: comparisons (bigger than, the biggest); describing pictures and people.
- Conversation: follow-up questions, polite forms used naturally (please, thank you, excuse me).
- Feelings and reasons: I feel ___ because ___; ___ makes me ___.
- Comprehension: six to eight sentence spoken stories; literal questions, then prediction.
- Reading: sight words, two-syllable known words, short supported read-aloud passages.

Exit: retells a story with sequence words; eight-to-ten-turn two-way conversation; answers literal and prediction questions.

## Progression mechanics

- Mastery unit: a concept, not a word. Mastered when the child produces it independently in two different sessions.
- Difficulty bump within a level after three consecutive correct productions.
- Easing after two consecutive failures; support mode available.
- Level exit assessment: authored ten-item oral check, pass at eight of ten; missed items replaced next attempt.
- Placement: five-item spoken game at first session (most five to seven year olds land in L2 or L3; L1 is the safety net).

## Status

- Authored content now lives in `src/lib/curriculum/l1.json`, `l2.json`, `l3.json` (patterns, vocabulary sets, phonics, exits).
- Selection, review ordering, and level readiness live in `src/lib/curriculum.ts`.
- Prompt behaviors live in `src/lib/prompts.ts` and must match this spec.
- Promotion to the next level happens only through the authored exit assessment (`assessment` arrays in the level files): ten oral items, pass at eight, failed attempts resume later with a rotated item order so missed material leads the retry.
- Play activities are authored (`activities` arrays) and selected in `src/lib/curriculum.ts`; the model may only run the authored activity.
- Support mode is entered by code when the recent struggle streak reaches the threshold (`src/lib/profile-types.ts`) or when the child's words signal sadness.
- Social and emotional learning is authored per level in the `sel` packs: check-in questions, the only permitted praise lines, encouragement lines for struggle, calm activities, and level SEL goals. The model may not invent praise or comfort wording.
- Learning records store authored pattern ids as items, so records map one-to-one onto this specification.
