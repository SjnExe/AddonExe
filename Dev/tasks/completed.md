# Completed Development Tasks

This document is an archive of completed tasks.

---

**Task:** Fix critical error in `spawnProtection.js`

**Objective:** Resolve a crash that occurs when an item is used on an entity instead of a block. This is caused by a missing null check for `event.block` in the `world.beforeEvents.itemUseOn.subscribe` event listener.

**Assignee:** Jules
**Status:** Completed
---