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
import { styled, alpha } from '@mui/material/styles';
import { Menu as MenuIcon, Close as CloseIcon, Logout as LogoutIcon } from '@mui/icons-material';

// 🎨 테마 색상 기반 Styled Components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.25)}`,
  backdropFilter: 'blur(10px)',
  borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
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
  gap: theme.spacing(1.5),
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  textDecoration: 'none',
  '&:hover': {
    transform: 'scale(1.05)',
  },
}));

const Logo = styled(Typography)(({ theme }) => ({
  fontWeight: 900,
  fontSize: '1.6rem',
  background: `linear-gradient(135deg, ${theme.palette.common.white} 0%, ${alpha(theme.palette.common.white, 0.85)} 100%)`,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
  letterSpacing: '-1px',
  textShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.1)}`,
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.3rem',
  },
}));

const NavBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  padding: '10px 20px',
  fontSize: '0.95rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, 0.15)}`,
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
  color: theme.palette.common.white,
  fontSize: '0.9rem',
  fontWeight: 500,
  opacity: 0.95,
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 42,
  height: 42,
  background: alpha(theme.palette.common.white, 0.2),
  border: `2px solid ${alpha(theme.palette.common.white, 0.3)}`,
  color: theme.palette.common.white,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '1.1rem',
  transition: 'all 0.3s ease',
  backdropFilter: 'blur(8px)',
  '&:hover': {
    background: alpha(theme.palette.common.white, 0.3),
    borderColor: alpha(theme.palette.common.white, 0.5),
    transform: 'scale(1.08)',
    boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.2)}`,
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
        {/* 🆕 개선된 로고 */}
        <LogoBox component={RouterLink} to="/">
          <Typography
            sx={{
              fontSize: '2rem',
              fontWeight: 700,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.common.white} 0%, ${alpha(theme.palette.secondary.light, 1)} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            }}
          >
            📊
          </Typography>
          <Logo variant="h6">AITA</Logo>
        </LogoBox>

        {/* 🆕 테마 색상 기반 데스크톱 네비게이션 */}
        <NavBox>
          {isAuthenticated ? (
            <UserSection>
              <UserEmail>{user?.email}</UserEmail>
              <StyledAvatar onClick={handleMenuOpen}>
                {getAvatarInitials(user?.email)}
              </StyledAvatar>

              {/* 🆕 테마 색상 기반 프로필 메뉴 */}
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`,
                    borderRadius: 2,
                    mt: 1,
                    minWidth: 200,
                    border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  },
                }}
              >
                <MenuItem disabled>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {user?.email}
                  </Typography>
                </MenuItem>
                <Divider sx={{ my: 1 }} />
                <MenuItem
                  onClick={handleLogout}
                  sx={{
                    color: 'error.main',
                    py: 1.5,
                    borderRadius: 1,
                    mx: 1,
                    '&:hover': {
                      background: (theme) => alpha(theme.palette.error.main, 0.08),
                    },
                  }}
                >
                  <LogoutIcon sx={{ mr: 1.5, fontSize: '1.3rem' }} />
                  <Typography variant="body2" fontWeight={600}>
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
                  borderColor: (theme) => alpha(theme.palette.common.white, 0.5),
                  color: 'common.white',
                  borderWidth: '2px',
                  '&:hover': {
                    borderColor: 'common.white',
                    borderWidth: '2px',
                    background: (theme) => alpha(theme.palette.common.white, 0.15),
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
                  background: 'common.white',
                  color: 'primary.main',
                  fontWeight: 700,
                  boxShadow: (theme) => `0 4px 14px ${alpha(theme.palette.common.black, 0.15)}`,
                  '&:hover': {
                    background: (theme) => alpha(theme.palette.common.white, 0.95),
                    transform: 'translateY(-2px)',
                    boxShadow: (theme) => `0 6px 20px ${alpha(theme.palette.common.black, 0.2)}`,
                  },
                }}
              >
                회원가입
              </StyledButton>
            </UserSection>
          )}
        </NavBox>

        {/* 🆕 테마 색상 기반 모바일 메뉴 버튼 */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', gap: 1.5 }}>
          {isAuthenticated && (
            <StyledAvatar onClick={handleMenuOpen}>
              {getAvatarInitials(user?.email)}
            </StyledAvatar>
          )}
          <IconButton
            color="inherit"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{
              color: 'common.white',
              '&:hover': {
                background: (theme) => alpha(theme.palette.common.white, 0.15),
              },
            }}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>
        </Box>
      </StyledToolbar>

      {/* 🆕 테마 색상 기반 모바일 드로어 */}
      <Drawer
        anchor="top"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            marginTop: '64px',
            boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`,
          },
        }}
      >
        <List sx={{ p: 2 }}>
          {isAuthenticated ? (
            <>
              <ListItem>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'common.white', 
                    opacity: 0.9,
                    fontWeight: 500 
                  }}
                >
                  {user?.email}
                </Typography>
              </ListItem>
              <Divider sx={{ my: 1.5, borderColor: (theme) => alpha(theme.palette.common.white, 0.2) }} />
              <ListItemButton
                onClick={handleLogout}
                sx={{
                  borderRadius: 1.5,
                  color: 'error.light',
                  mb: 1,
                  py: 1.5,
                  '&:hover': {
                    background: (theme) => alpha(theme.palette.error.main, 0.15),
                  },
                }}
              >
                <LogoutIcon sx={{ mr: 2 }} />
                <ListItemText 
                  primary="로그아웃" 
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
              </ListItemButton>
            </>
          ) : (
            <>
              <ListItemButton
                component={RouterLink}
                to="/login"
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: 1.5,
                  color: 'common.white',
                  mb: 1.5,
                  py: 1.5,
                  background: (theme) => alpha(theme.palette.common.white, 0.15),
                  '&:hover': {
                    background: (theme) => alpha(theme.palette.common.white, 0.25),
                  },
                }}
              >
                <ListItemText 
                  primary="로그인" 
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
              </ListItemButton>
              <ListItemButton
                component={RouterLink}
                to="/register"
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: 1.5,
                  color: 'primary.main',
                  py: 1.5,
                  background: 'common.white',
                  '&:hover': {
                    background: (theme) => alpha(theme.palette.common.white, 0.95),
                  },
                }}
              >
                <ListItemText 
                  primary="회원가입" 
                  primaryTypographyProps={{ fontWeight: 700 }}
                />
              </ListItemButton>
            </>
          )}
        </List>
      </Drawer>
    </StyledAppBar>
  );
}

export default Header;