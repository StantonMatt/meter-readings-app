// src/TopBar.jsx
import React, { useCallback, useRef } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";

// Define the drawer width to match Layout.jsx
const drawerWidth = 300;

// Simple debounce implementation
function useDebounce(callback, delay) {
  const timeoutRef = useRef(null);

  return useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

function TopBar({
  onHomeClick,
  onSummaryClick,
  showButtons,
  currentScreen,
  onMenuClick,
  showMenuButton,
  searchTerm,
  onSearchChange,
  isMobile,
}) {
  // Debounce search input
  const debouncedSearchChange = useDebounce(
    (value) => onSearchChange(value),
    300
  );

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      debouncedSearchChange(value);
    },
    [debouncedSearchChange]
  );

  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: "#0A0E17", // Match sidebar color
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          gap: 2,
          pl: { sm: "12px" }, // Reduce left padding on desktop
        }}
      >
        {showMenuButton && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {currentScreen === "meter" && !isMobile && (
          <TextField
            placeholder="Buscar Cliente"
            variant="outlined"
            size="small"
            defaultValue={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              sx: {
                backgroundColor: "white",
                borderRadius: 1,
                "&:hover": {
                  backgroundColor: "white",
                },
              },
            }}
            sx={{
              width: "260px",
              display: { xs: "none", sm: "block" },
              ml: 0,
            }}
          />
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Only show buttons when not on home screen */}
        {showButtons && (
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              color="inherit"
              onClick={onHomeClick}
              sx={{
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                },
              }}
            >
              Inicio
            </Button>
            {currentScreen === "meter" && (
              <Button
                color="inherit"
                onClick={onSummaryClick}
                sx={{
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                  },
                }}
              >
                Resumen
              </Button>
            )}
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default TopBar;
