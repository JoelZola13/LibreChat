/**
 * Re-export from canonical location
 */
export { ThemeProvider, useTheme, ThemeContext } from '../app/providers/theme-provider';

export const isDarkTheme = (theme: string | null | undefined) => theme !== 'light';
