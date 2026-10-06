# OpenMuse Language Agent — Production Implementation Plan

Status: Active implementation
Updated: 2026-10-06

## 1. Product goal

Build a private, on-device language agent that trains **functional language ability**, not app completion.

The design borrows public, non-sensitive pedagogical ideas from DLIFLC and CIA ILI:
- mission/task-oriented practice
- functional proficiency measurement
- immersion
- cultural competence and natural phrasing
- recurring-error detection
- micro-targeted remediation
- spaced review and maintenance
- adaptive AI tutoring

OpenMuse does **not** claim to provide an official DLPT, OPI, ILR, CIA, or DLI assessment. Any proficiency scale in the app is explicitly "ILR-inspired functional progress."

## 2. Core experience

Every session should follow:

1. **Mission**
   - one practical objective
   - real context
   - clear success conditions
2. **Interaction**
   - Muse leads a natural conversation/role-play
   - English support depends on immersion setting
3. **Evaluation**
   - Scout selectively identifies recurring errors, useful vocabulary, and skill focus
   - one-off slips are not automatically treated as weaknesses
4. **Deep help**
   - Sage is invoked only for difficult explanations or repeated confusion
5. **Memory update**
   - learner profile, recurring patterns, vocabulary, and review queue persist locally
6. **After-action review**
   - objective result
   - what went well
   - what needs work
   - new language worth retaining
   - next recommended mission
7. **Maintenance**
   - due review items surface later using spaced review

## 3. Agent architecture

### Language Agent
Domain owner. It is not a model itself.

Responsibilities:
- learner profile
- mission selection
- session policy
- error recurrence
- review scheduling
- agent delegation
- AAR
- session history

### Muse
Primary teaching worker and critical path.

Responsibilities:
- conversational tutoring
- role-play
- correction delivery
- user-facing explanations
- natural/cultural phrasing
- adaptive difficulty

### Scout
Low-cost evaluator.

Responsibilities:
- classify learner errors
- identify vocabulary candidates
- estimate confidence
- detect recurring patterns
- tag skill focus

Policy:
- do not invoke on every turn
- invoke on correction drills, periodic checkpoints, mission completion, and ambiguous performance
- skip if not installed

### Sage
Deep specialist.

Responsibilities:
- difficult grammar contrasts
- nuanced cultural explanation
- persistent misunderstanding
- critique of a planned lesson/AAR

Policy:
- never routine
- user asks "why/explain/difference" OR repeated weakness OR Scout marks deep explanation
- skip if not installed

## 4. Single-engine constraint

Current LiteRT integration keeps one engine active at a time. Model initialization can be expensive.

Therefore:
- agent delegation is sequential
- Muse is prioritized for user-visible response latency
- avoid Scout → Sage → Muse on ordinary turns
- track model-swap count per session
- add a delegation budget
- benchmark cold/warm model swaps on Pixel hardware
- future multi-engine work is optional and gated by memory/battery measurements

## 5. Learner profile v2

Persist locally with schema version and migration.

Fields:
- target language
- self-selected level
- ILR-inspired functional skill bands:
  - interaction
  - listening
  - reading
  - accuracy
  - cultural/pragmatic competence
- total practice turns
- total sessions
- goals
- recurring error patterns with counts
- vocabulary/review items
- recent corrections
- completed missions
- last practiced
- last assessment

## 6. Error policy

A weakness should represent a pattern, not a typo.

An error becomes recurring when:
- same normalized key appears >= 3 times across >= 2 turns/sessions, OR
- learner explicitly asks to remember/practice it

Each pattern stores:
- key
- label
- category
- count
- first seen
- last seen
- examples
- current status

Statuses:
- observed
- recurring
- improving
- maintained

## 7. Mission system

Mission fields:
- id
- title
- target language
- mode
- scenario
- objective
- success criteria
- skill focus
- difficulty
- immersion level
- cultural note
- recommended vocabulary

Examples:
- Order dinner naturally
- Check into a hotel
- Handle a missed train
- Explain what you did yesterday
- Ask for clarification without switching to English
- Understand a short station announcement

## 8. Immersion modes

### Guided
Target language first, concise English support available.

### Immersion
Target language by default. English only when learner is stuck.

### Full immersion
No English except explicit emergency/help request.

## 9. Functional progress

Do not show fake precision.

Use five internal bands:
- 0: not demonstrated
- 1: basic survival
- 2: functional routine interaction
- 3: sustained practical interaction
- 4: advanced flexible use

