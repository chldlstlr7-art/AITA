import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudentDashboard } from '../services/api.js';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
} from '@mui/material';
import {
  School as SchoolIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

function StudentDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // 🔥 localStorage에서 user_id 가져오기
  const getUserIdFromToken = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // sub 또는 identity 필드에서 user_id 추출
      const userId = payload.sub || payload.user_id || payload.identity;
      console.log('[StudentDashboard] JWT Payload:', payload);
      console.log('[StudentDashboard] Extracted User ID:', userId);
      return userId;
    } catch (e) {
      console.error('[StudentDashboard] JWT 파싱 실패:', e);
      return null;
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');
        
        const studentId = getUserIdFromToken();
        
        if (!studentId) {
          setError('로그인 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
          setLoading(false);
          return;
        }

        console.log('[StudentDashboard] 📡 대시보드 조회 시작: student_id =', studentId);
        
        // 🔥 정확한 studentId를 파라미터로 전달
        const data = await getStudentDashboard(studentId);
        console.log('[StudentDashboard] ✅ 대시보드 데이터:', data);
        
        setDashboardData(data);
      } catch (err) {
        console.error('[StudentDashboard] ❌ 대시보드 로딩 실패:', err);
        
        // 🔥 에러 응답에서 메시지 추출
        const errorMessage = err.response?.data?.error 
          || err.response?.data?.message 
          || err.message 
          || '대시보드를 불러오지 못했습니다.';
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // 로딩 화면
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h6">대시보드를 불러오는 중...</Typography>
        </Box>
      </Container>
    );
  }

  // 에러 화면
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={handleRetry}>
              재시도
            </Button>
          }
        >
          {error}
        </Alert>
        <Box textAlign="center">
          <Button variant="contained" startIcon={<HomeIcon />} onClick={handleGoHome}>
            홈으로 이동
          </Button>
        </Box>
      </Container>
    );
  }

  // 데이터 없음
  if (!dashboardData) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert severity="info">대시보드 데이터가 없습니다.</Alert>
      </Container>
    );
  }

  const { student, enrolled_courses, submitted_reports } = dashboardData;

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* 헤더 */}
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          📚 학생 대시보드
        </Typography>
        <Typography variant="body1">
          {student?.username || student?.email}님, 환영합니다!
        </Typography>
      </Paper>

      {/* 수강 과목 */}
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <SchoolIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            수강 과목
          </Typography>
        </Stack>
        
        {enrolled_courses && enrolled_courses.length > 0 ? (
          <Grid container spacing={2}>
            {enrolled_courses.map((course) => (
              <Grid item xs={12} sm={6} md={4} key={course.id}>
                <Card elevation={2} sx={{ height: '100%' }}>
                  <CardContent>
                    <Chip label={course.course_code} size="small" color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {course.course_name}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Alert severity="info">수강 중인 과목이 없습니다.</Alert>
        )}
      </Paper>

      {/* 제출 리포트 */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <AssignmentIcon sx={{ fontSize: 32, color: 'secondary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            제출 리포트
          </Typography>
        </Stack>
        
        {submitted_reports && submitted_reports.length > 0 ? (
          <Grid container spacing={2}>
            {submitted_reports.map((report) => (
              <Grid item xs={12} key={report.id}>
                <Card elevation={2} sx={{ cursor: 'pointer', '&:hover': { boxShadow: 6 } }} onClick={() => navigate(`/report/${report.id}`)}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {report.report_title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          과제: {report.assignment_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          제출일: {report.created_at ? new Date(report.created_at).toLocaleDateString('ko-KR') : 'N/A'}
                        </Typography>
                      </Box>
                      <Chip 
                        label={report.status === 'completed' ? '완료' : '처리 중'} 
                        color={report.status === 'completed' ? 'success' : 'warning'} 
                        size="small" 
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Alert severity="info">제출한 리포트가 없습니다.</Alert>
        )}
      </Paper>
    </Container>
  );
}

export default StudentDashboard;