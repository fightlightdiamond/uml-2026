# Technical English Learning Process

**Version:** 2.1  
**Status:** Learning baseline  
**Scope:** Reading, understanding, and using technical English in software engineering, UML, architecture, requirements, and technical documentation.

---

## 1. Purpose

This process helps the learner:

- avoid translating English word by word using Vietnamese sentence order;
- identify meaningful phrases before interpreting the sentence;
- understand the technical meaning before producing a Vietnamese translation;
- distinguish language mistakes from domain-understanding mistakes;
- move from recognition to active use;
- retain only reusable knowledge in the A6 note;
- keep future lessons consistent and reviewable.

The process has one main learning flow:

```text
READ -> GUESS -> TRY -> REVISE -> FINALIZE
```

Inside `READ` and `GUESS`, use the sentence-analysis technique:

```text
CHUNK -> CORE -> LINK -> TERM -> MEANING
```

The complete structure is:

```text
READ
  CHUNK -> CORE -> LINK -> TERM

GUESS
  MEANING -> Vietnamese expression

TRY
  Explain -> Interpret -> Produce

REVISE
  Locate error -> Correct -> Retry

FINALIZE
  Pattern -> Example -> Rule -> Common mistake

A6
  Store reusable knowledge only
```

---

## 2. Core principles

### 2.1 Understand before translating

The first objective is not to create a polished Vietnamese sentence. The first objective is to recover:

- the grammatical structure;
- the relationships between phrases;
- the established technical terms;
- the minimum technical meaning supported by the source.

Only after that should the learner express the meaning naturally in Vietnamese.

### 2.2 Read in phrases, not isolated words

Technical meaning is often carried by multi-word units:

- `parameter type`
- `return type`
- `usage dependency`
- `interface realization`
- `role name`
- `full signature`
- `shared aggregation`

These should be processed as units rather than translated word by word.

### 2.3 Separate source meaning from inference

For each sentence, distinguish:

1. **Explicit meaning:** directly stated by the sentence.
2. **Supported inference:** reasonably derived from the sentence and domain rules.
3. **Assumption:** added by the reader but not confirmed by the source.

Do not turn an assumption into a confirmed technical rule.

### 2.4 Preserve the first attempt

The initial guess must be retained until revision. It provides evidence of:

- what was understood correctly;
- where the sentence was split incorrectly;
- which link or technical term caused the mistake;
- whether the problem was English or domain knowledge.

### 2.5 Final notes are not raw working notes

The A6 note contains only stable, reusable knowledge. Exploratory attempts, long explanations, and one-off details remain in the lesson log, not in the final A6 note.

---

## 3. Step 1: READ

### Objective

Identify the structure of the source before translating it.

`READ` contains four operations:

```text
CHUNK -> CORE -> LINK -> TERM
```

---

### 3.1 CHUNK: Divide the sentence into meaningful phrases

Mark meaningful units with brackets or slashes.

Example:

> The parameter and return types imply usage dependencies.

Correct chunking:

```text
[The parameter and return types]
[imply]
[usage dependencies]
```

Avoid word-by-word separation:

```text
The / parameter / and / return / types / imply / usage / dependencies
```

#### Chunking cues

Possible phrase boundaries include:

- the main verb;
- prepositions such as `in`, `with`, `by`, `for`, and `beyond`;
- conjunctions such as `and`, `but`, and `or`;
- relative markers such as `that`, `which`, and `who`;
- commas and semicolons;
- the beginning or end of a technical term.

Do not separate a preposition from the phrase it introduces:

```text
[with evidence-based multiplicities]
[for all outcomes]
[beyond the Handbook figures]
```

Do not split established technical terms:

```text
[return type]
[usage dependency]
[interface realization]
```

---

### 3.2 CORE: Find the sentence backbone

Identify:

```text
Subject + Main verb + Object/Complement
```

For the example:

