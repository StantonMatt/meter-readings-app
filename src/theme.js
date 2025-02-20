// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light', // overall app uses a light palette
    primary: {
      main: '#1976d2', // or any accent color you like
    },
    background: {
      default: '#F2F2F2', // main page background
      paper: '#FFFFFF',   // normal Paper surfaces
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
    },
  },
  typography: {
    fontFamily: 'Inter, sans-serif', // or 'Poppins, sans-serif'
    button: {
      textTransform: 'none',
    },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          // Force a dark background for the sidebar
          backgroundColor: '#1E1E1E',
          color: '#FFFFFF', // ensures default text is bright
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        },
      },
    },
  },
});

export default theme;
