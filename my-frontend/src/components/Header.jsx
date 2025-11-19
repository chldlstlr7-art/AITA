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
  Alert,
  Stack,
  Autocomplete,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  Login as LoginIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  School as SchoolIcon,
  SupervisorAccount as AdminIcon,
  Grade as GradeIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { isTokenValid } from '../utils/jwtHelper';
// 🔥 기존 API 함수들을 활용합니다.
import { getTaCourses, getCourseStudents } from '../services/api';

// ==================== Constants ====================

const DEV_EMAILS = [
  "dabok2@snu.ac.kr",
  "dev2@snu.ac.kr",
  "dev3@snu.ac.kr",
  "dev@snu.ac.kr"
];

// ==================== Styled Components ====================

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const NavButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})(({ theme, isActive }) => ({
  marginLeft: theme.spacing(1),
  color: 'white',
  fontWeight: 600,
  textTransform: 'none',
  padding: theme.spacing(1, 2),
  borderRadius: theme.spacing(1.5),
  transition: 'all 0.3s ease',
  background: isActive ? alpha('#fff', 0.2) : 'transparent',
  border: '1px solid transparent',

  '&:hover': {
    background: alpha('#fff', 0.25),
    borderColor: alpha('#fff', 0.5),
    transform: 'translateY(-2px)',
  },
}));

const LogoText = styled(Typography)(({ theme }) => ({
  fontWeight: 900,
  fontSize: '1.5rem',
  cursor: 'pointer',
  textShadow: '0 2px 8px rgba(0,0,0,0.2)',
  transition: 'transform 0.3s ease',
  marginRight: theme.spacing(2),

  '&:hover': {
    transform: 'scale(1.05)',
  },
}));

