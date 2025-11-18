import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Drawer,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import CourseList from '../components/student/CourseList.jsx';
import AssignmentList from '../components/student/AssignmentList.jsx';
import SubmissionDetail from '../components/student/SubmissionDetail.jsx';
import UnsubmittedReports from '../components/student/UnsubmittedReports.jsx';
import { getStudentDashboard, getStudentCourseAssignments } from '../services/api.js';
import { getUserIdFromToken } from '../utils/jwtHelper.js';

// ==================== Styled Components ====================

// 🔥 전체 화면 컨테이너
const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: '#f8f9fa',
  padding: theme.spacing(3),
  width: '100%',
}));

// 🔥 전체 너비 컨텐츠 래퍼
const ContentWrapper = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: '100%',
  margin: '0 auto',
  padding: theme.spacing(0, 2),
}));

const WhiteContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}));

// 🔥 사이드바 - 고정 너비
const Sidebar = styled(Paper)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(2),
  height: 'calc(100vh - 120px)',
  position: 'sticky',
  top: 80,
  overflow: 'auto',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  width: '100%',
  minWidth: '200px',
  maxWidth: '250px',
  // 🔥 스크롤바 스타일링
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.divider,
    borderRadius: '3px',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

const MainContent = styled(Box)(({ theme }) => ({
  minHeight: 'calc(100vh - 120px)',
  width: '100%',
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '400px',
  gap: theme.spacing(2),
}));

const PageHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const PageTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.75rem',
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
}));

const PageSubtitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.95rem',
}));

// ==================== Main Component ====================

