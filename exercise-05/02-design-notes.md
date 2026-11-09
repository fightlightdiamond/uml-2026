# Exercise 5 — Design notes

_Open modeling point:_ R11 remains «TBC»: deleting a column does not yet define what happens to its tasks. `Column`–`Task` stays a plain Association.

_Level 1 scope:_ `Board` has `id` and `name` only. `Board.isArchived` (R8) belongs in Part II / Capstone, not this diagram.

## Elements added beyond Handbook Figures 7.1, 8.1, 9.1

| Element | Evidence |
|---|---|
| `TaskService.updateTask(task, input) : TaskResult` | R2; Exercise 3 |
| `TaskService.loadBoard(id) : Board` and `ITaskRepository.loadBoard(id) : Board` | Exercise 3 / 6: board loaded from storage before edit |
| Task → Member navigable Association (`assignee`) | R1, R4; Exercise 4 |
| `TaskService` → `NotificationService` Dependency «use» | R4; Exercise 4 |

## Conventions

- `-validate` is private: only `TaskService` calls it.
- Each operation has one return type for all outcomes (`TaskResult`, `MoveResult`).
- No Dependency lines to parameter/return types (`TaskInput`, `Priority`, result classes).
