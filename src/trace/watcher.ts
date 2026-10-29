// Watches `<project>/.ctx-tracker/trace.jsonl` and re-parses on change.
// Pure Node (fs) — no vscode import, headless-testable.

import * as fs from 'fs';
import * as path from 'path';
import { parseTraceJsonl, ParsedRun, ParseWarning } from './store';

export interface TraceUpdate {
  runs: ParsedRun[];
  warnings: ParseWarning[];
}

export interface TraceWatcherEvents {
  onUpdate(update: TraceUpdate): void;
  onError?(err: Error): void;
}

export interface TraceWatcher {
  refresh(): Promise<void>;
  dispose(): void;
}

export function watchTraceFile(
  traceFile: string,
  events: TraceWatcherEvents,
  opts: { debounceMs?: number } = {},
): TraceWatcher {
  const debounceMs = opts.debounceMs ?? 150;
  const wanted = path.basename(traceFile);
  let timer: NodeJS.Timeout | null = null;
  let disposed = false;
  let watcher: fs.FSWatcher | null = null;

  const refresh = async (): Promise<void> => {
    if (disposed) {
      return;
    }
    try {
      const text = await fs.promises.readFile(traceFile, 'utf8').catch((err: unknown) => {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
          return '';
        }
        throw err;
      });
      events.onUpdate(parseTraceJsonl(text));
    } catch (err) {
      events.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const schedule = (): void => {
    if (disposed) {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void refresh();
    }, debounceMs);
  };

  try {
    watcher = fs.watch(path.dirname(traceFile), (_eventType, filename) => {
      if (filename === wanted || filename === null) {
        schedule();
      }
    });
    watcher.on('error', (err) => events.onError?.(err));
  } catch (err) {
    events.onError?.(err instanceof Error ? err : new Error(String(err)));
  }

  return {
    refresh,
    dispose: () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      watcher?.close();
      watcher = null;
    },
  };
}
