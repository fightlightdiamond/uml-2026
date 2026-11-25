# English 12 Tenses — Visual Handbook

> Learn the 12 English tenses as a **system**, not as 12 separate rules.
> Every tense = **TIME** (Past / Present / Future) × **ASPECT** (Simple / Continuous / Perfect / Perfect Continuous).

---

## Table of Contents

1. [The Big Idea: 3 × 4 = 12](#1-the-big-idea-3--4--12)
2. [Use Case Diagram — What do you want to say?](#2-use-case-diagram--what-do-you-want-to-say)
3. [Class Diagram — How tenses are built](#3-class-diagram--how-tenses-are-built)
4. [Sequence Diagram — All 12 tenses on one timeline](#4-sequence-diagram--all-12-tenses-on-one-timeline)
5. [Tense-by-Tense Reference](#5-tense-by-tense-reference)
6. [Decision Flow — Which tense should I use?](#6-decision-flow--which-tense-should-i-use)
7. [Sequence Diagram — One story, many tenses](#7-sequence-diagram--one-story-many-tenses)
8. [Commonly Confused Pairs](#8-commonly-confused-pairs)
9. [Stative Verbs — The "no -ing" rule](#9-stative-verbs--the-no--ing-rule)
10. [Practice Exercises + Answer Key](#10-practice-exercises--answer-key)
11. [One-Page Cheat Sheet](#11-one-page-cheat-sheet)

---

## 1. The Big Idea: 3 × 4 = 12

| Aspect ↓ / Time → | **Past** | **Present** | **Future** |
|---|---|---|---|
| **Simple** — the fact, as a whole | worked | work(s) | will work |
| **Continuous** — in progress | was/were working | am/is/are working | will be working |
| **Perfect** — completed *before* a point | had worked | have/has worked | will have worked |
| **Perfect Continuous** — duration *up to* a point | had been working | have/has been working | will have been working |

**Three building blocks you only need to learn once:**

| Block | Form | Meaning it adds |
|---|---|---|
| Continuous | **be + V-ing** | "in progress" |
| Perfect | **have + V3** | "before a reference point" |
| Perfect Continuous | **have + been + V-ing** | "in progress *up to* a reference point" |

Then you only change the **first auxiliary** by time:

- Past → `was/were`, `had`, `did`
- Present → `am/is/are`, `have/has`, `do/does`
- Future → `will`

---

## 2. Use Case Diagram — What do you want to say?

Start from **intention** (what the speaker wants to communicate), then pick the tense.

```mermaid
flowchart LR
    Speaker((Speaker))

    subgraph PAST["Talk about the PAST"]
        U1([Report a finished event]) --> T1[Past Simple]
        U2([Set the background scene]) --> T2[Past Continuous]
        U3([Show an earlier past event]) --> T3[Past Perfect]
        U4([Explain duration before a past event]) --> T4[Past Perfect Continuous]
    end

    subgraph PRESENT["Talk about NOW"]
        U5([State habits, facts, schedules]) --> T5[Present Simple]
        U6([Describe what is happening now]) --> T6[Present Continuous]
        U7([Report experience or a result that matters now]) --> T7[Present Perfect]
        U8([Explain how long something has been going on]) --> T8[Present Perfect Continuous]
    end

    subgraph FUTURE["Talk about the FUTURE"]
        U9([Predict, promise, decide instantly]) --> T9[Future Simple]
        U10([Describe an action in progress at a future time]) --> T10[Future Continuous]
        U11([Promise completion by a deadline]) --> T11[Future Perfect]
        U12([Measure duration up to a future point]) --> T12[Future Perfect Continuous]
    end

    Speaker --- U1 & U2 & U3 & U4
    Speaker --- U5 & U6 & U7 & U8
    Speaker --- U9 & U10 & U11 & U12
```

---

## 3. Class Diagram — How tenses are built

Think of a tense as an object composed of **Time** and **Aspect**. The aspect decides the verb pattern; the time decides the auxiliary.

```mermaid
classDiagram
    class Tense {
        <<abstract>>
        +Time time
        +Aspect aspect
        +positive()
        +negative()
        +question()
    }

    class Time {
        <<enumeration>>
        PAST
        PRESENT
        FUTURE
    }

    class Aspect {
        <<abstract>>
        +String meaning
        +String verbPattern
    }

    class SimpleAspect {
        +meaning = "fact as a whole"
        +verbPattern = "V / V2 / will V"
    }
    class ContinuousAspect {
        +meaning = "in progress"
        +verbPattern = "be + V-ing"
    }
    class PerfectAspect {
        +meaning = "completed before a point"
        +verbPattern = "have + V3"
    }
    class PerfectContinuousAspect {
        +meaning = "duration up to a point"
        +verbPattern = "have + been + V-ing"
    }

    class PastTense {
        +auxiliary = "did / was / were / had"
        +referencePoint = "a past moment"
    }
    class PresentTense {
        +auxiliary = "do / does / am / is / are / have / has"
        +referencePoint = "now"
    }
    class FutureTense {
        +auxiliary = "will"
        +referencePoint = "a future moment"
    }

    Tense --> Time : has
    Tense --> Aspect : has
    Aspect <|-- SimpleAspect
    Aspect <|-- ContinuousAspect
    Aspect <|-- PerfectAspect
    Aspect <|-- PerfectContinuousAspect
    Tense <|-- PastTense
    Tense <|-- PresentTense
    Tense <|-- FutureTense
```

**How to read it:** `Present Perfect` = `PresentTense` (auxiliary *have/has*) + `PerfectAspect` (*have + V3*) → **I have worked**.

---

## 4. Sequence Diagram — All 12 tenses on one timeline

**Legend:** Note = action **at** a point · Solid arrow `->>` = completed **before** a point (result) · Dashed arrow `-->>` = continuing **up to** a point (duration)

```mermaid
sequenceDiagram
    participant BP as Before Past Point
    participant PP as Past Point
    participant NOW as NOW
    participant BF as Before Future Point
    participant FP as Future Point

    rect rgb(255, 235, 230)
    Note over BP,FP: PAST TENSES
    Note over PP: 1. PAST SIMPLE<br/>I worked
    Note over PP: 2. PAST CONTINUOUS<br/>I was working
    BP->>PP: 3. PAST PERFECT - I had worked
    BP-->>PP: 4. PAST PERFECT CONTINUOUS - I had been working
    end

    rect rgb(230, 245, 230)
    Note over BP,FP: PRESENT TENSES
    Note over BP,FP: 5. PRESENT SIMPLE - I work (always true / habit)
    Note over NOW: 6. PRESENT CONTINUOUS<br/>I am working
    PP->>NOW: 7. PRESENT PERFECT - I have worked
    PP-->>NOW: 8. PRESENT PERFECT CONTINUOUS - I have been working
    end

    rect rgb(230, 238, 255)
    Note over BP,FP: FUTURE TENSES
    Note over FP: 9. FUTURE SIMPLE<br/>I will work
    Note over FP: 10. FUTURE CONTINUOUS<br/>I will be working
    BF->>FP: 11. FUTURE PERFECT - I will have worked
    NOW-->>FP: 12. FUTURE PERFECT CONTINUOUS - I will have been working
    end
```

**Key insight:** Perfect tenses always **look back** from a reference point. Move the reference point (past moment → now → future moment) and you get Past / Present / Future Perfect.

---

## 5. Tense-by-Tense Reference

### 5.1 Past Group

#### 1. Past Simple
| | Form | Example |
|---|---|---|
| (+) | S + V2/ed | I **fixed** the bug yesterday. |
| (−) | S + did not + V | I **didn't fix** the bug yesterday. |
| (?) | Did + S + V? | **Did** you **fix** the bug yesterday? |

- **Use:** finished action at a specific past time; a sequence of past events.
- **Signals:** yesterday, last week/month/year, ago, in 2020, when I was…
- ⚠️ Don't use with *already / so far / ever* when the time is unfinished → use Present Perfect.

#### 2. Past Continuous
| | Form | Example |
|---|---|---|
| (+) | S + was/were + V-ing | I **was testing** at 8 p.m. |
| (−) | S + was/were not + V-ing | I **wasn't testing** at 8 p.m. |
| (?) | Was/Were + S + V-ing? | **Were** you **testing** at 8 p.m.? |

- **Use:** in progress at a past moment; background interrupted by a Past Simple action; two parallel past actions (*while*).
- **Signals:** at + time + yesterday, while, when.
- Pattern: *I **was coding** (background) **when** the power **went** out (interruption).*

#### 3. Past Perfect
| | Form | Example |
|---|---|---|
| (+) | S + had + V3 | The build **had failed** before I arrived. |
| (−) | S + had not + V3 | The build **hadn't failed** before I arrived. |
| (?) | Had + S + V3? | **Had** the build **failed** before you arrived? |

- **Use:** the **earlier** of two past events; "past of the past".
- **Signals:** before, after, by the time, already, when (+ Past Simple).

#### 4. Past Perfect Continuous
| | Form | Example |
|---|---|---|
| (+) | S + had been + V-ing | I **had been waiting** for 2 hours. |
| (−) | S + had not been + V-ing | I **hadn't been waiting** long. |
| (?) | Had + S + been + V-ing? | How long **had** you **been waiting**? |

- **Use:** duration of an activity **up to** a past point; explains a past result.
- **Signals:** for, since, how long, before, when.
- e.g. *She was tired because she **had been debugging** all night.*

### 5.2 Present Group

#### 5. Present Simple
| | Form | Example |
|---|---|---|
| (+) | S + V(s/es) | She **reviews** PRs every morning. |
| (−) | S + do/does not + V | She **doesn't review** PRs on Fridays. |
| (?) | Do/Does + S + V? | **Does** she **review** PRs every morning? |

- **Use:** habits, facts, general truths, fixed timetables (*The train leaves at 7*).
- **Signals:** always, usually, often, sometimes, never, every day.

#### 6. Present Continuous
| | Form | Example |
|---|---|---|
| (+) | S + am/is/are + V-ing | I **am deploying** the app now. |
| (−) | S + am/is/are not + V-ing | I **am not deploying** now. |
| (?) | Am/Is/Are + S + V-ing? | **Are** you **deploying** now? |

- **Use:** happening now; temporary situations; **fixed personal plans** in the near future (*I'm meeting the client tomorrow*).
- **Signals:** now, right now, at the moment, currently, Look!, Listen!

#### 7. Present Perfect
| | Form | Example |
|---|---|---|
| (+) | S + have/has + V3 | I **have fixed** three bugs so far. |
| (−) | S + have/has not + V3 | I **haven't fixed** it yet. |
| (?) | Have/Has + S + V3? | **Have** you ever **used** Kafka? |

- **Use:** life experience; past action with a **result now**; unfinished time period (today, this week).
- **Signals:** already, yet, just, ever, never, so far, recently, since, for.

#### 8. Present Perfect Continuous
| | Form | Example |
|---|---|---|
| (+) | S + have/has been + V-ing | I **have been debugging** since 9 a.m. |
| (−) | S + have/has not been + V-ing | I **haven't been sleeping** well. |
| (?) | Have/Has + S + been + V-ing? | How long **have** you **been working** here? |

- **Use:** started in the past, continues **up to now** (may continue); focus on **duration / activity**.
- **Signals:** for, since, all day, how long, lately.

### 5.3 Future Group

#### 9. Future Simple
| | Form | Example |
|---|---|---|
| (+) | S + will + V | I **will send** the report. |
| (−) | S + will not (won't) + V | I **won't send** it today. |
| (?) | Will + S + V? | **Will** you **send** it? |

- **Use:** instant decision, prediction (opinion), promise, offer.
- **Signals:** tomorrow, next week, soon, I think, probably.
- ⚠️ Plan already decided → *be going to*: *I'm going to refactor this module.*

#### 10. Future Continuous
| | Form | Example |
|---|---|---|
| (+) | S + will be + V-ing | I **will be presenting** at 10 a.m. |
| (−) | S + will not be + V-ing | I **won't be working** on Sunday. |
| (?) | Will + S + be + V-ing? | **Will** you **be using** the room at 3? |

- **Use:** in progress at a specific future moment; polite questions about plans.
- **Signals:** at this time tomorrow, at 10 a.m. next Monday.

#### 11. Future Perfect
| | Form | Example |
|---|---|---|
| (+) | S + will have + V3 | By Friday, I **will have finished** the sprint. |
| (−) | S + will not have + V3 | I **won't have finished** by Friday. |
| (?) | Will + S + have + V3? | **Will** you **have finished** by Friday? |

- **Use:** completed **before** a future point (deadline thinking).
- **Signals:** by + time, by the time, before, by then.

#### 12. Future Perfect Continuous
| | Form | Example |
|---|---|---|
| (+) | S + will have been + V-ing | By December, I **will have been working** here for 5 years. |
| (−) | S + will not have been + V-ing | I **won't have been working** here long. |
| (?) | Will + S + have been + V-ing? | How long **will** you **have been working** here? |

- **Use:** duration of an activity **up to** a future point.
- **Signals:** by + time + for + period.

---

## 6. Decision Flow — Which tense should I use?

```mermaid
flowchart TD
    A{When is the reference point?} -->|Past moment| P{What do you want to show?}
    A -->|Now| N{What do you want to show?}
    A -->|Future moment| F{What do you want to show?}

    P -->|Fact, finished| P1[Past Simple<br/>I worked]
    P -->|In progress at that moment| P2[Past Continuous<br/>I was working]
    P -->|Done before that moment| P3[Past Perfect<br/>I had worked]
    P -->|Duration up to that moment| P4[Past Perfect Continuous<br/>I had been working]

    N -->|Habit, fact, schedule| N1[Present Simple<br/>I work]
    N -->|Happening now| N2[Present Continuous<br/>I am working]
    N -->|Result or experience up to now| N3[Present Perfect<br/>I have worked]
    N -->|Duration up to now| N4[Present Perfect Continuous<br/>I have been working]

    F -->|Will happen| F1[Future Simple<br/>I will work]
    F -->|In progress at that moment| F2[Future Continuous<br/>I will be working]
    F -->|Done before that moment| F3[Future Perfect<br/>I will have worked]
    F -->|Duration up to that moment| F4[Future Perfect Continuous<br/>I will have been working]
```

**Two questions decide every tense:**
1. **Where is my reference point?** (past moment / now / future moment)
2. **What do I focus on?** (fact / in progress / completed before / duration up to)

---

## 7. Sequence Diagram — One story, many tenses

A real workday told with 10 tenses. Read the messages top to bottom.

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant Lead as Team Lead
    participant Sys as Production System

    Note over Dev: Present Simple - I usually start work at 8 a.m.
    Sys-->>Sys: Past Perfect Continuous - The queue had been growing for 2 hours
    Note over Dev: Past Continuous - I was reviewing a PR
    Sys->>Dev: Past Simple - The alert fired at 9:15
    Note over Sys: Past Perfect - The service had already crashed before the alert fired
    Lead->>Dev: Present Perfect (question) - Have you found the root cause yet?
    Dev->>Lead: Present Perfect Continuous - I have been checking the logs since 9:20
    Dev->>Lead: Present Continuous - I am testing a fix right now
    Lead->>Dev: Future Simple (question) - When will it be ready?
    Dev->>Lead: Future Perfect - I will have deployed the fix by 11 a.m.
    Dev->>Lead: Future Continuous - At noon I will be monitoring the system
    Dev->>Lead: Future Perfect Continuous - By 5 p.m. we will have been running stably for 6 hours
```

---

## 8. Commonly Confused Pairs

| Pair | Difference | Example |
|---|---|---|
| Past Simple vs Present Perfect | Specific finished time **vs** no time / result now | I **lost** my key yesterday. / I **have lost** my key (I still can't get in). |
| Present Perfect vs Present Perfect Continuous | **Result / quantity** vs **activity / duration** | I **have written** 3 tests. / I **have been writing** tests all morning. |
| Past Simple vs Past Perfect | One past event **vs** the earlier of two | When I arrived, the meeting **started**. (on arrival) / …the meeting **had started**. (before arrival) |
| Past Simple vs Past Continuous | Complete event **vs** background in progress | I **coded** a feature. / I **was coding** when he called. |
| will vs be going to vs Present Continuous | Instant decision **vs** intention **vs** arranged plan | I'll help you. / I'm going to learn Rust. / I'm meeting the client at 3. |
| Future Simple vs Future Perfect | Happens at a point **vs** finished before a point | I **will finish** on Friday. / I **will have finished** by Friday. |

---

## 9. Stative Verbs — The "no -ing" rule

Stative verbs describe **states**, not actions, so they are usually **not** used in Continuous tenses.

| Category | Verbs |
|---|---|
| Mind | know, believe, understand, remember, mean |
| Feeling | like, love, hate, want, need, prefer |
| Possession | have (= own), own, belong |
| Senses | see, hear, smell, taste (involuntary) |
| Being | be, seem, contain, consist |

- ❌ *I am knowing the answer.* → ✅ *I **know** the answer.*
- ❌ *I have been knowing him for years.* → ✅ *I **have known** him for years.*
- Exception (action meaning): *I'**m having** lunch.* / *I'**m thinking** about it.*

---

## 10. Practice Exercises + Answer Key

### Exercise A — Choose the correct tense

1. I ______ (work) here since 2021.
2. When I arrived, the meeting ______ (already / start).
3. Look! The server ______ (restart).
4. By next June, she ______ (complete) the course.
5. I ______ (meet) him last week.
6. At 9 p.m. tomorrow, I ______ (fly) to Hanoi.
7. She was exhausted because she ______ (code) all night.
8. Water ______ (boil) at 100°C.
9. ______ you ever ______ (use) Typesense?
10. By 2027, I ______ (study) English for 2 years.

### Exercise B — Fix the mistake

1. I have met him yesterday.
2. I am knowing this API well.
3. When I came, she already left.
4. I will have finish it by Friday.
5. How long are you working here?

### Answer Key

**A.**
1. have worked / have been working — *Present Perfect (Continuous)*
2. had already started — *Past Perfect*
3. is restarting — *Present Continuous*
4. will have completed — *Future Perfect*
5. met — *Past Simple*
6. will be flying — *Future Continuous*
7. had been coding — *Past Perfect Continuous*
8. boils — *Present Simple*
9. Have … used — *Present Perfect*
10. will have been studying — *Future Perfect Continuous*

**B.**
1. I **met** him yesterday. (specific past time → Past Simple)
2. I **know** this API well. (stative verb)
3. When I came, she **had already left**. (earlier past event)
4. I will have **finished** it by Friday. (have + V3)
5. How long **have you been working** here? (duration up to now)

---

## 11. One-Page Cheat Sheet

| # | Tense | Formula (+) | Core idea | Key signals |
|---|---|---|---|---|
| 1 | Past Simple | S + V2/ed | finished at past time | yesterday, ago, last |
| 2 | Past Continuous | S + was/were + V-ing | in progress at past moment | while, when, at 8 p.m. yesterday |
| 3 | Past Perfect | S + had + V3 | before another past event | before, after, by the time |
| 4 | Past Perfect Continuous | S + had been + V-ing | duration up to past point | for, since, when |
| 5 | Present Simple | S + V(s/es) | habit, fact, schedule | always, usually, every |
| 6 | Present Continuous | S + am/is/are + V-ing | happening now / arranged plan | now, at the moment |
| 7 | Present Perfect | S + have/has + V3 | result / experience up to now | already, yet, ever, so far |
| 8 | Present Perfect Continuous | S + have/has been + V-ing | duration up to now | for, since, all day |
| 9 | Future Simple | S + will + V | decision, prediction, promise | tomorrow, soon, probably |
| 10 | Future Continuous | S + will be + V-ing | in progress at future moment | at this time tomorrow |
| 11 | Future Perfect | S + will have + V3 | done before future point | by + time |
| 12 | Future Perfect Continuous | S + will have been + V-ing | duration up to future point | by + time + for |

**Memory rule:** `be + V-ing` = in progress · `have + V3` = looking back · `have been + V-ing` = looking back at a process.

### Suggested study path

1. Master the **3 × 4 grid** (Section 1).
2. Draw the **timeline** from memory (Section 4).
3. Practise with the **decision flow** (Section 6).
4. Study the **confused pairs** (Section 8) — this is where most mistakes happen.
5. Do the exercises (Section 10), then write 12 sentences about your own workday.
