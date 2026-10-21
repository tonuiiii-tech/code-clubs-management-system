/**
 * STEAMLabs UI kit setup (D1-9, D1-10).
 *
 * We import tokens.css + components.css instead of styles.css, because styles.css
 * loads Poppins from Google Fonts, which fails without internet. Poppins is
 * self-hosted through @fontsource so the service worker can cache it.
 */
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import 'steamlabsui/tokens.css';
import 'steamlabsui/components.css';
import './app.css';

export { ThemeProvider } from 'steamlabsui';

/** Base STEAMLabs theme; a program theme can be chosen later. */
export const APP_THEME = undefined;
