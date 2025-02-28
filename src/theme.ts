// src/theme.ts
import { createTheme, alpha } from "@mui/material/styles";

// Color palette definition
const palette = {
  // Primary colors
  primary: {
    main: "#334155", // Slate blue-grey
    light: "#475569",
    dark: "#1e293b",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  // Secondary colors
  secondary: {
    main: "#0ea5e9", // Vibrant blue
    light: "#38bdf8",
    dark: "#0284c7",
    100: "#e0f2fe",
    200: "#bae6fd",
    300: "#7dd3fc",
    400: "#38bdf8",
    500: "#0ea5e9",
    600: "#0284c7",
    700: "#0369a1",
    800: "#075985",
    900: "#0c4a6e",
  },
  // Semantic colors
  semantic: {
    success: {
      main: "#10b981",
      light: "#34d399",
      dark: "#059669",
      background: "#ecfdf5",
      border: "#a7f3d0",
    },
    warning: {
      main: "#f59e0b",
      light: "#fbbf24",
      dark: "#d97706",
      background: "#fffbeb",
      border: "#fcd34d",
    },
    error: {
      main: "#ef4444",
      light: "#f87171",
      dark: "#dc2626",
      background: "#fef2f2",
      border: "#fecaca",
    },
    info: {
      main: "#3b82f6",
      light: "#60a5fa",
      dark: "#2563eb",
      background: "#eff6ff",
      border: "#bfdbfe",
    },
  },
  // Consumption status colors
  consumption: {
    normal: {
      main: "#10b981",
      background: "#ecfdf5",
      border: "#a7f3d0",
    },
    low: {
      main: "#3b82f6",
      background: "#eff6ff",
      border: "#bfdbfe",
    },
    high: {
      main: "#64748b",
      background: "#f8fafc",
      border: "#e2e8f0",
    },
    negative: {
      main: "#ef4444",
      background: "#fef2f2",
      border: "#fecaca",
    },
    estimated: {
      main: "rgba(79, 70, 229, 0.9)",
      background: "rgba(79, 70, 229, 0.1)",
      border: "rgba(79, 70, 229, 0.3)",
    },
  },
  // Neutral colors
  neutral: {
    white: "#ffffff",
    background: "#f1f5f9",
    paper: "#ffffff",
    border: "#e2e8f0",
    divider: "#e2e8f0",
    text: {
      primary: "#334155",
      secondary: "#64748b",
      disabled: "rgba(0, 0, 0, 0.38)",
    },
  },
};

// Create the theme
const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: palette.primary.main,
      light: palette.primary.light,
      dark: palette.primary.dark,
      contrastText: palette.neutral.white,
    },
    secondary: {
      main: palette.secondary.main,
      light: palette.secondary.light,
      dark: palette.secondary.dark,
      contrastText: palette.neutral.white,
    },
    background: {
      default: palette.neutral.background,
      paper: palette.neutral.paper,
    },
    success: {
      main: palette.semantic.success.main,
      light: palette.semantic.success.light,
      dark: palette.semantic.success.dark,
    },
    warning: {
      main: palette.semantic.warning.main,
      light: palette.semantic.warning.light,
      dark: palette.semantic.warning.dark,
    },
    error: {
      main: palette.semantic.error.main,
      light: palette.semantic.error.light,
      dark: palette.semantic.error.dark,
    },
    info: {
      main: palette.semantic.info.main,
      light: palette.semantic.info.light,
      dark: palette.semantic.info.dark,
    },
    text: palette.neutral.text,
  },
  typography: {
    fontFamily: ["Inter", "Roboto", "Helvetica", "Arial", "sans-serif"].join(
      ","
    ),
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 16px",
          boxShadow: "none",
          fontWeight: 500,
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            transform: "translateY(-1px)",
          },
          transition: "all 0.2s ease-in-out",
        },
        contained: {
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        },
        elevation1: {
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        },
        elevation2: {
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: "none",
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          overflow: "hidden",
          transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
          "&:hover": {
            boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
            transform: "translateY(-2px)",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderWidth: 2,
              borderColor: palette.primary.main,
            },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          boxShadow: "0 0 20px rgba(0,0,0,0.08)",
          borderRight: "none",
          backgroundColor: palette.primary.main,
          color: palette.neutral.white,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: "4px 8px",
          color: alpha(palette.neutral.white, 0.85),
          "&.Mui-selected": {
            backgroundColor: alpha(palette.neutral.white, 0.12),
            color: palette.neutral.white,
            "&:hover": {
              backgroundColor: alpha(palette.neutral.white, 0.18),
            },
          },
          "&:hover": {
            backgroundColor: alpha(palette.neutral.white, 0.08),
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontWeight: 500,
        },
        secondary: {
          color: alpha(palette.neutral.white, 0.65),
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: "16px",
        },
        head: {
          fontWeight: 600,
          backgroundColor: palette.neutral.background,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
  },
});

// Export both theme and palette for use in components
export { palette };
export default theme;
