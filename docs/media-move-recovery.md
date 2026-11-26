# 11.2D.4 — Media move compensation and recovery

Install into the standalone editor only. Preview with `Install-TiptapPhase112D4.ps1 -ProjectRoot <path> -WhatIf` first. No Composer manifest or frontend changes.

`EditorMediaService::finalize()` retains its signature. It prepares and serializes all HTML before calling the internal `MediaMoveBatch` executor. The executor rechecks source-file existence and destination absence immediately before each move, records acknowledged moves, and verifies source absence and destination-file existence after each successful call. On a false return, thrown exception, or postcondition failure, it attempts to reverse acknowledged moves in reverse order. Each reversal is checked; restoration continues even if another reversal fails. It never calls delete and never deliberately overwrites an occupied original path.

The original failure is available as `getPrevious()` on `MediaFinalizationException` (a `RuntimeException`). `requiresRecovery()`, `diskName()`, and `recoveryEntries()` expose recovery details for trusted host operators. A failed batch never returns rewritten HTML. A failed/throwing forward move whose final state cannot be verified as unchanged is reported, not automatically reversed. This protects both copies if a storage implementation copied the file but did not finish deleting its source. A reverse move which reports an error after completing can be recognized as restored by checking the resulting paths.

## Recovery guidance

- Catch or report `MediaFinalizationException` in host save flows; do not save the rewritten HTML on failure. Return a generic error to users, not raw exception data or storage paths.
- For `requiresRecovery() === false`, no unresolved **attempted** pair was detected by existence checks; inspect the underlying error and source availability before retrying. This is not a content-integrity verification.
- For `requiresRecovery() === true`, retain the recovery entries in restricted operational logs or a durable host incident record. Inspect both locations on the named disk, compare contents and backups, and restore under exclusive maintenance when safe. Never blindly overwrite or delete a file. If only the destination exists and its identity is confirmed, restore it to its original unoccupied path. If both exist, reconcile manually. Do not retry the original save until recovered or media is re-uploaded.
- Recovery entries are in memory, not a durable journal. If the process dies, the caller must reconcile using independent operational records/backups.

## Limits

This is best-effort compensation, not a filesystem or database transaction. Existence checks do not verify file identity, hashes, or durability; a backend can return stale metadata. There is no atomic no-overwrite operation or lock across workers; another writer or cleanup process can race checks and moves. Only use a trusted storage adapter and exclusively controlled media directories. Cleanup coordination is a later phase. This does not resolve symlink/junction risks, external storage writers, process crashes, or failed host database commits after `finalize()` returns. Host save-transaction coordination must be implemented separately; no automatic database rollback or durable recovery is claimed. Intermediate package is not a production release.

## QA

Run `composer validate --strict`, `composer dump-autoload --optimize --strict-psr`, and `vendor\bin\phpunit --filter="MediaMoveBatchTest|ManagedMediaFinalizationTest" --stop-on-failure --stop-on-error`. Expected 28 cases. Run `composer test:13` and `composer test:12` using the appropriate resolved stacks, plus `composer audit`, platform requirements and strict autoload on both. Expected total 111 cases each.