// ==================== Main Component ====================

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedIn = isTokenValid();

  // 사용자 정보 상태
  const [userInfo, setUserInfo] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  // 🔥 개발자용 학생 선택 관련 상태
  const [studentSelectOpen, setStudentSelectOpen] = useState(false);
  const [studentList, setStudentList] = useState([]); 
  const [loadingStudents, setLoadingStudents] = useState(false); 
  const [selectedStudent, setSelectedStudent] = useState(null); 
  const [fetchError, setFetchError] = useState(''); 

  // JWT 토큰 처리
  useEffect(() => {
    if (isLoggedIn) {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const email = payload.email || '';
          
          let userRole = payload.role || 'student';
          
          if (DEV_EMAILS.includes(email)) {
            userRole = 'developer';
          } 
          else if (payload.is_admin || userRole === 'admin') {
            userRole = 'ta'; 
          }

          setUserInfo({
            id: payload.sub || payload.user_id || payload.identity,
            email: email,
            role: userRole,
          });
        }
      } catch (e) {
        console.error('[Header] JWT 파싱 실패:', e);
      }
    } else {
      setUserInfo(null);
    }
  }, [isLoggedIn]);

  // 🔥 다이얼로그가 열릴 때 기존 API를 조합하여 학생 목록 생성
  useEffect(() => {
    if (studentSelectOpen && userInfo?.role === 'developer') {
      fetchAllStudentsFromCourses();
    }
  }, [studentSelectOpen]);

  const fetchAllStudentsFromCourses = async () => {
    setLoadingStudents(true);
    setFetchError('');
    setStudentList([]);

    try {
      // 1. 관리자가 접근 가능한 모든 과목(Course) 조회
      const coursesData = await getTaCourses();
      const courses = Array.isArray(coursesData) 
        ? coursesData 
        : (coursesData.courses || []);

      if (courses.length === 0) {
        setFetchError('관리 중인 과목이 없습니다. 학생을 조회할 수 없습니다.');
        return;
      }

      // 2. 각 과목별로 수강생 목록 병렬 조회 (Promise.all)
      const studentPromises = courses.map(course => 
        getCourseStudents(course.course_id || course.id)
          .then(res => ({ 
             // API 응답 구조에 따라 배열 추출 (res.students 또는 res 자체가 배열)
             students: Array.isArray(res) ? res : (res.students || []) 
          }))
          .catch(err => {
             console.warn(`과목(ID:${course.course_id}) 학생 조회 실패:`, err);
             return { students: [] }; // 실패해도 다른 과목은 계속 진행
          })
      );

      const results = await Promise.all(studentPromises);

      // 3. 모든 과목의 학생 리스트를 하나로 평탄화(Flatten)
      const allStudents = results.flatMap(r => r.students);

      // 4. 중복 제거 (한 학생이 여러 과목을 들을 수 있으므로 ID 기준 유니크 처리)
      const uniqueStudentsMap = new Map();
      allStudents.forEach(student => {
        if (student && student.id) {
          uniqueStudentsMap.set(student.id, student);
        }
      });

      const uniqueStudentList = Array.from(uniqueStudentsMap.values());
      
      console.log('[Header] 통합 학생 목록:', uniqueStudentList);
      setStudentList(uniqueStudentList);

    } catch (error) {
      console.error('학생 목록 로드 실패:', error);
      setFetchError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    setUserInfo(null);
    handleMenuClose();
    navigate('/login');
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  // 네비게이션 핸들러
  const handleStudentDashboard = () => {
    if (userInfo?.role === 'student') {
      navigate(`/dashboard/${userInfo.id}`);
    } else {
      setStudentSelectOpen(true);
      setSelectedStudent(null);
    }
  };

  const handleTADashboard = () => {
    navigate('/ta/dashboard');
  };

  const handleGrading = () => {
    navigate('/ta/grading');
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

  // 🔥 학생 선택 후 이동
  const handleStudentDashboardNavigate = () => {
    if (!selectedStudent) return;
    
    setStudentSelectOpen(false);
    navigate(`/dashboard/${selectedStudent.id}`);
  };

  const isActive = (path) => location.pathname === path;
  const isDeveloper = userInfo?.role === 'developer';
  const isTA = userInfo?.role === 'ta' || isDeveloper;
  const isStudent = userInfo?.role === 'student';

  const getInitial = () => userInfo?.email ? userInfo.email.charAt(0).toUpperCase() : 'U';
  const getRoleBadgeColor = () => {
    if (isDeveloper) return '#9C27B0';
    if (isTA) return '#FF6B6B';
    return '#6BCF7F';
  };
  const getRoleText = () => {
    if (isDeveloper) return 'Developer';
    if (isTA) return 'TA / Admin';
    return 'Student';
  };

  return (
    <>
      <StyledAppBar position="sticky" elevation={0}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ py: 0.5 }}>
            <LogoText variant="h6" onClick={handleLogoClick}>
              AITA
            </LogoText>

            <Box sx={{ flexGrow: 1 }} />

            {isLoggedIn ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <NavButton
                  startIcon={<HomeIcon />}
                  onClick={handleLogoClick}
                  isActive={isActive('/')}
                >
                  홈
                </NavButton>

                {(isStudent || isDeveloper) && (
                  <Tooltip title={isDeveloper ? "학생 대시보드 (학생 선택)" : "나의 대시보드"} arrow>
                    <NavButton
                      startIcon={isDeveloper ? <AdminIcon /> : <DashboardIcon />}
                      onClick={handleStudentDashboard}
                      isActive={location.pathname.startsWith('/dashboard')}
                    >
                      {isDeveloper ? "학생 뷰" : "대시보드"}
                    </NavButton>
                  </Tooltip>
                )}

                {isTA && (
                  <>
                    <Tooltip title="과목 및 학생 관리" arrow>
                      <NavButton
                        startIcon={<SchoolIcon />}
                        onClick={handleTADashboard}
                        isActive={isActive('/ta/dashboard')}
                      >
                        TA 대시보드
                      </NavButton>
                    </Tooltip>
                    
                    <Tooltip title="과제 채점 및 관리" arrow>
                      <NavButton
                        startIcon={<GradeIcon />}
                        onClick={handleGrading}
                        isActive={isActive('/ta/grading')}
                      >
                        채점 관리
                      </NavButton>
                    </Tooltip>
                  </>
                )}

                <Tooltip title="계정 설정" arrow>
                  <IconButton
                    onClick={handleMenuOpen}
                    sx={{
                      ml: 1,
                      border: `2px solid ${alpha('#fff', 0.3)}`,
                      p: 0.5,
                      '&:hover': {
                        background: alpha('#fff', 0.15),
                        borderColor: alpha('#fff', 0.5),
                      },
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: getRoleBadgeColor(),
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}
                    >
                      {getInitial()}
                    </Avatar>
                  </IconButton>
                </Tooltip>

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
                    },
                  }}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {userInfo?.email}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: getRoleBadgeColor(),
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5
                      }}
                    >
                      {isDeveloper && <CodeIcon fontSize="inherit" />}
                      {getRoleText()}
                    </Typography>
                  </Box>

                  <Divider />

                  <MenuItem onClick={handleMenuClose}>
                    <ListItemIcon>
                      <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    설정
                  </MenuItem>

                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    로그아웃
                  </MenuItem>
                </Menu>
              </Stack>
            ) : (
              <NavButton
                startIcon={<LoginIcon />}
                onClick={handleLogin}
                isActive={isActive('/login')}
              >
                로그인
              </NavButton>
            )}
          </Toolbar>
        </Container>
      </StyledAppBar>

      {/* 🔥 Autocomplete이 적용된 학생 선택 다이얼로그 */}
      <Dialog
        open={studentSelectOpen}
        onClose={() => setStudentSelectOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'visible' }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.25rem' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <AdminIcon color="primary" />
            학생 대시보드 접근
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 1 }}>
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.9rem' }}>
            관리 중인 모든 과목의 학생 목록을 불러와 검색합니다.
          </Alert>
          
          {fetchError && (
             <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>
          )}

          <Autocomplete
            id="student-select-autocomplete"
            options={studentList}
            loading={loadingStudents}
            // 옵션 라벨: 이름 (이메일)
            getOptionLabel={(option) => {
                // option이 문자열일 경우(드문 경우) 방지
                if (typeof option === 'string') return option;
                return `${option.name || '이름없음'} (${option.email})`;
            }}
            // 선택 핸들러
            onChange={(event, newValue) => {
              setSelectedStudent(newValue);
            }}
            // 입력창 렌더링
            renderInput={(params) => (
              <TextField
                {...params}
                label="학생 검색 (이름/이메일)"
                variant="outlined"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loadingStudents ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
            // 드롭다운 목록 렌더링 (Custom UI)
            renderOption={(props, option) => {
                // key prop을 분리하여 전달 (콘솔 경고 방지)
                const { key, ...otherProps } = props;
                return (
                  <li key={key} {...otherProps}>
                     <Box>
                        <Typography variant="body1" fontWeight="bold">
                          {option.name || '이름 없음'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email} (ID: {option.id})
                        </Typography>
                     </Box>
                  </li>
                );
            }}
            // 리스트가 비었을 때 메시지
            noOptionsText="조회된 학생이 없습니다."
          />
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setStudentSelectOpen(false)}
            sx={{ fontWeight: 600 }}
          >
            취소
          </Button>
          <Button 
            onClick={handleStudentDashboardNavigate}
            variant="contained"
            disabled={!selectedStudent} 
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            이동
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default Header;