function StudentDashboard() {
  const { userId: paramUserId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    student: null,
    courses: [],
    submitted_reports: [],
  });
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = paramUserId || getUserIdFromToken();
        
        if (!userId) {
          throw new Error('로그인이 필요합니다.');
        }

        console.log('[StudentDashboard] 📡 데이터 로드 시작:', userId);

        const data = await getStudentDashboard(userId);
        console.log('[StudentDashboard] ✅ 대시보드 조회 성공:', data);

        // 🔥 각 과목의 과제 목록 추가 로드
        if (data.courses && data.courses.length > 0) {
          console.log('[StudentDashboard] 📡 과제 목록 로드 시작...');
          
          const coursesWithAssignments = await Promise.all(
            data.courses.map(async (course) => {
              try {
                const assignmentsData = await getStudentCourseAssignments(course.course_id);
                console.log(`[StudentDashboard] ✅ 과목 ${course.course_code} 과제 로드:`, assignmentsData);
                
                return {
                  ...course,
                  assignments: Array.isArray(assignmentsData) ? assignmentsData : [],
                };
              } catch (err) {
                console.error(`[StudentDashboard] ❌ 과목 ${course.course_code} 과제 로드 실패:`, err);
                return {
                  ...course,
                  assignments: [],
                };
              }
            })
          );

          console.log('[StudentDashboard] ✅ 모든 과제 로드 완료:', coursesWithAssignments);

          setDashboardData({
            student: data.student || null,
            courses: coursesWithAssignments,
            submitted_reports: Array.isArray(data.submitted_reports) ? data.submitted_reports : [],
          });

          // 첫 번째 과목 자동 선택
          const firstCourse = coursesWithAssignments[0];
          setSelectedCourse(firstCourse);
          console.log('[StudentDashboard] 🎯 첫 번째 과목 선택:', firstCourse);

        } else {
          setDashboardData({
            student: data.student || null,
            courses: [],
            submitted_reports: Array.isArray(data.submitted_reports) ? data.submitted_reports : [],
          });
        }

      } catch (err) {
        console.error('[StudentDashboard] ❌ 데이터 로드 실패:', err);
        setError(err.message || '데이터를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [paramUserId]);

  const handleCourseSelect = (course) => {
    console.log('[StudentDashboard] 🎯 과목 선택:', course);
    setSelectedCourse(course);
    setSelectedAssignment(null);
  };

  // 로딩 중
  if (loading) {
    return (
      <PageContainer>
        <ContentWrapper>
          <WhiteContainer>
            <LoadingContainer>
              <CircularProgress size={60} />
              <Typography variant="h6" color="text.secondary">
                대시보드 데이터를 불러오는 중...
              </Typography>
            </LoadingContainer>
          </WhiteContainer>
        </ContentWrapper>
      </PageContainer>
    );
  }

  // 에러 발생 시
  if (error) {
    return (
      <PageContainer>
        <ContentWrapper>
          <WhiteContainer>
            <Alert 
              severity="error"
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={() => window.location.reload()}
                  >
                    다시 시도
                  </Button>
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<HomeIcon />}
                    onClick={() => window.location.href = '/'}
                  >
                    홈으로
                  </Button>
                </Box>
              }
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                데이터 로드 실패
              </Typography>
              {error}
            </Alert>
          </WhiteContainer>
        </ContentWrapper>
      </PageContainer>
    );
  }

  const { student, courses, submitted_reports } = dashboardData;

  return (
    <PageContainer>
      <ContentWrapper>
        <PageHeader>
          <PageTitle>
            학생 대시보드
          </PageTitle>
          <PageSubtitle>
            {student?.name || '학생'}님의 수강 과목과 제출 현황을 확인하세요
          </PageSubtitle>
        </PageHeader>

        {/* 🔥 전체 너비 Grid 레이아웃 */}
        <Grid container spacing={2} sx={{ width: '100%', margin: 0 }}>
          {/* 왼쪽: 과목 리스트 - 고정 너비 */}
          <Grid 
            item 
            xs={12} 
            md="auto"
            sx={{ 
              flexShrink: 0,
              width: { xs: '100%', md: '250px' },
              paddingLeft: '0 !important',
            }}
          >
            <Sidebar>
              <CourseList
                courses={courses}
                selectedCourse={selectedCourse}
                onCourseSelect={handleCourseSelect}
                onUnsubmittedClick={() => setDrawerOpen(true)}
              />
            </Sidebar>
          </Grid>

          {/* 중앙: 과제 리스트 - 유연한 너비 */}
          <Grid 
            item 
            xs={12} 
            md
            sx={{ 
              flex: 1,
              minWidth: 0,
            }}
          >
            <MainContent>
              {selectedCourse ? (
                <AssignmentList
                  course={selectedCourse}
                  submissions={submitted_reports.filter(
                    (report) => report.course_id === selectedCourse.course_id
                  )}
                  selectedAssignment={selectedAssignment}
                  onAssignmentSelect={setSelectedAssignment}
                />
              ) : (
                <WhiteContainer>
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <HomeIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      과목을 선택해주세요
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      왼쪽 목록에서 과목을 클릭하면 과제 목록을 확인할 수 있습니다
                    </Typography>
                  </Box>
                </WhiteContainer>
              )}
            </MainContent>
          </Grid>

          {/* 오른쪽: 제출물 상세 - 고정 너비 */}
          {selectedAssignment && (
            <Grid 
              item 
              xs={12} 
              md="auto"
              sx={{ 
                flexShrink: 0,
                width: { xs: '100%', md: '400px' },
              }}
            >
              <SubmissionDetail
                assignment={selectedAssignment}
                course={selectedCourse}
                submissions={submitted_reports.filter(
                  (report) => 
                    (report.assignment_id === selectedAssignment.assignment_id) ||
                    (report.assignment_id === selectedAssignment.id)
                )}
                unsubmittedReports={submitted_reports.filter((r) => !r.assignment_id)}
                onClose={() => setSelectedAssignment(null)}
                onRefresh={async () => {
                  // 데이터 새로고침
                  const userId = paramUserId || getUserIdFromToken();
                  const data = await getStudentDashboard(userId);
                  setDashboardData({
                    student: data.student || null,
                    courses: data.courses || [],
                    submitted_reports: Array.isArray(data.submitted_reports) ? data.submitted_reports : [],
                  });
                }}
              />
            </Grid>
          )}
        </Grid>

        {/* 제출하지 않은 리포트 Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: 480 },
              p: 3,
            }
          }}
        >
          <UnsubmittedReports
            reports={submitted_reports.filter((r) => !r.assignment_id)}
            onClose={() => setDrawerOpen(false)}
          />
        </Drawer>
      </ContentWrapper>
    </PageContainer>
  );
}

export default StudentDashboard;