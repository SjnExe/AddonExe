# Completed Development Tasks

This document is an archive of completed tasks.

---

**Task:** Fix `/test` command and update API docs

**Objective:** Correct the `/test` command to use `world.sendMessage` instead of the non-existent `world.say`, and update the API documentation to reflect this finding from the latest test run.

**Assignee:** Jules
**Status:** Completed
---

**Task:** Refactor /test command to remove confirmed APIs

**Objective:** Update the `/test` command to only test unconfirmed APIs, based on the `Dev/DocsExe/MinecraftAPIs.md` document. This helps focus testing efforts on APIs that are not yet validated.

**Assignee:** Jules
**Status:** Completed
---

**Task:** Implement Announcement System

**Objective:** Create a new announcement system with admin-configurable messages and intervals, and a toggle for players to mute announcements. This also included fixing a bug in the dimension locking UI that was discovered during testing.

**Assignee:** Jules
**Status:** Completed
---

**Task:** Final Correction and Harmonization of All Project Documentation

**Objective:** Perform a final, definitive update of all project documentation based on critical user feedback. This included correcting command information, fixing reload instructions, and ensuring all links in the CurseForge description were absolute URLs pointing to the `exe` branch.

**Assignee:** Jules
**Status:** Completed
---

**Task:** Add logging to debug `spawnProtection.js` crash

**Objective:** Add detailed logging to the `itemUseOn` event in `spawnProtection.js` to diagnose a persistent crash. This includes enabling debug mode in the configuration.

**Assignee:** Jules
**Status:** Submitted for testing
---

**Task:** Fix critical error in `spawnProtection.js`

**Objective:** Resolve a crash that occurs when an item is used on an entity instead of a block. This is caused by a missing null check for `event.block` in the `world.beforeEvents.itemUseOn.subscribe` event listener.

**Assignee:** Jules
**Status:** Completed
---