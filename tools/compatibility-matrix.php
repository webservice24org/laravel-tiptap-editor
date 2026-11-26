<?php

declare(strict_types=1);

// Dependency-free: usable before Composer installs vendor/.
function matrixFail(string $message): never
{
    fwrite(STDERR, "Compatibility matrix: $message\n");
    exit(1);
}

function matrixJson(string $path): array
{
    $raw = file_get_contents($path);
    if ($raw === false) {
        matrixFail("Cannot read $path");
    }
    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        matrixFail($error->getMessage());
    }
    if (! is_array($data)) {
        matrixFail("Expected JSON object in $path");
    }
    return $data;
}

$composer = matrixJson(__DIR__.'/../composer.json');
foreach ([
    'require' => ['php' => '^8.2', 'laravel/framework' => '^12.0 || ^13.0', 'ext-dom' => '*', 'ext-fileinfo' => '*', 'ext-libxml' => '*'],
    'require-dev' => ['orchestra/testbench' => '^10.0 || ^11.0', 'phpunit/phpunit' => '^11.5.50 || ^12.0'],
] as $section => $constraints) {
    foreach ($constraints as $package => $constraint) {
        if (($composer[$section][$package] ?? null) !== $constraint) {
            matrixFail("Composer constraint drift: $section/$package; review the matrix intentionally.");
        }
    }
}
if (($composer['name'] ?? null) !== 'microweb/laravel-tiptap-editor') {
    matrixFail('Wrong package.');
}
if (isset($composer['config']['platform']['php'])) {
    matrixFail('Do not emulate PHP with config.platform.php in the compatibility matrix.');
}
foreach (['12', '13'] as $major) {
    if (($composer['scripts']['test:'.$major] ?? null) !== ['@php tools/assert-test-stack.php '.$major, '@test']) {
        matrixFail("Missing or changed guarded test:$major script.");
    }
}
if (($composer['scripts']['test'] ?? null) !== '@php vendor/bin/phpunit') {
    matrixFail('Missing or changed full test script.');
}

$data = matrixJson(__DIR__.'/compatibility-matrix.json');
if (($data['schema_version'] ?? null) !== 1 || ! isset($data['lanes']) || ! is_array($data['lanes']) || ! array_is_list($data['lanes'])) {
    matrixFail('Invalid matrix schema.');
}
$expected = [];
foreach ([['12', [2, 3, 4, 5], '^10.0', '^11.5.50'], ['13', [3, 4, 5], '^11.0', '^12.0']] as [$major, $minors, $testbench, $phpunit]) {
    foreach ($minors as $minor) {
        foreach ($minor === $minors[0] ? ['latest', 'lowest'] : ['latest'] as $policy) {
            $id = "laravel-$major-php-8$minor-$policy";
            $expected[$id] = [
                'id' => $id, 'php' => "8.$minor", 'laravel' => $major,
                'framework' => "^$major.0", 'testbench' => $testbench,
                'phpunit' => $phpunit, 'policy' => $policy, 'required' => $policy === 'latest',
            ];
        }
    }
}
$actual = [];
foreach ($data['lanes'] as $lane) {
    if (! is_array($lane) || ! is_string($lane['id'] ?? null)) {
        matrixFail('Invalid lane.');
    }
    $id = $lane['id'];
    if (isset($actual[$id]) || ! isset($expected[$id])) {
        matrixFail("Duplicate or unsupported lane: $id");
    }
    $canonical = $expected[$id];
    ksort($canonical);
    $sorted = $lane;
    ksort($sorted);
    if ($sorted !== $canonical) {
        matrixFail("Invalid lane definition: $id");
    }
    $actual[$id] = $lane;
}
if (count($actual) !== count($expected)) {
    matrixFail('Required lane or lower-bound probe missing.');
}

$mode = $argv[1] ?? '--check';
if ($mode === '--check' && $argc <= 2) {
    echo "Matrix valid: 7 required latest-compatible lanes, 2 lower-bound probes.\n";
} elseif (in_array($mode, ['--github', '--github-lowest'], true) && $argc === 2) {
    $policy = $mode === '--github' ? 'latest' : 'lowest';
    echo json_encode(['include' => array_values(array_filter($actual, static fn (array $lane): bool => $lane['policy'] === $policy))], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES), "\n";
} elseif ($mode === '--runtime' && $argc === 3) {
    $id = $argv[2];
    if (! isset($actual[$id])) {
        matrixFail("Unknown lane: $id");
    }
    $php = PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;
    if ($php !== $actual[$id]['php']) {
        matrixFail("Lane $id expects PHP {$actual[$id]['php']}, actual PHP ".PHP_VERSION);
    }
    foreach (['dom', 'fileinfo', 'libxml', 'mbstring', 'xml', 'xmlwriter'] as $extension) {
        if (! extension_loaded($extension)) {
            matrixFail("Missing PHP extension: $extension");
        }
    }
    echo "Runtime valid: $id, PHP ".PHP_VERSION."\n";
} else {
    matrixFail('Usage: php tools/compatibility-matrix.php --check|--github|--github-lowest|--runtime <lane-id>');
}
