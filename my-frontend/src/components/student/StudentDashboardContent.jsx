import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  AlertTitle,
  Button,
  Stack,
  Chip,
  LinearProgress,
  Fade,
  Paper,
} from '@mui/material';
import {
  School as SchoolIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import CourseCard from './CourseCard.jsx';
import SubmissionCard from './SubmissionCard.jsx';
import { getStudentDashboard } from '../../services/api.js';
import { getUserIdFromToken } from '../../utils/jwtHelper.js';

// ==================== Styled Components ====================

const StatCard = styled(Card)(({ theme, color = 'primary' }) => ({
  height: '100%',
  background: `linear-gradient(135deg, ${alpha(theme.palette[color].main, 0.05)} 0%, ${alpha(theme.palette[color].light, 0.02)} 100%)`,
  border: `1px solid ${alpha(theme.palette[color].main, 0.15)}`,
  borderRadius: theme.spacing(2.5),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: `linear-gradient(90deg, ${theme.palette[color].main} 0%, ${theme.palette[color].light} 100%)`,
  },
  
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: `0 12px 40px ${alpha(theme.palette[color].main, 0.2)}`,
    borderColor: alpha(theme.palette[color].main, 0.3),
  },
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
  paddingBottom: theme.spacing(2),
  borderBottom: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 800,
  fontSize: '1.5rem',
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}));

const EmptyStateCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(6),
  textAlign: 'center',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
  border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
  borderRadius: theme.spacing(3),
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '400px',
  gap: theme.spacing(3),
}));

const StatValue = styled(Typography)(({ theme }) => ({
  fontWeight: 800,
  fontSize: '2.5rem',
  lineHeight: 1,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}));

const StatLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}));

const IconWrapper = styled(Box)(({ theme, color = 'primary' }) => ({
  width: 64,
  height: 64,
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${theme.palette[color].main} 0%, ${theme.palette[color].light} 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `0 8px 24px ${alpha(theme.palette[color].main, 0.3)}`,
}));

// ==================== Main Component ====================

