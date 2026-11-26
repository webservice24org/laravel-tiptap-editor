<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use Illuminate\Filesystem\FilesystemAdapter;
use MicroWeb\TiptapEditor\Exceptions\MediaFinalizationException;
use MicroWeb\TiptapEditor\Support\MediaMoveBatch;
use Mockery;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class MediaMoveBatchTest extends TestCase
{
    private array $files = ['tmp/a.png' => 'A', 'tmp/b.png' => 'B', 'tmp/c.png' => 'C'];
    private array $directories = [];
    private array $calls = [];
    private array $plan = ['tmp/a.png' => 'images/a.png', 'tmp/b.png' => 'images/b.png', 'tmp/c.png' => 'images/c.png'];

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function adapter(?callable $onMove = null, ?callable $onExists = null): FilesystemAdapter
    {
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('fileExists')->andReturnUsing(fn ($path): bool => isset($this->files[$path]));
        $disk->shouldReceive('exists')->andReturnUsing(function ($path) use ($onExists): bool {
            if ($onExists !== null) {
                $onExists($path);
            }
            return isset($this->files[$path]) || isset($this->directories[$path]);
        });
        $disk->shouldReceive('move')->andReturnUsing(function ($source, $destination) use ($onMove): bool {
            $this->calls[] = [$source, $destination];
            return $onMove === null ? $this->move($source, $destination) : $onMove($source, $destination);
        });
        $disk->shouldNotReceive('delete');
        return $disk;
    }

    private function move(string $source, string $destination): bool
    {
        $this->files[$destination] = $this->files[$source];
        unset($this->files[$source]);
        return true;
    }

    private function failed(FilesystemAdapter $disk): MediaFinalizationException
    {
        try {
            MediaMoveBatch::execute($disk, 'public', $this->plan);
        } catch (MediaFinalizationException $exception) {
            return $exception;
        }
        self::fail('A failed batch must not return success.');
    }

    private function assertOriginalFiles(): void
    {
        $files = $this->files;
        ksort($files);
        self::assertSame(['tmp/a.png' => 'A', 'tmp/b.png' => 'B', 'tmp/c.png' => 'C'], $files);
    }

    public function test_successful_batch_moves_all_files(): void
    {
        MediaMoveBatch::execute($this->adapter(), 'public', $this->plan);
        self::assertSame(['images/a.png' => 'A', 'images/b.png' => 'B', 'images/c.png' => 'C'], $this->files);
        self::assertCount(3, $this->calls);
    }

    public function test_false_on_second_move_restores_first(): void
    {
        $error = $this->failed($this->adapter(fn ($s, $d): bool => $s === 'tmp/b.png' ? false : $this->move($s, $d)));
        self::assertFalse($error->requiresRecovery());
        $this->assertOriginalFiles();
        self::assertSame([['tmp/a.png', 'images/a.png'], ['tmp/b.png', 'images/b.png'], ['images/a.png', 'tmp/a.png']], $this->calls);
    }

    public function test_exception_on_third_move_restores_in_reverse_order_and_preserves_cause(): void
    {
        $cause = new RuntimeException('storage offline');
        $error = $this->failed($this->adapter(function ($s, $d) use ($cause): bool {
            if ($s === 'tmp/c.png') {
                throw $cause;
            }
            return $this->move($s, $d);
        }));
        self::assertSame($cause, $error->getPrevious());
        self::assertFalse($error->requiresRecovery());
        $this->assertOriginalFiles();
        self::assertSame([['images/b.png', 'tmp/b.png'], ['images/a.png', 'tmp/a.png']], array_slice($this->calls, -2));
    }

    public function test_failed_first_move_does_not_touch_other_files(): void
    {
        $error = $this->failed($this->adapter(fn (): bool => false));
        self::assertFalse($error->requiresRecovery());
        $this->assertOriginalFiles();
        self::assertCount(1, $this->calls);
    }

    public function test_failed_rollback_records_pair_and_continues_other_restores(): void
    {
        $error = $this->failed($this->adapter(fn ($s, $d): bool => in_array($s, ['tmp/c.png', 'images/b.png'], true) ? false : $this->move($s, $d)));
        self::assertTrue($error->requiresRecovery());
        self::assertSame('public', $error->diskName());
        self::assertSame([['source' => 'tmp/b.png', 'destination' => 'images/b.png', 'reason' => 'rollback_unconfirmed']], $error->recoveryEntries());
        self::assertSame('A', $this->files['tmp/a.png']);
        self::assertSame('B', $this->files['images/b.png']);
        self::assertSame('C', $this->files['tmp/c.png']);
        self::assertArrayNotHasKey('tmp/b.png', $this->files);
    }

    public function test_unacknowledged_move_that_copied_data_preserves_both_copies(): void
    {
        $error = $this->failed($this->adapter(function ($s, $d): bool {
            if ($s === 'tmp/b.png') {
                $this->files[$d] = $this->files[$s];
                return false;
            }
            return $this->move($s, $d);
        }));
        self::assertSame([['source' => 'tmp/b.png', 'destination' => 'images/b.png', 'reason' => 'unacknowledged_move']], $error->recoveryEntries());
        self::assertSame('B', $this->files['tmp/b.png']);
        self::assertSame('B', $this->files['images/b.png']);
        self::assertSame('A', $this->files['tmp/a.png']);
        self::assertCount(3, $this->calls);
    }

    public function test_throw_after_forward_move_requires_manual_recovery_for_that_pair(): void
    {
        $error = $this->failed($this->adapter(function ($s, $d): bool {
            $this->move($s, $d);
            if ($s === 'tmp/b.png') {
                throw new RuntimeException('ack lost');
            }
            return true;
        }));
        self::assertTrue($error->requiresRecovery());
        self::assertSame('unacknowledged_move', $error->recoveryEntries()[0]['reason']);
        self::assertSame('B', $this->files['images/b.png']);
        self::assertArrayNotHasKey('tmp/b.png', $this->files);
        self::assertSame('A', $this->files['tmp/a.png']);
    }

    public function test_throw_after_successful_reverse_move_is_verified_as_restored(): void
    {
        $error = $this->failed($this->adapter(function ($s, $d): bool {
            if ($s === 'tmp/b.png') {
                return false;
            }
            $this->move($s, $d);
            if ($s === 'images/a.png') {
                throw new RuntimeException('reverse ack lost');
            }
            return true;
        }));
        self::assertFalse($error->requiresRecovery());
        $this->assertOriginalFiles();
    }

    public function test_occupied_original_path_is_not_overwritten_during_rollback(): void
    {
        $error = $this->failed($this->adapter(function ($s, $d): bool {
            if ($s === 'tmp/b.png') {
                $this->files['tmp/a.png'] = 'replacement';
                return false;
            }
            return $this->move($s, $d);
        }));
        self::assertTrue($error->requiresRecovery());
        self::assertSame('replacement', $this->files['tmp/a.png']);
        self::assertSame('A', $this->files['images/a.png']);
        self::assertCount(2, $this->calls);
    }

    public function test_directory_at_original_path_is_not_overwritten(): void
    {
        $error = $this->failed($this->adapter(function ($s, $d): bool {
            if ($s === 'tmp/b.png') {
                $this->directories['tmp/a.png'] = true;
                return false;
            }
            return $this->move($s, $d);
        }));
        self::assertTrue($error->requiresRecovery());
        self::assertSame('A', $this->files['images/a.png']);
        self::assertCount(2, $this->calls);
    }

    public function test_new_destination_collision_is_not_overwritten_and_prior_move_is_restored(): void
    {
        $error = $this->failed($this->adapter(null, function ($path): void {
            if ($path === 'images/b.png') {
                $this->files[$path] = 'unrelated';
            }
        }));
        self::assertFalse($error->requiresRecovery());
        self::assertSame('unrelated', $this->files['images/b.png']);
        self::assertSame('A', $this->files['tmp/a.png']);
        self::assertSame('B', $this->files['tmp/b.png']);
        self::assertCount(2, $this->calls);
    }

    public function test_success_ack_without_actual_move_is_not_accepted(): void
    {
        $error = $this->failed($this->adapter(fn (): bool => true));
        self::assertFalse($error->requiresRecovery());
        $this->assertOriginalFiles();
        self::assertCount(1, $this->calls);
    }
}
