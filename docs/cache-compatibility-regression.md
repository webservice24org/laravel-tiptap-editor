# Phase 11.2E.5 — Route and configuration cache compatibility

QA-only change against the accepted 11.2E.2 workflow and green Laravel 12/13 hosted matrix. No production package code, Composer requirements, workflow, or npm files change.

## Isolation and scope

`CacheCompatibilityTest` creates a random, disposable mini Laravel application under the OS temporary directory for each test. It explicitly registers the package provider and a separate host route, uses the actual installed framework, local disposable storage, a file-cache store, a test-only application key, and in-memory sessions. Each invocation of the fixture worker is a separate PHP process using `PHP_BINARY` and Symfony Process. Cache paths point to the disposable app; commands never run against MWT or a real host. A marker guards fixture cleanup in teardown. Do not invoke the worker independently. PHP `proc_open` must be available. No additional dependency is required by the existing Laravel stack.

Five tests cover:

1. Real `config:cache` and `config:clear`, fresh boot cache flags, settings snapshot even after config edits, then restored new configuration, service singletons, scheduled cleanup and named route/limiter.
2. Real `route:cache` and `route:clear`, cached route action, middleware, additive host middleware, unchanged unrelated host middleware, and explicitly observed stale Gate middleware after editing the host config before clearing the route cache.
3. Combined caches: actual HTTP kernel guest rejection, missing Gate rejection, accepted genuine PNG with owner path and response contract, file-cache throttle across independent PHP processes, other-user isolation, and a real cleanup command that preserves a fresh upload.
4. Legacy partial published config: secure guard/ability/rate defaults, both caches, disabled-upload 403 after permission is granted, no stored media.
5. Real `vendor:publish --tag=tiptap-editor-config --force` in the disposable host only, exact published file hash, cache both, clear both, change config, rebuild both, then verify current settings and middleware.

These tests assert CSRF middleware registration; the HTTP kernel runs in the testing environment, so they do not prove real-browser CSRF enforcement. They do not exercise actual MWT configuration, tenant authorization, distributed-cache production load or durable recovery. The previous release limitations still apply. Do not use the force-publish command on real hosts without reviewing their custom configuration.

## Local acceptance (normal Windows CMD, standalone editor root)

```cmd
composer validate --strict
composer dump-autoload --optimize --strict-psr
vendor\bin\phpunit --filter=CacheCompatibilityTest --stop-on-failure --stop-on-error
```

Expected: five targeted tests, 203 cumulative tests (198 previous + five). Use `composer test:12` or `composer test:13` for the installed stack; resolve the other framework with the established Composer `--with` commands and run the same targeted/full tests. Verify Composer audit, platform requirements, strict autoloading in both stacks.

## Hosted acceptance

Review and stage only the two new PHP files and this document. Commit and push to the standalone editor repository, not MWT. Open the fresh Actions run (not a rerun of the old commit). The existing CI workflow discovers seven required lanes and two lower-bound probes; all already run the full PHPUnit suite. Inspect the nine JUnit artifacts for the five new tests and expected 203 total test cases per lane, plus the aggregate gate. Report warnings, failures, and any unexpected skips. Do not disable tests to obtain green status.

## Deployment contract for real hosts (later 11.2H)

Changing `upload_route.guard`, `ability`, or `additional_middleware` changes route metadata. Clearing only the config cache does not rebuild existing routes. During an authorized maintenance deployment, after reviewing configuration and environment, clear route cache and config cache, build config cache first, then route cache. Validate the route and its middleware and perform host-specific authorized and unauthorized smoke tests. Restart long-running workers as required. Do not apply these commands to MWT now; no package release has been authorized. A stale config/route pair is not a supported operating state. This phase demonstrates that behavior rather than automatically detecting or repairing it in production.
