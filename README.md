# obsidian-debug-logger

Shared in-memory debug logger for Obsidian packages.

## Example

```ts
import { createDebugLogger } from 'obsidian-debug-logger';

const logger = createDebugLogger('Example Plugin', {
  defaultConsoleLevel: 'none',
  bufferSize: 300,
});

logger.scope('Import').warn('Import skipped row', { path: 'Places.csv', row: 42 });

const debugLog = logger.formatForExport();
```