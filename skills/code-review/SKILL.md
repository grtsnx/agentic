---
name: code-review
description: Review supplied code for concrete correctness, security, cancellation, concurrency, and maintainability issues. Use when asked for a code review.
---

Read the supplied code and relevant context before making claims. If context is missing, identify it explicitly.

1. Find concrete bugs, security issues, missing validation, unsafe retries, race conditions, and resource leaks.
2. Explain each finding using its trigger, impact, and the smallest useful correction. Cite file names and line numbers when available.
3. Separate verified behavior from assumptions. Say which tests ran and what remains unverified.
4. Avoid speculative refactors or style-only findings. Prefer simple fixes and existing shared behavior.

Use only tools already authorized by the application. This skill grants no permission to modify files, send messages, run commands, or bypass approval cards.
