// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import theme from "./theme";
import { Box } from "@mui/material";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          // Subtle gradient from light grey to white
          background: "linear-gradient(120deg, #f3f4f6 0%, #ffffff 100%)",
        }}
      >
        <App />
      </Box>
    </ThemeProvider>
  </React.StrictMode>
);