```text
Subject: The parameter and return types
Main verb: imply
Object: usage dependencies
```

Simplified backbone:

```text
Types imply dependencies.
```

#### Imperative sentences

Technical instructions often omit the subject `you`:

```text
Show the relationships.
```

Underlying structure:

```text
(You) show the relationships.
```

#### Passive sentences

Treat the auxiliary and participle as one verb phrase:

```text
The handbook is organised in three levels plus a reference part.
```

```text
Subject: The handbook
Verb phrase: is organised
Complement: in three levels plus a reference part
```

Do not interpret `is` and `organised` independently.

---

### 3.3 LINK: Determine what modifies or refers to what

Identify:

- which adjective or noun modifies which head noun;
- which phrase restricts or explains a previous element;
- which noun a relative clause modifies;
- what pronouns such as `it`, `its`, `they`, `that`, and `which` refer to;
- which part a condition or limitation applies to.

Example:

```text
a dependency [that is important to show]
```

The relative pronoun `that` refers to `dependency`.

Meaning:

> The dependency is important enough to show.

Another example:

```text
Show [the relationships] [decided in Section 7.3 and in Exercise 4].
```

`decided in Section 7.3 and in Exercise 4` modifies `the relationships`.

It does not instruct the learner to decide the relationships again.

#### Head-noun check

In many English noun phrases, the main noun is near the end:

```text
evidence-based multiplicities
```

- Head noun: `multiplicities`
- Modifier: `evidence-based`

Meaning:

> multiplicities supported by evidence

---

### 3.4 TERM: Lock technical terms

List the technical terms and assign their domain-specific meanings.

Example:

| Technical term | Vietnamese meaning |
|---|---|
| `parameter type` | kiểu tham số |
| `return type` | kiểu trả về |
| `usage dependency` | quan hệ phụ thuộc sử dụng |
| `role name` | tên vai trò |
| `interface realization` | quan hệ hiện thực hóa interface |
| `shared aggregation` | kết tập chia sẻ |
| `full signature` | chữ ký đầy đủ |
| `multiplicity` | bội số |

#### Distinguish technical and grammatical phrases

Technical terms:

```text
usage dependency
return type
interface realization
```

Grammatical phrases:

```text
important to show
decided in Section 7.3
needed by Create Task
```

Technical terms should be interpreted according to the domain. Grammatical phrases should be analysed according to their role and attachment in the sentence.

---

## 4. Step 2: GUESS

### Objective

Construct the meaning independently before receiving correction.

`GUESS` contains two outputs:

1. technical meaning;
2. natural Vietnamese expression.

---

### 4.1 MEANING: Build the technical logic

Do not attempt a polished translation immediately. First write the technical logic in simple steps.

Source:

> The parameter and return types imply usage dependencies.

Technical logic:

```text
A type appears in an operation signature
-> the operation uses that type
-> a usage dependency exists implicitly
-> a separate dependency arrow may be unnecessary
```

This step prevents a grammatically plausible translation from hiding a technical misunderstanding.

---

### 4.2 Express the meaning naturally in Vietnamese

After the technical logic is stable, produce a natural Vietnamese sentence:

> Các kiểu tham số và kiểu trả về ngầm thể hiện các quan hệ phụ thuộc sử dụng.

Do not force a one-to-one mapping between English and Vietnamese words. Preserve the relationships between ideas and the technical meaning.

---

### 4.3 Record confidence and uncertainty

Use one of these statuses:

- **Confirmed:** the structure, term, and technical meaning are clear.
- **Probable:** the interpretation is reasonable but needs checking.
- **Unresolved:** an important link, term, or domain rule is unclear.

For an unresolved point, record the exact question rather than guessing silently.

Example:

```text
Unresolved:
Does "for all outcomes" modify only "return type" or the whole instruction?
```

---

## 5. Step 3: TRY

### Objective

Move from recognising the source sentence to actively using the pattern.

