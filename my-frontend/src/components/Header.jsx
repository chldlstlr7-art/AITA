import React, { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Menu as MenuIcon, Close as CloseIcon, Logout as LogoutIcon } from '@mui/icons-material';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
  backdropFilter: 'blur(10px)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 24px',
  [theme.breakpoints.down('sm')]: {
    padding: '8px 16px',
  },
}));

const LogoBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'scale(1.02)',
  },
}));

const Logo = styled(Typography)(({ theme }) => ({
  fontWeight: 800,
  fontSize: '1.5rem',
  background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontFamily: '"Segoe UI", "Roboto", sans-serif',
  letterSpacing: '-0.5px',
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.2rem',
  },
}));

const NavBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: '8px 16px',
  fontSize: '0.9rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  border: '1.5px solid',
  '&:hover': {
    transform: 'translateY(-2px)',
  },
}));

const UserSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1),
  },
}));

const UserEmail = styled(Typography)(({ theme }) => ({
  color: 'white',
  fontSize: '0.9rem',
  fontWeight: 500,
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 40,
  height: 40,
  background: 'rgba(255, 255, 255, 0.2)',
  border: '2px solid rgba(255, 255, 255, 0.3)',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    transform: 'scale(1.05)',
  },
}));

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 로그인/회원가입 페이지에서는 Header를 표시하지 않음
  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const getAvatarInitials = (email) => {
    if (!email) return 'U';
    const parts = email.split('@');
    return parts[0].charAt(0).toUpperCase();
  };

  return (
    <StyledAppBar position="sticky">
      <StyledToolbar>
        {/* 로고 */}
        <LogoBox component={RouterLink} to="/">
          <Typography
            sx={{
              fontSize: '1.8rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ffffff 0%, #e0e0ff 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            📊
          </Typography>
          <Logo variant="h6">AITA</Logo>
        </LogoBox>

        {/* 데스크톱 네비게이션 */}
        <NavBox>
          {isAuthenticated ? (
            <UserSection>
              <UserEmail>{user?.email}</UserEmail>
              <StyledAvatar
                onClick={handleMenuOpen}
                sx={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                {getAvatarInitials(user?.email)}
              </StyledAvatar>

              {/* 프로필 메뉴 */}
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                    borderRadius: '12px',
                    mt: 1,
                  },
                }}
              >
                <MenuItem disabled>
                  <Typography variant="caption" color="text.secondary">
                    {user?.email}
                  </Typography>
                </MenuItem>
                <Divider />
                <MenuItem
                  onClick={handleLogout}
                  sx={{
                    color: '#f5576c',
                    '&:hover': {
                      background: 'rgba(245, 87, 108, 0.08)',
                    },
                  }}
                >
                  <LogoutIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                  <Typography variant="body2" fontWeight={500}>
                    로그아웃
                  </Typography>
                </MenuItem>
              </Menu>
            </UserSection>
          ) : (
            <UserSection>
              <StyledButton
                component={RouterLink}
                to="/login"
                variant="outlined"
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'white',
                    background: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                로그인
              </StyledButton>
              <StyledButton
                component={RouterLink}
                to="/register"
                variant="contained"
                sx={{
                  background: 'white',
                  color: '#667eea',
                  borderColor: 'white',
                  fontWeight: 700,
                  '&:hover': {
                    background: '#f5f5f5',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                회원가입
              </StyledButton>
            </UserSection>
          )}
        </NavBox>

        {/* 모바일 메뉴 버튼 */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', gap: 1 }}>
          {isAuthenticated && (
            <StyledAvatar
              onClick={handleMenuOpen}
              sx={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 700,
              }}
            >
              {getAvatarInitials(user?.email)}
            </StyledAvatar>
          )}
          <IconButton
            color="inherit"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{
              color: 'white',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>
        </Box>
      </StyledToolbar>

      {/* 모바일 드로어 */}
      <Drawer
        anchor="top"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            marginTop: '64px',
          },
        }}
      >
        <List sx={{ p: 2 }}>
          {isAuthenticated ? (
            <>
              <ListItem>
                <Typography variant="body2" color="white" sx={{ opacity: 0.8 }}>
                  {user?.email}
                </Typography>
              </ListItem>
              <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.2)' }} />
              <ListItemButton
                onClick={handleLogout}
                sx={{
                  borderRadius: 1,
                  color: '#f5576c',
                  mb: 1,
                }}
              >
                <LogoutIcon sx={{ mr: 2 }} />
                <ListItemText primary="로그아웃" />
              </ListItemButton>
            </>
          ) : (
            <>
              <ListItemButton
                component={RouterLink}
                to="/login"
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: 1,
                  color: 'white',
                  mb: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <ListItemText primary="로그인" />
              </ListItemButton>
              <ListItemButton
                component={RouterLink}
                to="/register"
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: 1,
                  color: '#667eea',
                  background: 'white',
                }}
              >
                <ListItemText primary="회원가입" />
              </ListItemButton>
            </>
          )}
        </List>
      </Drawer>
    </StyledAppBar>
  );
}

export default Header;