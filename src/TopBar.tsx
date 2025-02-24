// src/TopBar.tsx
import React, { useCallback, useRef } from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import { signOut } from "firebase/auth";
import { auth } from "./firebase-config";

// Define the drawer width to match Layout.tsx
const drawerWidth = 300;

// Simple debounce implementation
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<number | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

interface TopBarProps {
  onHomeClick: () => void;
  onMenuClick?: () => void;
  onFinishClick?: () => void;
  showButtons?: boolean;
  currentScreen?: string;
  showMenuButton?: boolean;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  isMobile?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  onHomeClick,
  showButtons,
  currentScreen,
  onMenuClick,
  showMenuButton,
  searchTerm,
  onSearchChange,
  isMobile,
}) => {
  const theme = useTheme();

  // Debounce search input
  const debouncedSearchChange = useDebounce(
    (value: string) => onSearchChange && onSearchChange(value),
    300
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      debouncedSearchChange(value);
    },
    [debouncedSearchChange]
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: theme.zIndex.drawer + 1,
        backgroundColor: theme.palette.primary.main,
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
            sx={{ display: { sm: "none" }, mr: 2 }}
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

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Water Meter Readings
        </Typography>

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
};

export default TopBar;