A lesson should use one or more of the following exercises.

---

### 5.1 Explain

Explain the source meaning in the learner's own words.

Example:

```text
Why do parameter and return types imply usage dependencies?
```

Expected focus:

- a class operation uses those types;
- the dependency exists semantically;
- an explicit dependency arrow may be omitted when the signature is sufficient.

---

### 5.2 Interpret

Apply the same reading technique to a similar sentence.

Example:

> Attribute types may also imply structural relationships.

The learner should perform at least:

```text
CHUNK -> CORE -> TERM -> MEANING
```

---

### 5.3 Produce

Write a new sentence using the learned pattern.

Example:

> Parameter types imply dependencies, but those dependencies do not always need separate arrows.

Production verifies that the learner can use the pattern rather than only recognise it.

---

### 5.4 Contrast

When two concepts are easily confused, compare them directly.

Example:

```text
Navigability = direction of access
Multiplicity = permitted number of related instances
```

Then apply both to one relationship:

```text
Column "1" --> "0..*" Task : tasks
```

- `-->` expresses navigability.
- `"1"` and `"0..*"` express multiplicity.
- `tasks` is a role name.

---

## 6. Step 4: REVISE

### Objective

Identify the source of an error, correct it, and verify the correction with a new attempt.

Do not only replace the final Vietnamese sentence.

---

### 6.1 Error taxonomy

| Error type | Description | Typical example |
|---|---|---|
| `CHUNK error` | Meaningful phrases were split incorrectly | Separating `return` from `type` |
| `CORE error` | Subject, main verb, object, or complement was misidentified | Treating a modifier as the main verb |
| `LINK error` | A modifier, pronoun, or relative clause was attached to the wrong element | Misreading what `that` refers to |
| `TERM error` | A technical term was translated word by word or assigned the wrong domain meaning | Translating `return type` literally |
| `MEANING error` | The grammar was understood, but the technical interpretation was incorrect | Assuming an omitted arrow means no dependency exists |
| `EXPRESSION error` | The meaning was correct, but the Vietnamese or English expression was unnatural | Keeping English word order in Vietnamese |
| `PRODUCTION error` | The learner understood the source but could not create a correct new example | Reusing the wrong verb or structure |

---

### 6.2 Revision sequence

```text
Locate error
-> Name the error type
-> Explain why it is wrong
-> Correct the interpretation or sentence
-> Retry with a similar example
```

Example:

```text
Original mistake:
The dependency does not exist because it is not drawn.

Error type:
MEANING error

Correction:
The dependency exists implicitly but does not need a separate arrow.

Reason:
The operation signature already shows that the class uses the parameter and return types.

Retry:
Return types imply usage dependencies, but these dependencies may remain implicit.
```

---

### 6.3 Preserve useful mistakes

Keep a mistake only when it reveals a reusable warning, such as:

```text
Not drawn != does not exist.
```

Do not keep every typo or temporary attempt in the final note.

---

## 7. Step 5: FINALIZE

### Objective

Convert the lesson into stable, reusable knowledge.

A lesson is ready to finalize when the learner can:

- identify the main chunks;
- find the sentence backbone;
- explain the important links;
- recognise the technical terms;
- state the technical meaning correctly;
- correct the main mistake;
- apply the pattern to at least one new example.

---

### 7.1 Final lesson structure

```text
PATTERN
TERM
MEANING
EXAMPLE
RULE
COMMON MISTAKE
```

Example:

```text
PATTERN
A implies B.
= A ngầm thể hiện hoặc cho thấy B.

TERM
usage dependency
= quan hệ phụ thuộc sử dụng

MEANING
A type used in an operation signature creates an implicit usage dependency.

EXAMPLE
Parameter and return types imply usage dependencies.

RULE
Do not draw a separate dependency arrow unless it adds important design information.

COMMON MISTAKE
Not drawn != does not exist.
```

---

