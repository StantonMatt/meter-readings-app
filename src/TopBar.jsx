// src/TopBar.jsx
import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Box,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";

function TopBar({ onMenuClick }) {
  return (
    <AppBar
      elevation={0}
      color="inherit" // use backgroundColor: white from theme
      sx={{
        borderBottom: "1px solid #E6E8F0",
      }}
    >
      <Toolbar>
        {/* Menu button for mobile (if needed) */}
        <IconButton
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { xs: "block", md: "none" } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Title or “Workspace” name */}
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Devias
        </Typography>

        {/* Search icon */}
        <IconButton sx={{ mr: 1 }}>
          <SearchIcon />
        </IconButton>

        {/* Avatar */}
        <Avatar alt="User Avatar" src="/static/images/avatar.png" />
      </Toolbar>
    </AppBar>
  );
}

export default TopBar;
