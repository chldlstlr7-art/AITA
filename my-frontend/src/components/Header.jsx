import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  Login as LoginIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { isTokenValid } from '../utils/jwtHelper';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const NavButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})(({ theme, isActive }) => ({
  marginLeft: theme.spacing(2),
  color: 'white',
  fontWeight: 600,
  textTransform: 'none',
  padding: theme.spacing(1, 2.5),
  borderRadius: theme.spacing(1.5),
  transition: 'all 0.3s ease',
  background: isActive ? alpha('#fff', 0.2) : 'transparent',

  '&:hover': {
    background: alpha('#fff', 0.25),
    transform: 'translateY(-2px)',
  },
}));

const LogoText = styled(Typography)(({ theme }) => ({
  fontWeight: 900,
  fontSize: '1.5rem',
  cursor: 'pointer',
  textShadow: '0 2px 8px rgba(0,0,0,0.2)',
  transition: 'transform 0.3s ease',

  '&:hover': {
    transform: 'scale(1.05)',
  },
}));

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = isTokenValid();

  // 🔥 사용자 정보 상태
  const [userInfo, setUserInfo] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  // 🔥 JWT 토큰에서 사용자 정보 추출
  useEffect(() => {
    if (isLoggedIn) {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUserInfo({
            id: payload.sub || payload.user_id || payload.identity,
            email: payload.email || 'user@example.com',
            role: payload.role || 'student',
          });
        }
      } catch (e) {
        console.error('[Header] JWT 파싱 실패:', e);
      }
    } else {
      setUserInfo(null);
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    setUserInfo(null);
    handleMenuClose();
    navigate('/login');
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleDashboard = () => {
    navigate('/dashboard');
  };

  const handleTADashboard = () => {
    navigate('/ta/dashboard');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const isActive = (path) => location.pathname === path;

  // 🔥 TA/Admin 권한 확인
  const isTAOrAdmin = userInfo?.role === 'ta' || userInfo?.role === 'admin';

  // 🔥 사용자 이름의 첫 글자 (아바타용)
  const getInitial = () => {
    if (userInfo?.email) {
      return userInfo.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  // 🔥 역할 뱃지 색상
  const getRoleBadgeColor = () => {
    switch (userInfo?.role) {
      case 'ta':
        return '#FF6B6B';
      case 'admin':
        return '#FFD93D';
      default:
        return '#6BCF7F';
    }
  };

  return (
    <StyledAppBar position="sticky" elevation={0}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ py: 1 }}>
          {/* 로고 */}
          <LogoText
            variant="h6"
            onClick={handleLogoClick}
          >
            AITA
          </LogoText>

          <Box sx={{ flexGrow: 1 }} />

          {/* 네비게이션 버튼들 */}
          {isLoggedIn ? (
            <>
              {/* 홈 버튼 */}
              <Tooltip title="새 보고서 분석하기" arrow>
                <NavButton
                  startIcon={<HomeIcon />}
                  onClick={handleLogoClick}
                  isActive={isActive('/')}
                >
                  홈
                </NavButton>
              </Tooltip>

              {/* 대시보드 버튼 */}
              <Tooltip title="나의 대시보드 보기" arrow>
                <NavButton
                  startIcon={<DashboardIcon />}
                  onClick={handleDashboard}
                  isActive={isActive('/dashboard')}
                >
                  대시보드
                </NavButton>
              </Tooltip>

              {/* 🔥 TA/Admin 전용 TA 대시보드 버튼 */}
              {isTAOrAdmin && (
                <Tooltip title="과목 및 과제 관리" arrow>
                  <NavButton
                    startIcon={<SchoolIcon />}
                    onClick={handleTADashboard}
                    isActive={isActive('/ta/dashboard')}
                  >
                    TA 관리
                  </NavButton>
                </Tooltip>
              )}

              {/* 🔥 프로필 아바타 */}
              <Tooltip title="프로필 메뉴" arrow>
                <IconButton
                  onClick={handleMenuOpen}
                  sx={{
                    ml: 2,
                    border: `2px solid ${alpha('#fff', 0.3)}`,
                    '&:hover': {
                      background: alpha('#fff', 0.15),
                      borderColor: alpha('#fff', 0.5),
                    },
                  }}
                >
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: getRoleBadgeColor(),
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  >
                    {getInitial()}
                  </Avatar>
                </IconButton>
              </Tooltip>

              {/* 🔥 프로필 드롭다운 메뉴 */}
              <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                PaperProps={{
                  elevation: 3,
                  sx: {
                    mt: 1.5,
                    minWidth: 220,
                    borderRadius: 2,
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.15))',
                    '& .MuiAvatar-root': {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {/* 사용자 정보 헤더 */}
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {userInfo?.email || 'Loading...'}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: getRoleBadgeColor(),
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {userInfo?.role === 'ta' ? 'TA' : userInfo?.role === 'admin' ? 'Admin' : 'Student'}
                  </Typography>
                </Box>

                <Divider />

                {/* 메뉴 항목 */}
                <MenuItem onClick={() => navigate('/dashboard')}>
                  <ListItemIcon>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  내 대시보드
                </MenuItem>

                {/* 🔥 TA/Admin 전용 메뉴 */}
                {isTAOrAdmin && (
                  <MenuItem onClick={handleTADashboard}>
                    <ListItemIcon>
                      <SchoolIcon fontSize="small" />
                    </ListItemIcon>
                    TA 관리
                  </MenuItem>
                )}

                <MenuItem onClick={handleMenuClose}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  설정 (준비 중)
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  로그아웃
                </MenuItem>
              </Menu>
            </>
          ) : (
            <>
              {/* 로그인 버튼 */}
              <NavButton
                startIcon={<LoginIcon />}
                onClick={handleLogin}
                isActive={isActive('/login')}
              >
                로그인
              </NavButton>
            </>
          )}
        </Toolbar>
      </Container>
    </StyledAppBar>
  );
}

export default Header;