### 7.2 Finalization gate

Before finalizing, verify:

- [ ] The source sentence is preserved correctly.
- [ ] The chunking does not split technical terms.
- [ ] The main verb is correct.
- [ ] Modifiers and relative clauses are linked correctly.
- [ ] Technical terms use consistent translations.
- [ ] The explanation does not add unsupported meaning.
- [ ] The learner has completed at least one `TRY` exercise.
- [ ] The key error has been classified and corrected.
- [ ] The final rule is reusable.
- [ ] The A6 note is concise enough for later review.

---

## 8. A6 note process

### 8.1 Purpose

The A6 note is the compact, approved learning baseline. It is not a transcript of the conversation or a storage place for unfinished reasoning.

### 8.2 Include

Include only:

- reusable language patterns;
- important technical terms;
- concise technical meanings;
- one clear example;
- a practical rule;
- a recurring or high-risk mistake.

### 8.3 Exclude

Do not include:

- the complete history of guesses;
- every practice sentence;
- long grammar explanations;
- details relevant to only one source sentence;
- uncertain conclusions;
- duplicate examples;
- corrections that do not provide a reusable lesson.

### 8.4 A6 template

```markdown
## [Pattern or topic]

**Pattern**  
A implies B.

**Meaning**  
A ngầm thể hiện hoặc cho thấy B.

**Technical term**  
`usage dependency` = quan hệ phụ thuộc sử dụng

**Example**  
Parameter and return types imply usage dependencies.

**Rule**  
Do not draw a separate dependency arrow unless it adds important design information.

**Common mistake**  
Not drawn does not mean that the dependency does not exist.
```

---

## 9. Supplementary Lessons

### 9.1 Role

Grammar is not a separate parallel curriculum. A supplementary lesson is created only when a recurring language problem blocks technical reading or writing.

### 9.2 Trigger conditions

Create a Supplementary Lesson when a problem:

1. appears repeatedly;
2. prevents correct reading or production;
3. cannot be resolved with one short correction;
4. is reusable across multiple technical lessons.

### 9.3 Possible lessons

```text
S1 - Finding the Real Subject
S2 - Recognising Active and Passive Voice
S3 - Finding the Head Noun
S4 - Relative Clauses and Antecedents
S5 - Long Noun Phrases
S6 - Modals in Requirements
S7 - Conditions, Constraints, and Exceptions
```

### 9.4 Flow

```text
Repeated grammar obstacle
-> Open a focused Supplementary Lesson
-> Practise the specific foundation
-> Verify with a technical sentence
-> Return to the main lesson
```

Do not expand a Supplementary Lesson beyond the grammar needed to remove the blocker.

---

## 10. Review cycle

Use spaced review after finalization:

- **Day 1:** recognise the pattern and explain the meaning;
- **Day 3:** interpret a new sentence with the same structure;
- **Day 7:** produce a correct technical sentence without looking at the note;
- **Day 30:** perform a mixed review with related concepts.

A review is successful when the learner can explain and apply the pattern, not merely repeat the saved Vietnamese translation.

Suggested checklist:

```text
[ ] +1 day: Recognise
[ ] +3 days: Interpret
[ ] +7 days: Produce
[ ] +30 days: Mixed review
```

---

## 11. Complete lesson template

