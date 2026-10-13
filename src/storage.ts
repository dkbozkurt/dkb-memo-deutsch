const PREFIX = 'memo-deutsch:v1';

/** Best-effort localStorage: private mode or blocked storage must not break the game. */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${PREFIX}:${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};
