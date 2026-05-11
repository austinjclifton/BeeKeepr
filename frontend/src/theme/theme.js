import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#F5B942",
      contrastText: "#050505",
    },
    background: {
      default: "#050505",
      paper: "#151515",
    },
    text: {
      primary: "#FFFFFF",
      secondary: "rgba(255,255,255,0.65)",
    },
    divider: "#2A2A2A",
    success: {
      main: "#22c55e",
    },
    warning: {
      main: "#f59e0b",
    },
    error: {
      main: "#ef4444",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    button: {
      textTransform: "none",
      fontWeight: 800,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#050505",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #2A2A2A",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255,255,255,0.05)",
        },
        notchedOutline: {
          borderColor: "#2A2A2A",
        },
      },
    },
  },
});