```markdown
# Lesson [number] - [title]

## Source
[Original technical sentence or paragraph]

## Learning objective
- [What the learner should understand or produce]

## READ

### CHUNK
[Phrase 1] / [Phrase 2] / [Phrase 3]

### CORE
- Subject:
- Main verb:
- Object/complement:
- Simplified backbone:

### LINK
- [Modifier or reference] -> [target element]
- [Condition or limitation] -> [scope]

### TERM
| Term | Meaning | Status |
|---|---|---|
| `...` | ... | Confirmed / Probable / Unresolved |

## GUESS

### Initial interpretation
[Preserve the learner's first interpretation]

### Technical logic
```text
...
-> ...
-> ...
```

### Vietnamese expression
[Initial natural Vietnamese expression]

### Confidence
Confirmed / Probable / Unresolved

## TRY

### Explain
[Question and learner answer]

### Interpret
[Similar sentence and learner interpretation]

### Produce
[Learner-created sentence]

### Contrast, if needed
[Concept A] vs [Concept B]

## REVISE

- Error type:
- Original mistake:
- Correct interpretation:
- Reason:
- Retry:

## FINALIZE

### Pattern
[Reusable language pattern]

### Technical term
[Term and approved meaning]

### Technical meaning
[Concise domain explanation]

### Final example
[Correct example]

### Rule
[Reusable rule]

### Common mistake
[High-value warning]

## A6 Note
[Compact approved note only]

## Review
- [ ] +1 day: Recognise
- [ ] +3 days: Interpret
- [ ] +7 days: Produce
- [ ] +30 days: Mixed review
```

---

## 12. Worked example

### Source

> Give each operation its full signature and one declared return type for all outcomes.

### READ

#### CHUNK

```text
[Give]
[each operation]
[its full signature]
[and]
[one declared return type]
[for all outcomes]
```

#### CORE

```text
Hidden subject: You
Main verb: give
Indirect target: each operation
Required information:
  1. its full signature
  2. one declared return type
```

#### LINK

```text
its -> each operation
for all outcomes -> one declared return type
```

#### TERM

| Term | Meaning |
|---|---|
| `operation` | thao tác hoặc phương thức trong UML |
| `full signature` | chữ ký đầy đủ |
| `declared return type` | kiểu trả về được khai báo |
| `outcome` | kết quả có thể xảy ra |

### GUESS

Technical logic:

```text
Every operation needs a full signature.
Every operation declares one return type.
That return type must represent all possible outcomes.
```

Natural Vietnamese:

> Cung cấp chữ ký đầy đủ cho mỗi operation và khai báo một kiểu trả về duy nhất đại diện cho mọi kết quả có thể xảy ra.

### TRY

Interpret:

> Each command should expose one result type for both success and failure.

Produce:

> The move operation declares one result type for all valid and invalid outcomes.

### REVISE

Possible mistake:

```text
"for all outcomes" applies to the whole sentence.
```

Error type:

```text
LINK error
```

Correction:

```text
"for all outcomes" primarily describes the declared return type.
```

### FINALIZE

```text
PATTERN
one declared return type for all outcomes

MEANING
A single declared type represents success and failure outcomes.

RULE
Determine the scope of a trailing prepositional phrase before translating it.

COMMON MISTAKE
Do not attach the phrase automatically to the entire sentence.
```

---

## 13. Baseline decision

All new technical-English lessons should use:

```text
READ -> GUESS -> TRY -> REVISE -> FINALIZE
```

Within `READ` and `GUESS`, use:

```text
CHUNK -> CORE -> LINK -> TERM -> MEANING
```

Existing lessons do not need immediate migration. Update an older lesson to this format when it is reopened for review or revision. This avoids unnecessary rework while keeping future learning consistent.

---

## 14. Beginner Mode

### Purpose

`Beginner Mode` provides a lighter daily workflow for learners who are still building the habit of reading by structure rather than translating word by word.

Use this default sequence:

```text
CHUNK -> CORE -> TERM -> GUESS -> REVISE
```

### Required actions

1. **CHUNK:** Divide the sentence into meaningful phrases.
2. **CORE:** Find the subject, main verb, and object or complement.
3. **TERM:** Identify and lock the important technical terms.
4. **GUESS:** State the technical meaning in simple Vietnamese.
5. **REVISE:** Identify and correct one main error.

### Optional expansion

Open the additional steps only when needed:

```text
LINK -> MEANING -> TRY -> FINALIZE -> A6
```

Use the expanded workflow when:

