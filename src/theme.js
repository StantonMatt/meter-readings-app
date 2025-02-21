// src/theme.js
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      // A rich purple/blue from the screenshot
      main: "#5048E5",
    },
    secondary: {
      main: "#10B981",
    },
    background: {
      // Light gray background
      default: "#F9FAFB",
      // White cards, sidebars, etc.
      paper: "#FFFFFF",
    },
    text: {
      primary: "#121828", // darker text
      secondary: "#65748B", // subdued text
    },
  },
  typography: {
    fontFamily: "Inter, sans-serif",
    button: {
      textTransform: "none",
    },
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
    // etc. if you want custom headings
  },
  components: {
    // Example: style the Drawer to be white with subtle shadow
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#FFFFFF",
          color: "#121828",
          borderRight: "1px solid #E6E8F0",
        },
      },
    },
    // Softer card shadows and rounded corners
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          transition: "box-shadow 0.2s ease",
          "&:hover": {
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          },
        },
      },
    },
  },
});

export default theme;
