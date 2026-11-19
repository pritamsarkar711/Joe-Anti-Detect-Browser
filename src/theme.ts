import { createTheme, responsiveFontSizes, type Theme } from '@mui/material/styles';

/**
 * Material UI theme, modelled on the structure of dunky11/react-saas-template
 * (createTheme + responsiveFontSizes + 8px spacing + custom breakpoints +
 * component overrides), rebuilt for Joe Browser with a single pink primary.
 *
 * Rules enforced here and in styles.css:
 *   one primary colour (pink) · no gradients · 2px radii · IBM Plex Sans
 *   slightly larger Material icons · flat surfaces · HD responsive layout
 */
export const PINK = '#D81B60';

const breakpoints = { xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920 };

export function makeTheme(mode: 'light' | 'dark'): Theme {
  const dark = mode === 'dark';
  const base = createTheme({
    palette: {
      mode,
      primary: { main: PINK, dark: '#AD1457', light: '#F06292', contrastText: '#FFFFFF' },
      // No second chromatic accent: semantic tones stay inside the pink / grey family.
      secondary: { main: dark ? '#9AA1B0' : '#5C6372', contrastText: '#FFFFFF' },
      success: { main: PINK },
      warning: { main: '#AD1457' },
      error: { main: dark ? '#FF6B96' : '#9B123F' },
      info: { main: dark ? '#9AA1B0' : '#5C6372' },
      background: { default: dark ? '#0E1015' : '#F6F7F9', paper: dark ? '#161920' : '#FFFFFF' },
      text: { primary: dark ? '#F2F3F7' : '#1D1F26', secondary: dark ? '#9AA1B0' : '#666C7A' },
      divider: dark ? 'rgba(255,255,255,0.10)' : 'rgba(20,24,34,0.12)',
    },
    breakpoints: { values: breakpoints },
    shape: { borderRadius: 2 },
    spacing: 8,
    typography: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      htmlFontSize: 16,
      fontSize: 14,
      h1: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h2: { fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 },
      h3: { fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.35 },
      h4: { fontSize: '1rem', fontWeight: 600 },
      h5: { fontSize: '0.9rem', fontWeight: 600 },
      h6: { fontSize: '0.82rem', fontWeight: 600 },
      body1: { fontSize: '0.875rem', lineHeight: 1.6 },
      body2: { fontSize: '0.8rem', lineHeight: 1.55 },
      button: { fontSize: '0.8125rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
      caption: { fontSize: '0.72rem', letterSpacing: '0.01em' },
      overline: { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.12em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundImage: 'none', WebkitFontSmoothing: 'antialiased' },
          '::selection': { background: 'rgba(216,27,96,0.20)' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, size: 'medium' },
        styleOverrides: {
          root: { borderRadius: 2, minHeight: 36, paddingInline: 14, boxShadow: 'none', whiteSpace: 'nowrap' },
          containedPrimary: { backgroundImage: 'none', boxShadow: 'none' },
          outlined: { borderWidth: 1 },
          sizeSmall: { minHeight: 30, paddingInline: 10, fontSize: '0.75rem' },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 2 } } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none', borderRadius: 2 }, rounded: { borderRadius: 2 } },
      },
      MuiCard: { styleOverrides: { root: { backgroundImage: 'none', borderRadius: 2, border: '1px solid', borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(20,24,34,0.12)' } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 2, backgroundColor: dark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' },
          notchedOutline: { borderWidth: 1 },
        },
      },
      MuiInputBase: { styleOverrides: { root: { fontSize: '0.85rem' }, input: { paddingBlock: 10 } } },
      MuiInputLabel: { styleOverrides: { root: { fontSize: '0.82rem' } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 2, fontWeight: 600, fontSize: '0.72rem' } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: '1px solid', borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(20,24,34,0.09)', padding: '10px 16px', fontSize: '0.82rem' },
          head: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: dark ? '#9AA1B0' : '#666C7A', backgroundColor: dark ? '#12151C' : '#FAFBFC' },
        },
      },
      MuiTableRow: { styleOverrides: { hover: { backgroundColor: dark ? 'rgba(216,27,96,0.06)' : 'rgba(216,27,96,0.035)' } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 2, margin: 16, width: '100%', backgroundImage: 'none' } } },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: '1rem', fontWeight: 600, padding: '20px 24px 8px' } } },
      MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 16px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px' } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 2, fontSize: '0.72rem', backgroundColor: dark ? '#2B2F3A' : '#242832' } } },
      MuiDivider: { styleOverrides: { root: { borderWidth: 1 } } },
      MuiListItemButton: { styleOverrides: { root: { borderRadius: 2, paddingBlock: 7 } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 42, fontSize: '0.82rem' } } },
      MuiTabs: { styleOverrides: { indicator: { height: 2 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 2, fontSize: '0.82rem' } } },
      MuiSwitch: { defaultProps: { color: 'primary' } },
      MuiCheckbox: { defaultProps: { size: 'small' }, styleOverrides: { root: { padding: 6 } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 2, height: 5 }, bar: { borderRadius: 2 } } },
      MuiCircularProgress: { defaultProps: { thickness: 4 } },
      MuiBottomNavigation: { styleOverrides: { root: { height: 62, borderTop: '1px solid', borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(20,24,34,0.12)' } } },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: { minWidth: 0, padding: '6px 2px', color: dark ? '#818895' : '#6B7280', '&.Mui-selected': { color: PINK } },
          label: { fontSize: '0.62rem', '&.Mui-selected': { fontSize: '0.62rem' } },
        },
      },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none', borderRadius: 0 } } },
      MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none', boxShadow: 'none' } } },
      MuiSelect: { styleOverrides: { select: { paddingBlock: 10 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: '0.84rem', minHeight: 36 } } },
      MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 2 } } },
    },
  });
  return responsiveFontSizes(base);
}
