import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Breadcrumbs,
  Link,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Fade,
  Slide,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Autocomplete, // 👈 추가
  TextField,    // 👈 추가
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Description as DescriptionIcon,
  NavigateNext as NavigateNextIcon,
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
  TipsAndUpdates as TipsIcon,
  Send as SubmitIcon,
  CheckCircle as SuccessIcon,
  PersonSearch as PersonSearchIcon, // 👈 아이콘 추가
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { 
  getReportStatus, 
  requestAdvancementIdeas,
  submitReportToAssignment,
  getStudentCourseAssignments,
  getStudentDashboard,
  getTaCourses,       // 👈 추가: 학생 목록 구하기용
  getCourseStudents,  // 👈 추가: 학생 목록 구하기용
  getAssignmentsByCourse, // 👈 추가: 개발자용 과제 조회용
} from '../services/api';

import AdvancementActions from '../components/AdvancementActions';

// ==================== Constants ====================

// 🔥 개발자 이메일 목록 (Header.js와 동일)
const DEV_EMAILS = [
  "dabok2@snu.ac.kr",
  "dev2@snu.ac.kr",
  "dev3@snu.ac.kr",
  "dev@snu.ac.kr"
];

const POLLING_INTERVAL = 3000;
const MAX_POLLING_ATTEMPTS = 60;

// ==================== Styled Components ====================

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(6),
}));

const HeaderPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginBottom: theme.spacing(3),
  background: 'white',
  borderRadius: theme.spacing(3),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  background: 'white',
  borderRadius: theme.spacing(3),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: `${theme.spacing(2)} !important`,
  overflow: 'hidden',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  marginBottom: theme.spacing(2),
  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.06)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:before': { display: 'none' },
  '&:hover': {
    boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
    transform: 'translateY(-2px)',
  },
  '&.Mui-expanded': {
    margin: `${theme.spacing(2)} 0`,
    boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
}));

const LoadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8),
  gap: theme.spacing(3),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
  borderRadius: theme.spacing(3),
  border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
}));

const IdeaChip = styled(Chip)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  color: 'white',
  fontWeight: 700,
  minWidth: 36,
  height: 36,
  fontSize: '0.875rem',
  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const EvidenceBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '4px',
    height: '100%',
    background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
}));

const PageTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 800,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginBottom: theme.spacing(1),
}));

// ==================== Main Component ====================

function AdvancementPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  
  const [reportData, setReportData] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  // 🔥 과제 제출 다이얼로그 관련 상태
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // 🔥 개발자용 학생 선택 상태
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [studentList, setStudentList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null); // 개발자가 선택한 학생
  const [loadingStudentList, setLoadingStudentList] = useState(false);

  const pollingTimerRef = useRef(null);

  // 현재 사용자 이메일 확인
  const getCurrentUserEmail = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return '';
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email || '';
    } catch {
        return '';
    }
  };

  // 현재 사용자 ID 가져오기
  const getUserId = () => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    let userId = userData.user_id || userData.id;
    if (!userId) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub || payload.user_id || payload.id;
        } catch (e) { }
      }
    }
    return userId;
  };
  
  const currentStudentId = getUserId();

  // 초기 로드 및 권한 확인
  useEffect(() => {
    const email = getCurrentUserEmail();
    if (DEV_EMAILS.includes(email)) {
      setIsDeveloper(true);
    }

    const fetchReportData = async () => {
      try {
        setLoading(true);
        const response = await getReportStatus(reportId);
        
        if (response.status === 'completed' || response.status === 'processing_questions') {
          setReportData(response.data);
          
          if (response.data?.advancement_ideas) {
            const parsed = typeof response.data.advancement_ideas === 'string'
              ? JSON.parse(response.data.advancement_ideas)
              : response.data.advancement_ideas;
            setIdeas(parsed);
          } else {
            handleGenerateIdeas();
          }
        } else {
          setError('리포트 분석이 아직 완료되지 않았습니다.');
        }
      } catch (err) {
        console.error('[AdvancementPage] 리포트 조회 실패:', err);
        setError(err.message || '리포트를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      fetchReportData();
    }

    return () => {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, [reportId]);

  // ... (폴링 및 아이디어 생성 로직은 기존과 동일)
  const pollForIdeas = async () => {
    try {
      const response = await getReportStatus(reportId);
      const advancementIdeas = response.data?.advancement_ideas;
      if (advancementIdeas) {
        const parsed = typeof advancementIdeas === 'string' ? JSON.parse(advancementIdeas) : advancementIdeas;
        setIdeas(parsed);
        setIsGenerating(false);
        clearTimeout(pollingTimerRef.current);
      } else {
        setPollingAttempts(prev => prev + 1);
        if (pollingAttempts + 1 >= MAX_POLLING_ATTEMPTS) {
          setError('아이디어 생성 시간이 초과되었습니다.');
          setIsGenerating(false);
        } else {
          pollingTimerRef.current = setTimeout(pollForIdeas, POLLING_INTERVAL);
        }
      }
    } catch (err) {
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const handleGenerateIdeas = async () => {
    try {
      setIsGenerating(true);
      setError('');
      setPollingAttempts(0);
      const response = await requestAdvancementIdeas(reportId);
      if (response.status === 'processing') {
        pollingTimerRef.current = setTimeout(pollForIdeas, POLLING_INTERVAL);
      } else if (response.status === 'completed' && response.data) {
        setIdeas(response.data);
        setIsGenerating(false);
      } else if (Array.isArray(response)) {
        setIdeas(response);
        setIsGenerating(false);
      }
    } catch (err) {
      setError(err.message || '아이디어 생성에 실패했습니다.');
      setIsGenerating(false);
    }
  };

  const handleBack = () => navigate(`/report/${reportId}`);
  const handleNewReport = () => navigate('/');
  const handleViewDashboard = () => {
    if (currentStudentId) navigate(`/dashboard/${currentStudentId}`);
    else setSnackbar({ open: true, message: '로그인 정보를 찾을 수 없습니다.', severity: 'error' });
  };

  // 🔥 [개발자용] 모든 학생 목록 불러오기 (Header.js 전략 재사용)
  const fetchAllStudents = async () => {
    try {
      setLoadingStudentList(true);
      const coursesData = await getTaCourses();
      const courses = Array.isArray(coursesData) ? coursesData : (coursesData.courses || []);
      
      if (courses.length === 0) {
        setStudentList([]);
        return;
      }

      const studentPromises = courses.map(course => 
        getCourseStudents(course.course_id || course.id)
          .then(res => ({ students: Array.isArray(res) ? res : (res.students || []) }))
          .catch(() => ({ students: [] }))
      );

      const results = await Promise.all(studentPromises);
      const allStudents = results.flatMap(r => r.students);

      // 중복 제거
      const uniqueStudentsMap = new Map();
      allStudents.forEach(student => {
        if (student && student.id) uniqueStudentsMap.set(student.id, student);
      });

      setStudentList(Array.from(uniqueStudentsMap.values()));
    } catch (err) {
      console.error('학생 목록 로드 실패:', err);
      setSnackbar({ open: true, message: '학생 목록을 불러오지 못했습니다.', severity: 'error' });
    } finally {
      setLoadingStudentList(false);
    }
  };

  // 🔥 과제 제출 다이얼로그 열기 (로직 수정됨)
  const handleOpenSubmitDialog = async () => {
    setSubmitDialogOpen(true);
    setCourses([]);
    setSelectedCourseId('');
    setAssignments([]);
    setSelectedAssignmentId('');
    setSelectedStudent(null);

    // 개발자라면 학생 목록을 먼저 불러옴
    if (isDeveloper) {
      await fetchAllStudents();
    } else {
      // 일반 학생은 본인의 과목 로드
      await loadCoursesForStudent(currentStudentId);
    }
  };

  // 🔥 특정 학생의 수강 과목 로드
  const loadCoursesForStudent = async (studentId) => {
    if (!studentId) return;
    try {
      setLoadingCourses(true);
      const dashboardData = await getStudentDashboard(studentId);
      
      // dashboardData.courses는 [{course_id:..., course_name:...}, ...] 형태
      const coursesData = dashboardData.courses || [];
      setCourses(coursesData);
      
    } catch (err) {
      console.error('과목 로드 실패:', err);
      setSnackbar({ open: true, message: '해당 학생의 과목 정보를 불러오지 못했습니다.', severity: 'error' });
    } finally {
      setLoadingCourses(false);
    }
  };

  // 🔥 [개발자용] 학생 선택 핸들러
  const handleStudentSelect = async (student) => {
    setSelectedStudent(student);
    setSelectedCourseId('');
    setAssignments([]);
    setSelectedAssignmentId('');
    
    if (student) {
      await loadCoursesForStudent(student.id);
    } else {
      setCourses([]);
    }
  };

  // 🔥 과목 선택 핸들러
  const handleCourseSelect = async (courseId) => {
    try {
      setSelectedCourseId(courseId);
      setSelectedAssignmentId('');
      setAssignments([]);
      
      if (!courseId) return;
      
      setLoadingAssignments(true);
      
      let response = [];
      if (isDeveloper) {
         // 개발자는 TA API로 모든 과제 조회 (수강생 체크 우회)
         const res = await getAssignmentsByCourse(courseId);
         response = Array.isArray(res) ? res : (res.assignments || []);
      } else {
         // 학생은 본인 수강 과목의 과제만 조회
         response = await getStudentCourseAssignments(courseId);
      }
      
      setAssignments(response || []);
      
    } catch (err) {
      console.error('과제 목록 조회 실패:', err);
      setSnackbar({ open: true, message: '과제 목록을 불러오지 못했습니다.', severity: 'error' });
    } finally {
      setLoadingAssignments(false);
    }
  };

  // 🔥 과제 제출 핸들러
  const handleSubmitToAssignment = async () => {
    if (!selectedAssignmentId) return;
    
    try {
      setSubmitting(true);
      // submitReportToAssignment API는 현재 로그인한 사용자의 토큰을 사용함.
      // 개발자(Admin)가 제출할 때는 백엔드에서 권한이 열려있어야 함 (이전 수정사항 적용됨).
      // 만약 report 소유자와 제출자가 다를 경우 백엔드에서 처리됨.
      await submitReportToAssignment(reportId, selectedAssignmentId);
      
      setSnackbar({ open: true, message: '과제가 성공적으로 제출되었습니다!', severity: 'success' });
      setSubmitDialogOpen(false);
      
      // 제출 후 해당 학생의 대시보드로 이동 (선택)
      setTimeout(() => {
        const targetId = selectedStudent ? selectedStudent.id : currentStudentId;
        navigate(`/dashboard/${targetId}`);
      }, 1500);
      
    } catch (err) {
      console.error('제출 실패:', err);
      setSnackbar({ open: true, message: err.message || '과제 제출에 실패했습니다.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // 렌더링 헬퍼들 생략 (renderEvidence, Loading, Error 등 기존 유지)
  const renderEvidence = (evidence) => {
    if (!evidence) return '근거 정보가 없습니다.';
    if (typeof evidence === 'string') return evidence;
    if (typeof evidence === 'object') {
      if (Array.isArray(evidence)) {
        return evidence.map((item) => {
          if (typeof item === 'string') return item;
          if (item.q && item.a) return `Q: ${item.q}\nA: ${item.a}`;
          return JSON.stringify(item);
        }).join('\n\n');
      }
      if (evidence.q && evidence.a) return `Q: ${evidence.q}\nA: ${evidence.a}`;
      return JSON.stringify(evidence, null, 2);
    }
    return String(evidence);
  };

  if (loading) {
    return (
      <PageContainer>
        <Container maxWidth="lg">
          <LoadingBox sx={{ mt: 4, minHeight: '60vh' }}>
            <CircularProgress size={60} sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>리포트 데이터를 불러오는 중...</Typography>
          </LoadingBox>
        </Container>
      </PageContainer>
    );
  }

  if (error && !isGenerating) {
    return (
      <PageContainer>
        <Container maxWidth="lg">
          <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>
          <Box mt={2} textAlign="center">
            <Button variant="contained" onClick={handleBack}>리포트로 돌아가기</Button>
          </Box>
        </Container>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Container maxWidth="lg">
        {/* 헤더 영역 (기존과 동일) */}
        <Fade in timeout={600}>
          <HeaderPaper elevation={0}>
            <Box display="flex" alignItems="center" gap={2}>
              <IconButton onClick={handleBack} sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) }}>
                <ArrowBackIcon />
              </IconButton>
              <Box flex={1}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1.5 }}>
                  <Link underline="hover" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'text.secondary' }} onClick={() => navigate('/')}>
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />대시보드
                  </Link>
                  <Link underline="hover" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'text.secondary' }} onClick={handleBack}>
                    <DescriptionIcon sx={{ mr: 0.5 }} fontSize="small" />리포트
                  </Link>
                  <Typography color="primary" sx={{ fontWeight: 600 }}>발전 아이디어</Typography>
                </Breadcrumbs>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ width: 56, height: 56, borderRadius: 2, background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TipsIcon sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <PageTitle variant="h4">발전 아이디어</PageTitle>
                    {reportData?.report_title && <Typography variant="body2" color="text.secondary">{reportData.report_title}</Typography>}
                  </Box>
                </Box>
              </Box>
            </Box>
          </HeaderPaper>
        </Fade>

        {/* 콘텐츠 영역 (기존과 동일) */}
        <Slide direction="up" in timeout={800}>
          <ContentPaper elevation={0}>
            {isGenerating && (
              <LoadingBox>
                <CircularProgress size={60} sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>AI가 발전 아이디어를 생성하고 있습니다</Typography>
                <Typography variant="body2" color="text.secondary">리포트 내용과 대화 기록을 분석 중입니다</Typography>
              </LoadingBox>
            )}

            {ideas && !isGenerating && (
              <Box>
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>AI 발전 아이디어</Typography>
                  <Typography variant="body2" color="text.secondary">총 {ideas.length}개의 아이디어가 생성되었습니다</Typography>
                </Box>
                <Stack spacing={2.5}>
                  {ideas.map((item, index) => (
                    <Fade in key={index} timeout={600 + index * 100}>
                      <StyledAccordion elevation={0}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1.5 }}>
                          <IdeaChip label={index + 1} />
                          <Box flex={1} ml={2}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <LightbulbIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>{item.idea || '아이디어'}</Typography>
                            </Stack>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 3, pb: 3 }}>
                          <EvidenceBox>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>근거</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>{renderEvidence(item.evidence)}</Typography>
                          </EvidenceBox>
                        </AccordionDetails>
                      </StyledAccordion>
                    </Fade>
                  ))}
                </Stack>
              </Box>
            )}
          </ContentPaper>
        </Slide>

        {/* 하단 액션 버튼 */}
        {ideas && !isGenerating && (
          <AdvancementActions
            onNewReport={handleNewReport}
            onViewDashboard={handleViewDashboard}
            onSubmit={handleOpenSubmitDialog}
            studentId={currentStudentId} 
            reportId={reportId}
          />
        )}
      </Container>

      {/* 🔥 과제 제출 다이얼로그 (수정됨) */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => !submitting && setSubmitDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'visible' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.5rem' }}>
          <Box display="flex" alignItems="center" gap={1}>
             {isDeveloper ? <PersonSearchIcon color="primary" /> : <SubmitIcon color="primary" />}
             {isDeveloper ? '학생 대리 제출' : '과제 제출'}
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2, minHeight: '300px' }}>
          <Box sx={{ mt: 1 }}>
            {/* 🚀 [개발자용] 학생 선택 섹션 */}
            {isDeveloper && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: bold => 700 }}>
                  1. 학생 선택 (개발자 전용)
                </Typography>
                <Autocomplete
                  options={studentList}
                  loading={loadingStudentList}
                  getOptionLabel={(option) => `${option.name || '이름없음'} (${option.email})`}
                  value={selectedStudent}
                  onChange={(event, newValue) => handleStudentSelect(newValue)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="학생 검색 (이름/이메일)" 
                      variant="outlined" 
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <React.Fragment>
                            {loadingStudentList ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </React.Fragment>
                        ),
                      }}
                    />
                  )}
                  noOptionsText="학생을 찾을 수 없습니다."
                />
                {!selectedStudent && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    * 먼저 학생을 선택해야 과목 목록이 로드됩니다.
                  </Typography>
                )}
              </Box>
            )}

            {/* 과목 선택 */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="course-select-label">과목 선택</InputLabel>
              <Select
                labelId="course-select-label"
                value={selectedCourseId}
                onChange={(e) => handleCourseSelect(e.target.value)}
                label="과목 선택"
                disabled={loadingCourses || submitting || (isDeveloper && !selectedStudent)}
              >
                {loadingCourses ? (
                  <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} />로딩 중...</MenuItem>
                ) : courses.length === 0 ? (
                  <MenuItem disabled>수강 중인 과목이 없습니다</MenuItem>
                ) : (
                  courses.map((course) => (
                    <MenuItem key={course.course_id || course.id} value={course.course_id || course.id}>
                      {course.course_code} - {course.course_name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* 과제 선택 */}
            {selectedCourseId && (
              <FormControl fullWidth>
                <InputLabel id="assignment-select-label">과제 선택</InputLabel>
                <Select
                  labelId="assignment-select-label"
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  label="과제 선택"
                  disabled={loadingAssignments || submitting}
                >
                  {loadingAssignments ? (
                    <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} />로딩 중...</MenuItem>
                  ) : assignments.length === 0 ? (
                    <MenuItem disabled>등록된 과제가 없습니다</MenuItem>
                  ) : (
                    assignments.map((assignment) => (
                      <MenuItem key={assignment.id} value={assignment.id}>
                        {assignment.assignment_name}
                        {assignment.due_date && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            (마감: {new Date(assignment.due_date).toLocaleDateString()})
                          </Typography>
                        )}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}

            {/* 제출 확인 메시지 */}
            {selectedCourseId && selectedAssignmentId && (
              <Alert severity="info" icon={<SuccessIcon />} sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>제출 준비 완료</Typography>
                <Typography variant="caption" color="text.secondary">
                  {isDeveloper && selectedStudent 
                    ? <strong>[{selectedStudent.name}]</strong> 
                    : "선택한"} 학생의 과제에 리포트를 제출합니다.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setSubmitDialogOpen(false)} disabled={submitting} sx={{ fontWeight: 600 }}>취소</Button>
          <Button 
            onClick={handleSubmitToAssignment}
            variant="contained"
            disabled={!selectedAssignmentId || submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : <SubmitIcon />}
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2, fontWeight: 600 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}

export default AdvancementPage;