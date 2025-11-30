# Agent Instructions for Task Management (Dev/tasks/)

This document provides guidelines for maintaining the task management files within the `Dev/tasks/` directory: `todo.md`, `ongoing.md`, and `completed.md`.

**These instructions apply to AI agents and human developers collaborating on this project.** Consistent task tracking is crucial for project clarity and progress.

## Task Management Workflow:

1. **Adding New Tasks:**
   - All new tasks, ideas, or bugs should initially be added to `Dev/tasks/todo.md`.
   - Use Markdown bullet points (`- ` or `* `).
   - Prefix tasks with a priority indicator if known:
     - `(High)`: Critical tasks, blockers.
     - `(Medium)`: Important tasks, regular features/bugs.
     - `(Low)`: Minor tasks, enhancements, documentation.
   - Provide a concise but clear description of the task.
   - If the task relates to a specific file or line number, include that as context (e.g., `(Context: README.md:2)`).
2. **Starting a Task:**
   - When a task is selected to be worked on, move it from `Dev/tasks/todo.md` to `Dev/tasks/ongoing.md`.
   - Remove the task entry from `todo.md`.
   - Add the task entry to `ongoing.md`.
   - It's helpful to add your name or the agent's identifier next to the task in `ongoing.md`.
3. **Completing a Task:**
   - Once a task is finished and verified (e.g., code committed, changes tested), move it from `Dev/tasks/ongoing.md` to `Dev/tasks/completed.md`.
   - Remove the task entry from `ongoing.md`.
   - Add the task entry to `completed.md`.
   - Consider adding a completion date or a link to the relevant commit/PR in `completed.md` for future reference, though this is optional.
4. **Pausing or Deferring a Task:**
   - If an ongoing task is paused, blocked, or deferred, move it from `Dev/tasks/ongoing.md` back to `Dev/tasks/todo.md`.
   - Remove the task entry from `ongoing.md`.
   - Add the task entry back to `todo.md`, ensuring its priority and description are still accurate.

## General Guidelines:

- **Keep it Updated:** Regularly review and update these files to reflect the current state of development.
- **Clarity is Key:** Write task descriptions that are easy to understand.
- **One Task, One Place:** A task should only exist in one of the three files at any given time.
- **`todo.md` Structure:** `todo.md` can be organized with subheadings (e.g., `## Documentation Tasks`, `## Bug Fixes`) for better readability if the list becomes long.

By following these guidelines, we can maintain an effective and transparent task management system.
