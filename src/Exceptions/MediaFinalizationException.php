<?php

namespace MicroWeb\TiptapEditor\Exceptions;

use RuntimeException;
use Throwable;

/** A failed batch. Recovery entries are for trusted operators, not HTTP responses. */
final class MediaFinalizationException extends RuntimeException
{
    /** @param list<array{source: string, destination: string, reason: string}> $recovery */
    public function __construct(
        private readonly string $diskName,
        private readonly array $recovery,
        Throwable $previous,
    ) {
        parent::__construct(
            $recovery === []
                ? 'Unable to finalize editor media. No unresolved attempted moves were detected.'
                : 'Unable to finalize editor media. Manual storage recovery is required.',
            0,
            $previous,
        );
    }

    public function requiresRecovery(): bool
    {
        return $this->recovery !== [];
    }

    public function diskName(): string
    {
        return $this->diskName;
    }

    /** @return list<array{source: string, destination: string, reason: string}> */
    public function recoveryEntries(): array
    {
        return $this->recovery;
    }
}
