export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;
