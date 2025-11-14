import { createTheme, responsiveFontSizes } from '@mui/material/styles';

const primary = '#0f0f70';
const accent = '#dcdab2';
const neutral = '#b5b6b6';

let theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: primary, dark: '#0a0a4f', contrastText: '#ffffff' },
    secondary: { main: accent, contrastText: primary },
    grey: { 500: neutral },
    background: { default: '#fcfcff', paper: '#ffffff' },
    text: { primary: '#1a1a1a' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", "Noto Sans KR", "Roboto", Arial, sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: `linear-gradient(180deg, rgba(15,15,112,0.03) 0%, rgba(220,218,178,0.03) 60%, rgba(181,182,182,0.02) 100%)`,
        },
        a: { color: primary },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: { backgroundColor: primary },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: `linear-gradient(180deg, rgba(15,15,112,0.02), rgba(220,218,178,0.015))`,
          boxShadow: '0 8px 28px rgba(12,18,60,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: `linear-gradient(90deg, ${primary} 0%, ${primary}cc 100%)`,
          color: '#fff',
          boxShadow: '0 8px 24px rgba(15,15,112,0.12)',
          '&:hover': {
            background: `linear-gradient(90deg, ${primary}cc 0%, ${primary}ff 100%)`,
          },
        },
        outlinedPrimary: {
          borderColor: neutral,
          color: primary,
          '&:hover': { borderColor: primary, background: '#ffffff' },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: { backgroundColor: accent, color: primary },
      },
    },
    MuiChip: {
      styleOverrides: {
        colorPrimary: { backgroundColor: accent, color: primary },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: neutral } },
    },
    MuiTextField: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-root': { background: '#fff', borderRadius: 10 } },
      },
    },
    MuiLink: {
      styleOverrides: { root: { color: primary } },
    },
    MuiAlert: {
      styleOverrides: {
        standardInfo: { backgroundColor: `${accent}33`, color: primary },
      },
    },
  },
});

export default responsiveFontSizes(theme);