function StudentDashboardContent() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    student: null,
    courses: [],
    submitted_reports: [],
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = getUserIdFromToken();
        if (!userId) {
          throw new Error('로그인이 필요합니다.');
        }

        console.log('[StudentDashboard] 📡 데이터 로드 시작:', userId);

        const data = await getStudentDashboard(userId);
        console.log('[StudentDashboard] ✅ 데이터 로드 성공:', data);

        setDashboardData({
          student: data.student || null,
          courses: Array.isArray(data.courses) ? data.courses : [],
          submitted_reports: Array.isArray(data.submitted_reports) ? data.submitted_reports : [],
        });

      } catch (err) {
        console.error('[StudentDashboard] ❌ 데이터 로드 실패:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        });
        setError(err.message || '데이터를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // 로딩 중
  if (loading) {
    return (
      <Fade in timeout={300}>
        <LoadingContainer>
          <CircularProgress size={80} thickness={4} />
          <Box sx={{ width: '100%', maxWidth: 300 }}>
            <LinearProgress 
              sx={{ 
                height: 6, 
                borderRadius: 3,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                }
              }} 
            />
          </Box>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
            대시보드 데이터를 불러오는 중...
          </Typography>
        </LoadingContainer>
      </Fade>
    );
  }

  // 에러 발생 시
  if (error) {
    return (
      <Fade in timeout={300}>
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            borderRadius: 3,
            border: (theme) => `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
          }}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>데이터 로드 실패</AlertTitle>
          {error}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button 
              color="inherit" 
              size="small" 
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => window.location.reload()}
              sx={{ borderRadius: 2 }}
            >
              다시 시도
            </Button>
            <Button 
              color="inherit" 
              size="small" 
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => navigate('/')}
              sx={{ borderRadius: 2 }}
            >
              홈으로 가기
            </Button>
          </Stack>
        </Alert>
      </Fade>
    );
  }

  const { student, courses, submitted_reports } = dashboardData;

  // 통계 계산
  const totalReports = submitted_reports?.length || 0;
  const completedReports = submitted_reports?.filter(r => r.status === 'completed')?.length || 0;
  const totalCourses = courses?.length || 0;
  const completionRate = totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0;

  return (
    <Box>
      {/* 📊 통계 카드 */}
      <Fade in timeout={600}>
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard color="primary">
              <CardContent sx={{ pt: 3 }}>
                <Stack spacing={2.5}>
                  <IconWrapper color="primary">
                    <SchoolIcon sx={{ fontSize: 32, color: 'white' }} />
                  </IconWrapper>
                  <Box>
                    <StatValue>
                      {totalCourses}
                    </StatValue>
                    <StatLabel>
                      수강 중인 과목
                    </StatLabel>
                  </Box>
                </Stack>
              </CardContent>
            </StatCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard color="success">
              <CardContent sx={{ pt: 3 }}>
                <Stack spacing={2.5}>
                  <IconWrapper color="success">
                    <DescriptionIcon sx={{ fontSize: 32, color: 'white' }} />
                  </IconWrapper>
                  <Box>
                    <StatValue>
                      {totalReports}
                    </StatValue>
                    <StatLabel>
                      총 제출 리포트
                    </StatLabel>
                  </Box>
                </Stack>
              </CardContent>
            </StatCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard color="info">
              <CardContent sx={{ pt: 3 }}>
                <Stack spacing={2.5}>
                  <IconWrapper color="info">
                    <CheckCircleIcon sx={{ fontSize: 32, color: 'white' }} />
                  </IconWrapper>
                  <Box>
                    <StatValue>
                      {completedReports}
                    </StatValue>
                    <StatLabel>
                      분석 완료
                    </StatLabel>
                  </Box>
                </Stack>
              </CardContent>
            </StatCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard color="warning">
              <CardContent sx={{ pt: 3 }}>
                <Stack spacing={2.5}>
                  <IconWrapper color="warning">
                    <TrendingUpIcon sx={{ fontSize: 32, color: 'white' }} />
                  </IconWrapper>
                  <Box>
                    <StatValue>
                      {completionRate}%
                    </StatValue>
                    <StatLabel>
                      완료율
                    </StatLabel>
                  </Box>
                </Stack>
              </CardContent>
            </StatCard>
          </Grid>
        </Grid>
      </Fade>

      {/* 📚 수강 중인 과목 */}
      <Fade in timeout={800}>
        <Box sx={{ mb: 5 }}>
          <SectionHeader>
            <SchoolIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box flex={1}>
              <SectionTitle>
                수강 중인 과목
              </SectionTitle>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {totalCourses}개의 과목을 수강하고 있습니다
              </Typography>
            </Box>
          </SectionHeader>

          {!courses || courses.length === 0 ? (
            <EmptyStateCard elevation={0}>
              <SchoolIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                수강 중인 과목이 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                TA에게 문의하여 과목에 등록하세요
              </Typography>
            </EmptyStateCard>
          ) : (
            <Grid container spacing={2.5}>
              {courses.map((course, index) => (
                <Grid item xs={12} key={course.course_id || course.id}>
                  <Fade in timeout={800 + index * 100}>
                    <Box>
                      <CourseCard course={course} />
                    </Box>
                  </Fade>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Fade>

      {/* 📝 제출한 리포트 */}
      <Fade in timeout={1000}>
        <Box>
          <SectionHeader>
            <DescriptionIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box flex={1}>
              <SectionTitle>
                제출한 리포트
              </SectionTitle>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {totalReports}개의 리포트를 제출했습니다
              </Typography>
            </Box>
          </SectionHeader>

          {!submitted_reports || submitted_reports.length === 0 ? (
            <EmptyStateCard elevation={0}>
              <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary' }}>
                제출한 리포트가 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                홈에서 새 리포트를 분석해보세요!
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<HomeIcon />}
                onClick={() => navigate('/')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 4,
                  background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                  '&:hover': {
                    boxShadow: (theme) => `0 8px 28px ${alpha(theme.palette.primary.main, 0.5)}`,
                  }
                }}
              >
                홈으로 가기
              </Button>
            </EmptyStateCard>
          ) : (
            <Grid container spacing={2.5}>
              {submitted_reports.map((report, index) => (
                <Grid item xs={12} sm={6} md={4} key={report.report_id}>
                  <Fade in timeout={1000 + index * 100}>
                    <Box>
                      <SubmissionCard report={report} />
                    </Box>
                  </Fade>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Fade>
    </Box>
  );
}

export default StudentDashboardContent;