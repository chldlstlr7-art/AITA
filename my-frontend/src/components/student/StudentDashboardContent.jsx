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
} from '@mui/material';
import {
  School as SchoolIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import CourseCard from './CourseCard.jsx';
import SubmissionCard from './SubmissionCard.jsx';
import { getStudentDashboard } from '../../services/api.js';
import { getUserIdFromToken } from '../../utils/jwtHelper.js';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
  },
}));

function StudentDashboardContent() {
  const navigate = useNavigate();
  
  // 상태 관리
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    student: null,
    courses: [],
    submitted_reports: [],
  });

  // 🔥 API 호출 - 학생 대시보드 데이터 로드
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

        // 🔥 API 호출: GET /api/student/dashboard/<user_id>
        const data = await getStudentDashboard(userId);

        console.log('[StudentDashboard] ✅ 데이터 로드 성공:', data);

        // 🔥 데이터 구조 검증 및 안전한 할당
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
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        gap: 2 
      }}>
        <CircularProgress size={60} />
        <Typography variant="body2" color="text.secondary">
          대시보드 데이터를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  // 에러 발생 시
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle>데이터 로드 실패</AlertTitle>
        {error}
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button 
            color="inherit" 
            size="small" 
            variant="outlined"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
          <Button 
            color="inherit" 
            size="small" 
            variant="outlined"
            onClick={() => navigate('/')}
          >
            홈으로 가기
          </Button>
        </Box>
      </Alert>
    );
  }

  const { student, courses, submitted_reports } = dashboardData;

  // 🔥 통계 계산 (안전한 처리)
  const totalReports = submitted_reports?.length || 0;
  const completedReports = submitted_reports?.filter(r => r.status === 'completed')?.length || 0;
  const totalCourses = courses?.length || 0;

  return (
    <Box>
      {/* 📊 통계 카드 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <StyledCard>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <SchoolIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {totalCourses}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    수강 중인 과목
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} sm={4}>
          <StyledCard>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <DescriptionIcon sx={{ fontSize: 40, color: 'success.main' }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {totalReports}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    총 제출 리포트
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} sm={4}>
          <StyledCard>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'info.main' }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {completedReports}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    분석 완료
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      {/* 📚 수강 중인 과목 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          📚 수강 중인 과목
        </Typography>

        {!courses || courses.length === 0 ? (
          <Alert severity="info">
            수강 중인 과목이 없습니다. TA에게 문의하여 과목에 등록하세요.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {courses.map((course) => (
              <Grid item xs={12} key={course.course_id || course.id}>
                <CourseCard course={course} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* 📝 제출한 리포트 */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          📝 제출한 리포트
        </Typography>

        {!submitted_reports || submitted_reports.length === 0 ? (
          <Alert severity="info">
            아직 제출한 리포트가 없습니다. 홈에서 새 리포트를 분석해보세요!
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/')}
              sx={{ ml: 2 }}
            >
              홈으로 가기
            </Button>
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {submitted_reports.map((report) => (
              <Grid item xs={12} sm={6} md={4} key={report.report_id}>
                <SubmissionCard report={report} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}

export default StudentDashboardContent;