- the sentence remains unclear after finding the core;
- a relative clause or modifier causes ambiguity;
- the learner repeats the same error;
- the sentence contains an important reusable pattern;
- the technical meaning affects a design decision.

### Beginner rule

Do not analyse every sentence at maximum depth. The immediate goal is to form a stable reading habit, not to perform complete grammatical analysis each time.

---

## 15. Usage Modes

The same learning process is used differently depending on the activity.

### 15.1 Learning Mode

Use for a new pattern, difficult sentence, important technical rule, or repeated mistake.

```text
READ -> GUESS -> TRY -> REVISE -> FINALIZE
```

Typical effort:

- about 5 to 15 minutes for one difficult sentence;
- at least one new interpretation or production exercise;
- finalization only when the knowledge is reusable.

### 15.2 Reading Mode

Use when reading a handbook, specification, architecture document, or UML material.

```text
Read the whole sentence
-> Understand the main technical meaning?
   -> Yes: continue reading
   -> No: find CORE
      -> Still unclear: apply CHUNK + LINK
         -> Still unclear: inspect TERM
            -> Still unclear: record the exact unresolved question
```

Do not stop to analyse a sentence that does not block understanding. Reading Mode prioritizes continuity and document-level meaning.

### 15.3 Exam Mode

Use for timed certification practice such as TOEIC, IELTS, Cambridge English, or another selected examination.

```text
Timed attempt
-> Mark uncertain answers
-> Finish the section
-> Analyse errors afterward
-> Retry equivalent questions
```

During a timed attempt, use a compressed process:

```text
CORE -> TERM -> MEANING
```

Apply full `CHUNK` and `LINK` analysis after the attempt or only when a question cannot be answered otherwise.

Exam-specific strategies, including question types, paraphrase recognition, distractor analysis, and time management, belong to a separate `Exam Strategy Layer`. They do not replace the baseline learning process.

---

## 16. Word-by-Word Stop Rule

### Core rule

> Do not translate yet when the sentence structure is still unresolved.

Stop word-by-word translation when any of the following is true:

- the main verb has not been identified;
- the subject is still unclear;
- a technical term has not been grouped correctly;
- the target of `that`, `which`, `it`, `its`, `they`, or `this` is unknown;
- the sentence backbone is unclear;
- a modifying phrase has not been linked to its target;
- the current Vietnamese interpretation requires adding information not found in the source.

### Recovery sequence

```text
Stop translating
-> Find CORE
-> Rebuild CHUNK
-> Identify TERM
-> Resolve LINK
-> Restate the minimum technical meaning
```

### Important distinction

Word-level analysis is allowed for a local problem, such as checking a modal verb, preposition, suffix, or technical term. It must not become the method for understanding the complete sentence.

---

## 17. A6 Admission Rule

Not every completed sentence belongs in the A6 note.

### Add an item to A6 when at least one condition is met

- It contains a reusable language pattern.
- It introduces an important technical term.
- It captures a mistake that has occurred at least twice.
- It records a high-risk technical distinction.
- It provides a short, correct example suitable for active recall.
- It contains a rule that will improve future reading or production.

### Do not add an item when

- it is only a common isolated word;
- it applies to only one source sentence;
- the interpretation is still uncertain;
- the same knowledge is already present in A6;
- the note is too long for quick review;
- it preserves exploration without a reusable conclusion.

### A6 admission check

```text
Reusable?          Yes / No
Technically stable? Yes / No
Concise?            Yes / No
Already recorded?   Yes / No
Useful for recall?  Yes / No
```

An item should normally be admitted only when the first three answers are `Yes`, the fourth is `No`, and the fifth is `Yes`.

---

## 18. Progress Levels

Progress is measured by what the learner can do, not by the number of sentences translated.

