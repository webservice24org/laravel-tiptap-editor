<?php

use Composer\InstalledVersions;

require __DIR__.'/../vendor/autoload.php';

$major = $argv[1] ?? '';
$matrix = ['12' => ['10', '11'], '13' => ['11', '12']];

if (! isset($matrix[$major])) {
    fwrite(STDERR, "Usage: php tools/assert-test-stack.php 12|13\n");
    exit(1);
}

[$testbench, $phpunit] = $matrix[$major];
$expected = ['laravel/framework' => $major, 'orchestra/testbench' => $testbench, 'phpunit/phpunit' => $phpunit];

foreach ($expected as $package => $expectedMajor) {
    $version = InstalledVersions::isInstalled($package) ? InstalledVersions::getVersion($package) : null;
    if ($version === null || explode('.', $version)[0] !== $expectedMajor) {
        fwrite(STDERR, sprintf("Wrong test stack: %s expected %s.x, found %s\n", $package, $expectedMajor, $version ?? 'not installed'));
        exit(1);
    }
    printf("%s: %s\n", $package, $version);
}
printf("PHP: %s\n", PHP_VERSION);
