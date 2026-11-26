# Phase 11.2D.5 — Temporary media cleanup and cooperative locking

## Scope and configuration

All built-in uploads and `EditorMediaService::finalize()` mutations use the same per-configured-disk Laravel atomic cache lock, including the D4 compensation phase. Cleanup takes that lock for one candidate at a time, not for the whole scan. A competing upload returns HTTP 503 with Retry-After: 1, finalization throws `MediaStorageBusyException`, and cleanup skips a busy candidate. A cache failure is not permission to proceed without a lock. A successful or failed callback releases only its own lock; never force-release another worker's lock.

The new configuration section is `tiptap-editor.media_lock`, with `store` (null means the default Laravel cache store) and `seconds` (default 300, valid 30–3600). Environment keys: `TIPTAP_EDITOR_MEDIA_LOCK_STORE` and `TIPTAP_EDITOR_MEDIA_LOCK_SECONDS`. Previously published configurations use these default values if the section is missing. An explicitly named store must exist. Choose a single reliable lock-capable backend; for multiple nodes all workers must share the same cache server, lock prefix and configured disk name. Redis or a suitably configured database cache is appropriate; file cache only coordinates workers sharing that filesystem. Array cache is accepted for automated tests only, null cache is rejected. Do not use a failover cache that can switch lock backends during a batch. Ensure database lock tables exist before enabling database cache. Avoid flushing the coordination cache while media operations are active.

The lease must exceed the longest upload/finalization/rollback or per-file cleanup operation. The mutex is nonblocking and leased, not a distributed transaction or fencing token. Process crashes, cache eviction/flush, lease expiry, aliases to the same physical disk, other applications sharing storage without the same lock key and external writers can still race. No guaranteed isolation is claimed beyond cooperating operations on a healthy common cache within the lease. Configure one disk name per physical storage namespace. `allFiles()` still lists the entire temporary directory; large storage needs a later paginated cleanup design.

## Cleanup eligibility and command

The existing `cleanupTemporaryMedia(?int $olderThanHours = null): int` API is unchanged. Lifetime is 1–87600 hours; invalid values fail rather than silently reduce retention. The existing hourly schedule remains unchanged. Run the command only against the intended storage disk, after backups and a retention review:

```
php artisan tiptap-editor:cleanup --hours=24
```

The command deletes canonical direct legacy flat files and direct files under `owner-<64 lowercase hex>` directories only. Unknown nested files are skipped. Listing is advisory; under the lock it checks file type and last-modified time before deletion. The expiry boundary is inclusive. Repeated listing entries are deduplicated. The count includes only acknowledged deletion with verified absence; metadata and deletion exceptions are reported through Laravel's exception handler and are not counted. The command's count is not a complete operational health indicator; monitor logs. If the mutex is unavailable due to contention, candidates are skipped until a later run. It does not remove directories or permanent media. It does not keep drafts alive; old unfinalized files can still expire, even if a user intends to edit them later. Save or reupload before retention expires. It does not establish physical symlink/junction containment; use a trusted disk root, disallow links and out-of-band writers.

## Host custom upload integration (11.2H)

Custom upload controllers are not intercepted automatically. Use the same configured guard and TemporaryMediaOwner directory, and wrap only the filesystem mutation in `MediaStorageLock::run($diskName, fn () => ...);`. Do not wrap calls to `finalize()` or `cleanupTemporaryMedia()` in this non-reentrant lock; they acquire it themselves. Handle busy exceptions as a retryable operation. This candidate is not published yet; do not install it into MWT or other hosts until integration and release gates pass. Host DB rollback and durable recovery are not supplied here.

## Local QA

In the standalone editor only: verify existing 11.2D.4 baseline, run installer preview and actual install, then `composer validate --strict`, `composer dump-autoload --optimize --strict-psr`, `vendor\bin\phpunit --filter="TemporaryMediaCleanupTest|MediaPathBoundaryTest|MediaMoveBatchTest|ManagedMediaFinalizationTest" --stop-on-failure --stop-on-error`, `composer test:13`, `composer audit`, `composer check-platform-reqs`. Repeat full tests/audit/platform/strict autoload after switching to Laravel 12 with the established temporary Composer constraints. Tests use fake storage, array locks, and mocks. They demonstrate same-process contention, not cross-process/Redis concurrency. Production shared backend validation remains a release/integration gate.
