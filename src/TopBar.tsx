// src/TopBar.tsx
import React from "react";
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Typography,
  useTheme,
  Tooltip,
  alpha,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import HomeIcon from "@mui/icons-material/Home";
import { signOut } from "firebase/auth";
import { auth } from "./firebase-config";

interface TopBarProps {
  onHomeClick: () => void;
  onMenuClick?: () => void;
  showButtons?: boolean;
  showMenuButton?: boolean;
  isMobile?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  onHomeClick,
  showButtons,
  onMenuClick,
  showMenuButton,
}) => {
  const theme = useTheme();

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
      elevation={0}
      sx={{
        zIndex: theme.zIndex.drawer + 1,
        backgroundColor: theme.palette.primary.main,
        borderRadius: 0,
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          alignItems: "center",
          padding: theme.spacing(0, 3),
          minHeight: 64,
          gap: 1.5,
        }}
      >
        {showMenuButton && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{
              display: { md: "none" },
              mr: 2,
              backgroundColor: alpha("#fff", 0.1),
              "&:hover": {
                backgroundColor: alpha("#fff", 0.15),
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <WaterDropIcon
          sx={{
            display: { xs: "flex" },
            mr: 1.5,
            fontSize: 28,
            color: "#fff",
          }}
        />

        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{
            flexGrow: { xs: 1, md: 0 },
            fontWeight: 600,
            letterSpacing: "0.5px",
            mr: 3,
            color: "#fff",
          }}
        >
          Lecturas COAB
        </Typography>

        {showButtons && (
          <Button
            color="inherit"
            startIcon={<HomeIcon />}
            onClick={onHomeClick}
            variant="text"
            sx={{
              borderRadius: "8px",
              px: 2,
              py: 1,
              ml: "auto",
              mr: 3,
              display: { xs: "none", md: "flex" },
              backgroundColor: alpha("#fff", 0.08),
              "&:hover": {
                backgroundColor: alpha("#fff", 0.15),
              },
              transition: "all 0.2s",
            }}
          >
            Inicio
          </Button>
        )}

        <Tooltip title="Cerrar Sesión">
          <Button
            color="inherit"
            onClick={handleLogout}
            variant="text"
            startIcon={<ExitToAppIcon />}
            sx={{
              borderRadius: "8px",
              px: { xs: 1, sm: 2 },
              py: 1,
              backgroundColor: alpha("#fff", 0.08),
              "&:hover": {
                backgroundColor: alpha("#fff", 0.15),
              },
              transition: "all 0.2s",
            }}
          >
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              Cerrar Sesión
            </Box>
          </Button>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
