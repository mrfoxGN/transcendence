import { Monitor, Moon, Sun } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
type Theme = 'light' | 'dark' | 'system';
const key = 'devup.entry-theme';
const Context = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
});
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(key);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}
export function EntryAppearance({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(initialTheme);
  const [browserDark, setBrowserDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [chosen, setChosen] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setBrowserDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const token = sessionStorage.getItem('devup.access-token');
    if (!token || chosen) return;
    const controller = new AbortController();
    void fetch('/api/auth/profile', {
      headers: { Authorization: 'Bearer ' + token },
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (!controller.signal.aborted && ['light', 'dark', 'system'].includes(profile?.theme))
          updateTheme(profile.theme);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [chosen]);
  function setTheme(next: Theme) {
    setChosen(true);
    updateTheme(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* Private browsing can disable storage. */
    }
  }
  return (
    <Context.Provider value={{ theme, setTheme }}>
      <div
        className="entry-experience"
        data-theme={theme === 'system' ? (browserDark ? 'dark' : 'light') : theme}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
export function EntryThemeControl() {
  const { theme, setTheme } = useContext(Context);
  return (
    <fieldset className="entry-theme-control">
      <legend className="entry-sr-only">Appearance</legend>
      {(
        [
          { value: 'light', label: 'Light', Icon: Sun },
          { value: 'dark', label: 'Dark', Icon: Moon },
          { value: 'system', label: 'System', Icon: Monitor },
        ] as const
      ).map(({ value, label, Icon }) => (
        <label key={value} title={label} data-selected={theme === value}>
          <input
            type="radio"
            name="entry-theme"
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
          />
          <Icon size={16} aria-hidden="true" />
          <span className="entry-sr-only">{label} theme</span>
        </label>
      ))}
    </fieldset>
  );
}