Display as qualitative progress, explicitly "ILR-inspired", never as an official ILR score.

Update only from repeated evidence, not one response.

## 10. Spaced review

Review item kinds:
- vocabulary
- phrase
- correction
- grammar contrast
- cultural/pragmatic note

Initial intervals:
- Again: <1 day
- Hard: 1 day
- Good: 3 days
- Easy: 7 days

Subsequent intervals expand using a bounded ease factor.

A review result records:
- quality 0..3
- repetitions
- interval
- ease
- next due timestamp

## 11. After-action review

Each completed mission produces:

- Mission result: completed / partial / retry
- Strong behaviors
- Recurring weaknesses
- Important corrections
- New vocabulary
- Cultural/pragmatic note
- Recommended review items
- Next mission recommendation

Keep AAR short enough to be useful.

## 12. Authentic material — later phase

Share into OpenMuse:
- article
- video transcript
- short clip
- screenshot
- travel material

Language Agent can extract:
- useful phrases
- listening/reading questions
- cultural context
- shadowing segments
- review items

Copyright-safe: store derived notes/short excerpts as appropriate, not unauthorized full content.

## 13. Voice/pronunciation — later phase

Requirements:
- speech-to-text
- recording playback
- pronunciation/fluency signals
- target-vs-learner comparison
- no claim of phonetic accuracy until validated

Potential metrics:
- intelligibility
- pacing
- hesitation
- target sounds
- stress/rhythm

## 14. QA strategy

### Unit
- profile migration
- recurrence threshold
- duplicate normalization
- review scheduling
- interval bounds
- skill-band clamping
- mission selection
- delegation policy
- malformed Scout JSON
- missing Scout/Sage
- fallback behavior

### Integration
- Muse only
- Scout + Muse
- Scout + Sage + Muse
- load failure keeps downloaded model
- model swap order
- profile update after successful turn
- profile not corrupted after failed turn
- app restart restores profile
- airplane/offline mode

### Device
Pixel:
- cold Muse load
- warm Muse load
- Scout→Muse swap
- Sage→Muse swap
- 10-turn session
- 30-turn soak
- memory growth
- thermal behavior
- battery impact
- process kill/restart
- APK update preserves model and profile

### Learning-behavior QA
Synthetic transcripts:
- one typo must NOT become a recurring weakness
- same grammar error repeated 3x should become recurring
- corrected behavior should transition to improving
- weak items should be scheduled for review
- cultural/naturalness notes should be separate from grammatical correctness

### UI
- no raw model/runtime exceptions
- agent trace is understandable, not technical noise
- learner can reset history/profile separately
- offline/local status visible
- empty/loading/retry states
- keyboard and accessibility
- language screen usable one-handed

## 15. Performance acceptance

Establish Pixel baseline first, then enforce regression budgets.

Track:
- first useful response latency
- model initialization time
- model swap time
- tokens/sec
- peak RSS
- thermal state
- battery delta
- UI frame jank

No hard latency claim until measured on target hardware.
After baseline, CI/device regression threshold: <=20% degradation unless explicitly approved.

## 16. Privacy

- learner profile remains app-private
- no remote sync by default
- no notification content included in language prompts unless explicitly shared
- model files survive app updates
- explicit controls to clear chat, language profile, and models independently

## 17. Delivery phases

### Phase A — Foundation (now)
- structured handoff protocol
- sequential agent runtime
- learner profile v2
- recurrence logic
- spaced-review scheduler
- delegation policy
- tests

### Phase B — Mission learning
- mission catalog
- adaptive mission selection
- immersion modes
- AAR
- skill-band evidence

### Phase C — Review
- daily review queue
- micro-targeted drills
- maintenance sessions
- progress view

### Phase D — Voice
- microphone flow
- STT
- pronunciation/fluency feedback
- spoken role-play

### Phase E — Authentic material
- share-to-Language-Agent
- transcript/article lesson creation
- shadowing and comprehension

### Phase F — Evaluation
- adaptive diagnostic
- periodic functional re-assessment
- skill-by-skill progress
- no official ILR/DLPT claim

## 18. Definition of done for v1

Language Agent v1 is production-ready when:
- existing model downloads survive APK update
- Muse full-screen chat works
- French mission can run fully offline
- learner profile survives restart
- repeated errors are tracked without overfitting one-off mistakes
- review items become due predictably
- Scout/Sage absence never blocks Muse
- no raw runtime errors reach user
- 30-turn device soak has no crash or unbounded memory growth
- AAR is generated and next mission is recommended
