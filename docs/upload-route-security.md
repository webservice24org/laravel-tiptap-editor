# Phase 11.2C: built-in upload route security (development candidate)

The named POST route `tiptap-editor.media.store` and URI `/tiptap-editor/media`
are unchanged. Its successful JSON response still contains url, path, temporary.
The package now attaches web, auth:<guard>, a named per-user throttle, and
can:<ability>. Default guard web; default Gate ability tiptap-editor.upload;
20 requests per minute. Invalid configuration throws rather than weakening
protection. Additional middleware is additive. Authentication alone is not
sufficient. An undefined ability normally denies access. Review any host
Gate::before hooks, which Laravel applies to this ability as to other Gates.

## Host adoption (later, not during standalone testing)

This is an intentional behavior change for hosts that previously relied on
anonymous or any-authenticated-user uploads. Do not define an always-allow Gate
in production. A host using the built-in endpoint must define the configured
ability in its own provider, using its actual roles/policies. For example,
map tiptap-editor.upload to your existing edit-content permission (not a
hardcoded user ID). If using a separate admin guard, set upload_route.guard
accordingly. Existing published configuration without upload_route gets the
new defaults from the package merge; individual missing keys also have defaults.
Example config section (in the host config/tiptap-editor.php):

```php
'upload_route' => [
    'guard' => 'admin', // must exist in host auth.php
    'ability' => 'products.edit', // must be granted by host Gate/policy
    'attempts_per_minute' => 20,
    'additional_middleware' => [], // e.g. verified if applicable
],
```

The existing image_upload.enabled switch is retained. Guests requesting JSON
receive 401; authenticated users denied by Gate receive 403; authorized users
with uploads disabled receive 403. Browser non-JSON unauthenticated behavior
uses the host's normal Laravel auth redirect. Invalid input returns 422,
rate limit returns 429. Rate limiting counts requests, including invalid ones;
configure a shared cache store for multi-server deployments. Keep normal web
CSRF protection; no CSRF exemptions are introduced. Laravel's test HTTP stack
bypasses CSRF in tests, so these tests do not certify real-browser CSRF behavior.

The host custom imageUploadUrl is unchanged. No global middleware is added;
custom routes must continue enforcing their own authorization and validation.
If no host caller needs the built-in route, disable it with
TIPTAP_EDITOR_UPLOAD_ENABLED=false (verify host custom route behavior first).
Do not force-publish config over a customized host file. Merge keys manually.
After host config/route changes clear and rebuild config/route caches using
normal deployment procedures. Test actual host guard/Gate/custom uploads in
11.2H. This phase does not change media paths, storage lifecycle or HTML
sanitization; 11.2D addresses those risks. Do not publish this candidate yet.

## Local verification

Run the guarded installer in PowerShell, only against standalone editor.
Use normal CMD for Composer. Start with installed Laravel 13 test stack:

```cmd
composer validate --strict
composer test:13
composer audit
composer check-platform-reqs
composer dump-autoload --optimize --strict-psr
```

Then switch standalone dependencies and rerun the entire suite:

```cmd
composer update --with "laravel/framework:^12.0" --with "orchestra/testbench:^10.0" --with "phpunit/phpunit:^11.5.50" --no-interaction
composer test:12
composer audit
composer check-platform-reqs
composer dump-autoload --optimize --strict-psr
```

Expected 21 tests in each environment (9 existing + 12 new), no failures,
errors or security advisories. Tests use fake storage and test-only Gate
callbacks. Custom guard/extra middleware resolver and unrelated host route
isolation are tested; actual host guard configuration and route cache
round-trip are not yet integration-certified. Stop if any test fails and send
its complete output. Optionally return to Laravel 13 with the prior 11.2B
Composer update command and rerun composer test:13.
