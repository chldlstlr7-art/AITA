import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
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

import { 
  getStudentDashboard, 
  getStudentCourseAssignments,
  getAssignmentsByCourse // 👈 [중요] 관리자용 과제 조회 API
} from '../services/api.js';
import { getUserIdFromToken } from '../utils/jwtHelper.js';

// ==================== Constants ====================

// 🔥 개발자(Admin) 이메일 목록
const DEV_EMAILS = [
  "dabok2@snu.ac.kr",
  "dev2@snu.ac.kr",
  "dev3@snu.ac.kr",
  "dev@snu.ac.kr"
];

// ==================== Styled Components ====================

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: '#f8f9fa',
  padding: theme.spacing(3),
  width: '100%',
}));

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
  '&::-webkit-scrollbar': { width: '6px' },
  '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
  '&::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.divider, borderRadius: '3px' },
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

  // 현재 로그인한 사용자 이메일 확인
  const getCurrentUserEmail = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return '';
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email || '';
    } catch (e) {
        return '';
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = paramUserId || getUserIdFromToken();
        if (!userId) throw new Error('로그인이 필요합니다.');

        // 1. 대시보드 기본 데이터 가져오기
        // 개발자가 Admin 권한이 있다면, 이 API는 정상적으로 200 OK와 데이터를 반환합니다.
        const data = await getStudentDashboard(userId);
        
        // 2. 개발자(Admin) 여부 확인
        const currentUserEmail = getCurrentUserEmail();
        const isDeveloper = DEV_EMAILS.includes(currentUserEmail);

        console.log(`[Dashboard] TargetUser: ${userId}, LoginUser: ${currentUserEmail}, IsDev: ${isDeveloper}`);

        if (data.courses && data.courses.length > 0) {
          
          // 3. 각 과목의 과제 목록 가져오기
          const coursesWithAssignments = await Promise.all(
            data.courses.map(async (course) => {
              try {
                let assignmentsData = [];

                if (isDeveloper) {
                  // ✅ [Case A] 개발자(Admin)인 경우
                  // Admin은 해당 과목의 수강생(Enrollment)이 아닐 확률이 높습니다.
                  // 따라서 수강생 체크를 하는 학생용 API 대신, TA용 API를 써야 과제 목록이 보입니다.
                  const res = await getAssignmentsByCourse(course.course_id);
                  
                  if (Array.isArray(res)) {
                    assignmentsData = res;
                  } else if (res && Array.isArray(res.assignments)) {
                    assignmentsData = res.assignments;
                  }
                } else {
                  // 🟦 [Case B] 일반 학생인 경우
                  // 수강생 검증이 필요한 기존 API 사용
                  assignmentsData = await getStudentCourseAssignments(course.course_id);
                }
                
                return {
                  ...course,
                  assignments: Array.isArray(assignmentsData) ? assignmentsData : [],
                };
              } catch (err) {
                console.error(`[Dashboard] 과제 로드 실패 (${course.course_code}):`, err);
                return { ...course, assignments: [] };
              }
            })
          );

          setDashboardData({
            student: data.student || null,
            courses: coursesWithAssignments,
            submitted_reports: Array.isArray(data.submitted_reports) ? data.submitted_reports : [],
          });

          if (coursesWithAssignments.length > 0) {
            setSelectedCourse(coursesWithAssignments[0]);
          }

        } else {
          setDashboardData({
            student: data.student || null,
            courses: [],
            submitted_reports: Array.isArray(data.submitted_reports) ? data.submitted_reports : [],
          });
        }

      } catch (err) {
        console.error('[StudentDashboard] 데이터 로드 실패:', err);
        setError(err.message || '데이터를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [paramUserId]);

  const handleCourseSelect = (course) => {
    setSelectedCourse(course);
    setSelectedAssignment(null);
  };

  if (loading) {
    return (
      <PageContainer>
        <ContentWrapper>
          <WhiteContainer>
            <LoadingContainer>
              <CircularProgress size={60} />
              <Typography variant="h6" color="text.secondary">대시보드 로딩 중...</Typography>
            </LoadingContainer>
          </WhiteContainer>
        </ContentWrapper>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ContentWrapper>
          <WhiteContainer>
            <Alert severity="error">{error}</Alert>
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
          <PageTitle>학생 대시보드</PageTitle>
          <PageSubtitle>{student?.name || '학생'}님의 학습 현황</PageSubtitle>
        </PageHeader>

        <Grid container spacing={2} sx={{ width: '100%', margin: 0 }}>
          {/* 왼쪽: 과목 리스트 */}
          <Grid item xs={12} md="auto" sx={{ flexShrink: 0, width: { xs: '100%', md: '250px' }, paddingLeft: '0 !important' }}>
            <Sidebar>
              <CourseList
                courses={courses}
                // 🔥 [핵심 수정] 이 props가 없어서 리포트 버튼이 안 떴던 것입니다.
                unsubmittedReports={submitted_reports.filter(r => !r.assignment_id)}
                
                selectedCourse={selectedCourse}
                onCourseSelect={handleCourseSelect}
                onUnsubmittedClick={() => setDrawerOpen(true)}
              />
            </Sidebar>
          </Grid>

          {/* 중앙: 과제 리스트 */}
          <Grid item xs={12} md sx={{ flex: 1, minWidth: 0 }}>
            <MainContent>
              {selectedCourse ? (
                <AssignmentList
                  course={selectedCourse}
                  submissions={submitted_reports.filter((r) => r.course_id === selectedCourse.course_id)}
                  selectedAssignment={selectedAssignment}
                  onAssignmentSelect={setSelectedAssignment}
                />
              ) : (
                <WhiteContainer>
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <HomeIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    <Typography color="text.secondary" sx={{ mt: 2 }}>과목을 선택해주세요</Typography>
                  </Box>
                </WhiteContainer>
              )}
            </MainContent>
          </Grid>

          {/* 오른쪽: 제출물 상세 */}
          {selectedAssignment && (
            <Grid item xs={12} md="auto" sx={{ flexShrink: 0, width: { xs: '100%', md: '400px' } }}>
              <SubmissionDetail
                assignment={selectedAssignment}
                course={selectedCourse}
                submissions={submitted_reports.filter((r) => 
                  (r.assignment_id === selectedAssignment.assignment_id) || (r.assignment_id === selectedAssignment.id)
                )}
                unsubmittedReports={submitted_reports.filter((r) => !r.assignment_id)}
                onClose={() => setSelectedAssignment(null)}
                onRefresh={() => window.location.reload()}
              />
            </Grid>
          )}
        </Grid>

        {/* 미제출 리포트 Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 3 } }}
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