| Level | Name | Observable ability |
|---|---|---|
| 1 | Recognise | Recognises a phrase, pattern, or term after it is pointed out |
| 2 | Analyse | Independently identifies the chunks, core, and important links |
| 3 | Interpret | Explains the correct technical meaning without relying on word-by-word translation |
| 4 | Produce | Uses the pattern correctly in a new technical sentence or explanation |

### Completion rule

- A reading pattern is learned when it consistently reaches **Level 3: Interpret**.
- A pattern needed for writing, speaking, or certification production tasks should reach **Level 4: Produce**.

### Worked progression

Source:

> Parameter and return types imply usage dependencies.

```text
Level 1 - Recognise
The learner recognises "usage dependency" as one technical term.

Level 2 - Analyse
[Parameter and return types] [imply] [usage dependencies]

Level 3 - Interpret
The learner explains that types used in an operation signature create implicit usage dependencies.

Level 4 - Produce
Attribute types may also imply structural relationships.
```

---

## 19. Diagnose the Source of Difficulty

Not every misunderstanding is an English-language problem. Classify the difficulty before correcting it.

| Problem type | Description | Example | Response |
|---|---|---|---|
| Language problem | Grammar, vocabulary, reference, or sentence structure is unclear | The learner cannot identify what `that` refers to | Apply CHUNK, CORE, LINK, or a Supplementary Lesson |
| Domain knowledge problem | The sentence is grammatically understood, but the technical concept is unknown | The learner does not understand `usage dependency` in UML | Review the relevant domain rule and then reread the sentence |
| Source-quality problem | The source is ambiguous, incomplete, inconsistent, or depends heavily on missing context | `Every element needed` does not define the allowed design boundary | Record the ambiguity, inspect referenced material, and avoid inventing certainty |

### Diagnostic questions

```text
Can I identify the sentence backbone?
-> No: likely a language problem.

Can I translate the sentence but not explain the technical rule?
-> Yes: likely a domain knowledge problem.

Can multiple technically reasonable interpretations remain after language and domain review?
-> Yes: likely a source-quality problem.
```

Do not automatically conclude that weak understanding means weak English. Technical documents themselves can be unclear or context-dependent.

---

## 20. Quick and Deep Lesson Templates

### 20.1 Quick Lesson Template

Use for daily learning, short sentences, and one-error correction.

```markdown
# Sentence

[Original sentence]

## READ

- Chunks:
- Core:
- Terms:

## GUESS

- My meaning:

## REVISE

- Error type:
- Correction:
- Reason:

## FINAL

- Correct meaning:
- Reusable rule:
- Progress level: 1 / 2 / 3 / 4
- Add to A6: Yes / No
```

### 20.2 Deep Lesson Template

Use the complete template in Section 11 when:

- the sentence contains multiple clauses;
- a modifier or reference is difficult to resolve;
- the same problem has appeared repeatedly;
- the sentence carries an important technical or architectural rule;
- the lesson requires interpretation and production practice;
- a Supplementary Lesson may be needed.

### Template selection rule

```text
One sentence + one clear error
-> Quick Lesson

Multiple links, repeated error, important rule, or unresolved meaning
-> Deep Lesson
```

---

## 21. Version 2.1 Operating Baseline

### Daily default

```text
CHUNK -> CORE -> TERM -> GUESS -> REVISE
```

### Expand when needed

```text
LINK -> MEANING -> TRY -> FINALIZE -> A6
```

### Mode selection

```text
New or difficult knowledge -> Learning Mode
Continuous document reading -> Reading Mode
Timed certification work   -> Exam Mode
```

### Final safeguards

```text
Do not translate before finding the sentence structure.
Do not treat every difficulty as an English problem.
Do not finalize uncertain knowledge.
Do not add every sentence to A6.
Do not use full analysis when a lighter process is sufficient.
```

This Version 2.1 operating baseline supersedes the Version 2.0 daily workflow while preserving its full process, error taxonomy, review cycle, Supplementary Lessons, and deep lesson template.
