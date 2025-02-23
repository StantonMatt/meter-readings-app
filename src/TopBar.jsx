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
import { signOut } from "firebase/auth";
import { auth } from "./firebase-config";

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AppBar
      position="sticky"
      sx={{
        backgroundColor: "#0A0E17",
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          gap: 2,
          pl: { sm: "12px" },
        }}
      >
        {/* Mobile menu button */}
        {showMenuButton && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{ display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Search field */}
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
            }}
          />
        )}

        {/* Home button - now next to search on meter screen */}
        {showButtons && (
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
        )}

        {/* Right side: Spacer and Logout button */}
        <Box sx={{ flexGrow: 1 }} />

        <Button
          color="inherit"
          onClick={handleLogout}
          sx={{
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.08)",
            },
          }}
        >
          Cerrar Sesión
        </Button>
      </Toolbar>
    </AppBar>
  );
}

export default TopBar;
