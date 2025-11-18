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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  Login as LoginIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  School as SchoolIcon,
  SupervisorAccount as AdminIcon,
  Grade as GradeIcon,
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

  // 🔥 개발자용 학생 선택 다이얼로그 상태
  const [studentSelectOpen, setStudentSelectOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [studentIdError, setStudentIdError] = useState('');

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

  // 🔥 대시보드 버튼 클릭 핸들러 (역할별 분기)
  const handleDashboard = () => {
    if (userInfo?.role === 'ta') {
      // TA는 TA 대시보드로
      navigate('/ta/dashboard');
    } else if (userInfo?.role === 'admin' || userInfo?.role === 'developer') {
      // 개발자는 학생 선택 다이얼로그 열기
      setStudentSelectOpen(true);
    } else {
      // 학생은 자신의 대시보드로
      navigate(`/dashboard/${userInfo.id}`);
    }
  };

  // 🔥 TA 관리 버튼 클릭 핸들러 (역할별 분기)
  const handleTAManagement = () => {
    if (userInfo?.role === 'ta') {
      // TA는 채점 관리 페이지로
      navigate('/ta/grading');
    } else if (userInfo?.role === 'admin' || userInfo?.role === 'developer') {
      // 개발자는 TA 대시보드로
      navigate('/ta/dashboard');
    }
  };

  // 🔥 학생 ID 입력 후 대시보드 이동
  const handleStudentDashboardNavigate = () => {
    if (!studentId.trim()) {
      setStudentIdError('학생 ID를 입력해주세요.');
      return;
    }

    setStudentSelectOpen(false);
    setStudentId('');
    setStudentIdError('');
    navigate(`/dashboard/${studentId.trim()}`);
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

  // 🔥 TA/Admin/Developer 권한 확인
  const isTA = userInfo?.role === 'ta';
  const isDeveloper = userInfo?.role === 'admin' || userInfo?.role === 'developer';
  const isTAOrAdmin = isTA || isDeveloper;

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
      case 'developer':
        return '#FFD93D';
      default:
        return '#6BCF7F';
    }
  };

  // 🔥 역할별 대시보드 버튼 텍스트
  const getDashboardButtonText = () => {
    if (isTA) return 'TA 대시보드';
    if (isDeveloper) return '학생 대시보드';
    return '대시보드';
  };

  // 🔥 역할별 TA 관리 버튼 텍스트
  const getTAManagementButtonText = () => {
    if (isTA) return '채점 관리';
    if (isDeveloper) return 'TA 대시보드';
    return 'TA 관리';
  };

  return (
    <>
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

                {/* 대시보드 버튼 (역할별 동작) */}
                <Tooltip 
                  title={
                    isTA 
                      ? 'TA 대시보드 보기' 
                      : isDeveloper 
                        ? '학생 선택하여 대시보드 보기' 
                        : '나의 대시보드 보기'
                  } 
                  arrow
                >
                  <NavButton
                    startIcon={isTA ? <SchoolIcon /> : isDeveloper ? <PersonIcon /> : <DashboardIcon />}
                    onClick={handleDashboard}
                    isActive={isActive('/dashboard') || isActive('/ta/dashboard')}
                  >
                    {getDashboardButtonText()}
                  </NavButton>
                </Tooltip>

                {/* 🔥 TA/Admin 전용 버튼 */}
                {isTAOrAdmin && (
                  <Tooltip 
                    title={
                      isTA 
                        ? '과제 채점 관리' 
                        : '과목 및 과제 관리'
                    } 
                    arrow
                  >
                    <NavButton
                      startIcon={isTA ? <GradeIcon /> : <SchoolIcon />}
                      onClick={handleTAManagement}
                      isActive={isActive('/ta/grading')}
                    >
                      {getTAManagementButtonText()}
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
                      {userInfo?.role === 'ta' 
                        ? 'TA' 
                        : (userInfo?.role === 'admin' || userInfo?.role === 'developer') 
                          ? 'Developer' 
                          : 'Student'}
                    </Typography>
                  </Box>

                  <Divider />

                  {/* 메뉴 항목 */}
                  <MenuItem onClick={handleDashboard}>
                    <ListItemIcon>
                      {isTA ? <SchoolIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
                    </ListItemIcon>
                    {getDashboardButtonText()}
                  </MenuItem>

                  {/* 🔥 TA/Admin 전용 메뉴 */}
                  {isTAOrAdmin && (
                    <MenuItem onClick={handleTAManagement}>
                      <ListItemIcon>
                        {isTA ? <GradeIcon fontSize="small" /> : <SchoolIcon fontSize="small" />}
                      </ListItemIcon>
                      {getTAManagementButtonText()}
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

      {/* 🔥 개발자용 학생 선택 다이얼로그 */}
      <Dialog
        open={studentSelectOpen}
        onClose={() => {
          setStudentSelectOpen(false);
          setStudentId('');
          setStudentIdError('');
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <AdminIcon color="primary" />
            학생 대시보드 접근
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            개발자 권한으로 특정 학생의 대시보드에 접근합니다.
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="학생 ID"
            type="text"
            fullWidth
            variant="outlined"
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setStudentIdError('');
            }}
            error={!!studentIdError}
            helperText={studentIdError || '학생의 user_id를 입력하세요 (예: 1, 2, 3...)'}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleStudentDashboardNavigate();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => {
              setStudentSelectOpen(false);
              setStudentId('');
              setStudentIdError('');
            }}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            취소
          </Button>
          <Button 
            onClick={handleStudentDashboardNavigate}
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            이동
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Header;