# MicroWeb Laravel Tiptap Editor

Reusable Tiptap rich-text editor for Laravel 12 + React + TypeScript applications.

The package has two parts:

- `microweb/laravel-tiptap-editor` — Laravel backend integration, media lifecycle and server-side HTML sanitization.
- `@microweb/laravel-tiptap-editor` — React/TypeScript editor UI and browser-side HTML sanitization.

## Requirements

- PHP 8.2+
- Laravel 12
- Node.js 20.19+
- React 18.2+ or React 19
- Tiptap 3

## Installation

Install the Laravel package:

```bash
composer require microweb/laravel-tiptap-editor
```

Install the frontend package:

```bash
npm install @microweb/laravel-tiptap-editor
```

Publish the package configuration:

```bash
php artisan vendor:publish --tag=tiptap-editor-config
```

If the `public` disk is used for image uploads:

```bash
php artisan storage:link
```

## React / TSX usage

```tsx
import { useState } from 'react'

import {
    TiptapEditor,
} from '@microweb/laravel-tiptap-editor'

import '@microweb/laravel-tiptap-editor/editor.css'

export default function EditorExample() {
    const [content, setContent] =
        useState('<p>Hello editor.</p>')

    return (
        <TiptapEditor
            value={content}
            onChange={setContent}
            minHeight={400}
        />
    )
}
```

The editor does not depend on Inertia. It can be used in any React host application.

## Image uploads

By default, the frontend uploads images to:

```text
POST /tiptap-editor/media
```

The package route uses Laravel's `web` middleware.

When using the built-in upload endpoint, ensure the host page provides a CSRF token:

```html
<meta name="csrf-token" content="{{ csrf_token() }}">
```

The default public-disk upload response contains:

```json
{
    "url": "/storage/editor/tmp/example.webp",
    "path": "editor/tmp/example.webp",
    "temporary": true
}
```

### Configuration

Published config:

```php
'image_upload' => [
    'enabled' => true,
    'disk' => 'public',
    'temporary_directory' => 'editor/tmp',
    'permanent_directory' => 'editor/images',
    'temporary_lifetime' => 24,
    'delete_unreferenced_on_save' => false,
    'max_size' => 5120,
    'allowed_mimes' => [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
    ],
],
```

Environment overrides:

```dotenv
TIPTAP_EDITOR_UPLOAD_ENABLED=true
TIPTAP_EDITOR_DISK=public
TIPTAP_EDITOR_TEMP_DIRECTORY=editor/tmp
TIPTAP_EDITOR_IMAGE_DIRECTORY=editor/images
TIPTAP_EDITOR_TEMP_LIFETIME=24
TIPTAP_EDITOR_MAX_IMAGE_SIZE=5120
TIPTAP_EDITOR_CLEANUP_SCHEDULE=true
```

## Custom image upload

A host application can replace the built-in endpoint completely:

```tsx
<TiptapEditor
    value={content}
    onChange={setContent}
    onImageUpload={async (file) => {
        const formData =
            new FormData()

        formData.append(
            'image',
            file
        )

        const response =
            await fetch(
                '/your-upload-endpoint',
                {
                    method: 'POST',
                    body: formData,
                }
            )

        return await response.json()
    }}
/>
```

The callback must return:

```ts
{
    url: string
    path?: string
    temporary?: boolean
}
```

You may also change only the built-in upload URL:

```tsx
<TiptapEditor
    imageUploadUrl="/admin/editor/media"
/>
```

## Saving editor HTML safely

Browser sanitization improves UX, but the server-side sanitizer should be treated as authoritative before database storage.

```php
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;

$cleanHtml = app(
    EditorHtmlSanitizer::class
)->sanitize(
    $request->string('content')->toString()
);
```

The sanitizer keeps the package's supported image, video, table and news-block markup while removing unsupported elements, unsafe event attributes, unsafe URLs and unsafe style values.

Embedded iframes are restricted to the package-supported YouTube and Vimeo hosts.

## Finalizing temporary media

Built-in uploads are temporary. On host-model save, sanitize first and then finalize media:

```php
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Services\EditorMediaService;

$cleanHtml = app(
    EditorHtmlSanitizer::class
)->sanitize(
    $data['content']
);

$finalHtml = app(
    EditorMediaService::class
)->finalize(
    html: $cleanHtml,
    directory: 'news/'.$newsPost->id
);

$newsPost->update([
    'content' => $finalHtml,
]);
```

`finalize()` moves only media referenced by `data-mw-path` that is still inside the configured temporary directory. It rewrites the stored path and image URL in the HTML.

The package deliberately does **not** automatically delete previously permanent files that are later removed from editor HTML.

## Temporary-media cleanup

Manual cleanup:

```bash
php artisan tiptap-editor:cleanup
```

Override the age threshold:

```bash
php artisan tiptap-editor:cleanup --hours=1
```

By default, the package registers this command with Laravel's scheduler once per hour.

The host application still needs Laravel's scheduler to be running. During local development:

```bash
php artisan schedule:work
```

For production, configure Laravel's normal scheduler cron entry.

Automatic registration can be disabled:

```dotenv
TIPTAP_EDITOR_CLEANUP_SCHEDULE=false
```

## News Block integration

The editor is intentionally independent of any `NewsPost` model. The host provides search behavior:

```tsx
<TiptapEditor
    value={content}
    onChange={setContent}
    onNewsSearch={async (query) => {
        const response =
            await fetch(
                `/admin/news/search?q=${encodeURIComponent(query)}`
            )

        return await response.json()
    }}
/>
```

Each search result should use the public news-block shape:

```ts
{
    id?: string | number
    title: string
    url: string
    thumbnail?: string
    category?: string
    excerpt?: string
    style?: 'card' | 'compact' | 'featured'
}
```

## Public JavaScript API

```ts
import {
    TiptapEditor,
    sanitizeEditorHtml,
    createEditorExtensions,
} from '@microweb/laravel-tiptap-editor'
```

Public TypeScript types include:

```ts
EditorExtensionOptions
EditorMode
TiptapEditorProps
ImageData
ImageUploadResult
NewsBlockData
NewsBlockStyle
NewsSearchHandler
NewsSearchResult
```

Internal toolbar, dialog and NodeView components are intentionally not part of the public API.

## Development

Install frontend dependencies:

```bash
npm install
```

Type-check:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Create an npm release archive for consumer testing:

```bash
npm pack
```

For local consumer testing, prefer installing the generated `.tgz` archive rather than installing the package directory directly. This avoids duplicate React instances during local linked-package development.

## Release checklist

Before tagging `v1.0.0`:

- `composer validate`
- `composer dump-autoload`
- `npm run typecheck`
- `npm run build`
- `npm pack`
- inspect the npm tarball contents
- install the `.tgz` into a separate Laravel + React consumer app
- verify text formatting and links
- verify image upload, free resize and text wrapping
- verify video insertion, contextual toolbar and wrapping
- verify tables and table properties
- verify News Block manual insertion
- verify Visual ↔ Code round-trip
- verify browser sanitization
- verify server sanitization
- verify temporary upload finalization
- verify `tiptap-editor:cleanup`
- verify `php artisan schedule:list`
- verify `php artisan route:list --name=tiptap-editor.media`
- tag the Composer release
- publish the npm package

## License

MIT
