# Completed Development Tasks

This document is an archive of completed tasks.

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