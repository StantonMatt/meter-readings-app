// src/theme.ts
import { createTheme } from "@mui/material/styles";

// Create a proper theme with better contrast
const theme = createTheme({
  palette: {
    mode: "light", // Change to light mode if everything was too dark
    primary: {
      main: "#2196f3", // Standard blue - adjust as needed
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f50057", // Standard pink - adjust as needed
      contrastText: "#ffffff",
    },
    background: {
      default: "#f5f5f5", // Light gray background
      paper: "#ffffff", // White paper/card background
    },
    text: {
      primary: "#333333", // Dark text for light mode
      secondary: "#757575", // Medium gray for secondary text
    },
  },
  typography: {
    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    h1: {
      fontSize: "2.5rem",
      fontWeight: 500,
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 500,
    },
    h3: {
      fontSize: "1.8rem",
      fontWeight: 500,
    },
    h4: {
      fontSize: "1.6rem",
      fontWeight: 500,
    },
    h5: {
      fontSize: "1.4rem",
      fontWeight: 500,
    },
    h6: {
      fontSize: "1.2rem",
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none", // Don't uppercase button text
          borderRadius: 4,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Rounded corners on cards
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)", // Subtle shadow
        },
      },
    },
  },
});

export default theme;
