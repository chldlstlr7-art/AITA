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
  LinearProgress,
  Fade,
  Slide,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
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
} from '@mui/icons-material'; // <-- [수정] 오타 수정
import { styled, alpha } from '@mui/material/styles';
import { 
  getReportStatus, 
  requestAdvancementIdeas,
  submitReportToAssignment,
  getStudentCourseAssignments,
  getStudentDashboard,
} from '../services/api';

// 🔥 마무리 버튼 컴포넌트 import
import AdvancementActions from '../components/AdvancementActions';

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

// ==================== Constants ====================

const POLLING_INTERVAL = 3000;
const MAX_POLLING_ATTEMPTS = 60;

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
  
  const pollingTimerRef = useRef(null);

  // 🔥 사용자 ID 가져오기 헬퍼
  const getUserId = () => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    let userId = userData.user_id || userData.id;
    
    if (!userId) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub || payload.user_id || payload.id;
        } catch (e) {
          console.error('[getUserId] JWT 파싱 실패:', e);
        }
      }
    }
    
    return userId;
  };
  
  const currentStudentId = getUserId();

  // 초기 리포트 데이터 로드
  useEffect(() => {
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
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, [reportId]);

  // 폴링 로직
  const pollForIdeas = async () => {
    try {
      const response = await getReportStatus(reportId);
      const advancementIdeas = response.data?.advancement_ideas;

      if (advancementIdeas) {
        const parsed = typeof advancementIdeas === 'string'
          ? JSON.parse(advancementIdeas)
          : advancementIdeas;
        
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
      console.error('[AdvancementPage] 폴링 실패:', err);
      setError(err.message);
      setIsGenerating(false);
    }
  };

  // 아이디어 생성 요청
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
      console.error('[AdvancementPage] 생성 실패:', err);
      setError(err.message || '아이디어 생성에 실패했습니다.');
      setIsGenerating(false);
    }
  };

  const handleBack = () => {
    navigate(`/report/${reportId}`);
  };

  // 🔥 새로운 보고서 분석하기
  const handleNewReport = () => {
    navigate('/');
  };

  // 🔥 학생 대시보드 보기
  const handleViewDashboard = () => {
    if (currentStudentId) {
      navigate(`/dashboard/${currentStudentId}`);
    } else {
      setSnackbar({
        open: true,
        message: '로그인 정보를 찾을 수 없습니다.',
        severity: 'error',
      });
    }
  };

  // 🔥 과제 제출 다이얼로그 열기
  const handleOpenSubmitDialog = async () => {
    try {
      setLoadingCourses(true);
      setSubmitDialogOpen(true);
      
      if (!currentStudentId) {
        throw new Error('로그인 정보를 찾을 수 없습니다.');
      }
      
      const dashboardData = await getStudentDashboard(currentStudentId);
      
      const coursesData = dashboardData.courses_with_submissions?.map(course => ({
        id: course.course_id,
        course_code: course.course_code,
        course_name: course.course_name,
      })) || [];
      
      setCourses(coursesData);
      
    } catch (err) {
      console.error('[AdvancementPage] 과목 목록 조회 실패:', err);
      setSnackbar({
        open: true,
        message: err.message || '과목 목록을 불러오는 데 실패했습니다.',
        severity: 'error',
      });
    } finally {
      setLoadingCourses(false);
    }
  };

  // 🔥 과목 선택
  const handleCourseSelect = async (courseId) => {
    try {
      setSelectedCourseId(courseId);
      setSelectedAssignmentId('');
      setAssignments([]);
      
      if (!courseId) return;
      
      setLoadingAssignments(true);
      const response = await getStudentCourseAssignments(courseId);
      setAssignments(response || []);
      
    } catch (err) {
      console.error('[AdvancementPage] 과제 목록 조회 실패:', err);
      setSnackbar({
        open: true,
        message: err.message || '과제 목록을 불러오는 데 실패했습니다.',
        severity: 'error',
      });
    } finally {
      setLoadingAssignments(false);
    }
  };

  // 🔥 과제 제출
  const handleSubmitToAssignment = async () => {
    if (!selectedAssignmentId) {
      setSnackbar({
        open: true,
        message: '과제를 선택해주세요.',
        severity: 'warning',
      });
      return;
    }
    
    try {
      setSubmitting(true);
      await submitReportToAssignment(reportId, selectedAssignmentId);
      
      setSnackbar({
        open: true,
        message: '과제가 성공적으로 제출되었습니다!',
        severity: 'success',
      });
      
      setSubmitDialogOpen(false);
      
      setTimeout(() => {
        handleViewDashboard();
      }, 3000);
      
    } catch (err) {
      console.error('[AdvancementPage] 과제 제출 실패:', err);
      setSnackbar({
        open: true,
        message: err.message || '과제 제출에 실패했습니다.',
        severity: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // evidence 데이터 안전하게 렌더링
  const renderEvidence = (evidence) => {
    if (!evidence) return '근거 정보가 없습니다.';
    if (typeof evidence === 'string') return evidence;
    
    if (typeof evidence === 'object') {
      if (Array.isArray(evidence)) {
        return evidence.map((item, idx) => {
          if (typeof item === 'string') return item;
          if (item.q && item.a) return `Q: ${item.q}\nA: ${item.a}`;
          return JSON.stringify(item);
        }).join('\n\n');
      }
      
      if (evidence.q && evidence.a) {
        return `Q: ${evidence.q}\nA: ${evidence.a}`;
      }
      
      return JSON.stringify(evidence, null, 2);
    }
    
    return String(evidence);
  };

  // 로딩 화면 (개선된 버전 유지)
  if (loading) {
    return (
      <PageContainer>
        <Container maxWidth="lg">
          <LoadingBox sx={{ mt: 4, minHeight: '60vh' }}>
            <CircularProgress size={60} sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              리포트 데이터를 불러오는 중...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              분석 완료 여부를 확인하고 있습니다. 잠시만 기다려주세요.
            </Typography>
          </LoadingBox>
        </Container>
      </PageContainer>
    );
  }

  // 에러 화면
  if (error && !isGenerating) {
    return (
      <PageContainer>
        <Container maxWidth="lg">
          <Alert severity="error" sx={{ mt: 4 }}>
            {error}
          </Alert>
          <Box mt={2} textAlign="center">
            <Button variant="contained" onClick={handleBack}>
              리포트로 돌아가기
            </Button>
          </Box>
        </Container>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Container maxWidth="lg">
        {/* 헤더 */}
        <Fade in timeout={600}>
          <HeaderPaper elevation={0}>
            <Box display="flex" alignItems="center" gap={2}>
              <IconButton 
                onClick={handleBack} 
                sx={{ 
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                  }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              
              <Box flex={1}>
                <Breadcrumbs
                  separator={<NavigateNextIcon fontSize="small" />}
                  sx={{ mb: 1.5 }}
                >
                  <Link
                    underline="hover"
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main' }
                    }}
                    onClick={() => navigate('/')}
                  >
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                    대시보드
                  </Link>
                  <Link
                    underline="hover"
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main' }
                    }}
                    onClick={handleBack}
                  >
                    <DescriptionIcon sx={{ mr: 0.5 }} fontSize="small" />
                    리포트
                  </Link>
                  <Typography
                    sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}
                    color="primary"
                  >
                    발전 아이디어
                  </Typography>
                </Breadcrumbs>
                
                <Box display="flex" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                    }}
                  >
                    <TipsIcon sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  
                  <Box>
                    <PageTitle variant="h4">
                      발전 아이디어
                    </PageTitle>
                    {reportData?.report_title && (
                      <Typography variant="body2" color="text.secondary">
                        {reportData.report_title}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          </HeaderPaper>
        </Fade>

        {/* 본문 */}
        <Slide direction="up" in timeout={800}>
          <ContentPaper elevation={0}>
            {/* 생성 중 */}
            {isGenerating && (
              <LoadingBox>
                <CircularProgress size={60} sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  AI가 발전 아이디어를 생성하고 있습니다
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  리포트 내용과 대화 기록을 분석 중입니다
                </Typography>
                <Box sx={{ width: '100%', maxWidth: 400 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={(pollingAttempts / MAX_POLLING_ATTEMPTS) * 100}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                    진행률: {pollingAttempts + 1} / {MAX_POLLING_ATTEMPTS}
                  </Typography>
                </Box>
              </LoadingBox>
            )}

            {/* 아이디어 표시 */}
            {ideas && !isGenerating && (
              <Box>
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    💡 AI 발전 아이디어
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    총 {ideas.length}개의 아이디어가 생성되었습니다
                  </Typography>
                </Box>
                
                <Stack spacing={2.5}>
                  {ideas.map((item, index) => (
                    <Fade in key={index} timeout={600 + index * 100}>
                      <StyledAccordion elevation={0}>
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{
                            px: 3,
                            py: 1.5,
                            '& .MuiAccordionSummary-content': {
                              alignItems: 'center',
                              gap: 2,
                              my: 1,
                            },
                          }}
                        >
                          <IdeaChip label={index + 1} />
                          <Box flex={1}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <LightbulbIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                {item.idea || '아이디어'}
                              </Typography>
                            </Stack>
                          </Box>
                        </AccordionSummary>
                        
                        <AccordionDetails sx={{ px: 3, pb: 3 }}>
                          <EvidenceBox>
                            <Typography 
                              variant="subtitle2" 
                              gutterBottom 
                              sx={{ 
                                fontWeight: 700, 
                                color: 'primary.main',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 2,
                              }}
                            >
                              📚 근거
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                lineHeight: 1.8, 
                                color: 'text.secondary',
                                whiteSpace: 'pre-wrap',
                                pl: 1,
                              }}
                            >
                              {renderEvidence(item.evidence)}
                            </Typography>
                          </EvidenceBox>
                        </AccordionDetails>
                      </StyledAccordion>
                    </Fade>
                  ))}
                </Stack>
              </Box>
            )}

            {/* 에러 메시지 */}
            {error && !isGenerating && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </ContentPaper>
        </Slide>

        {/* 🔥 마무리 액션 버튼들 (컴포넌트 분리) */}
        {ideas && !isGenerating && (
          <AdvancementActions
            onNewReport={handleNewReport}
            onViewDashboard={handleViewDashboard}
            onSubmit={handleOpenSubmitDialog}
            
            // --- 👇 [수정] 이 두 props를 전달합니다 ---
            studentId={currentStudentId} 
            reportId={reportId}
            // --- 👆 [수정] ---
          />
        )}
      </Container>

      {/* 🔥 과제 제출 다이얼로그 */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => !submitting && setSubmitDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
          },
          tabIndex: -1, // 접근성 경고 수정
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.5rem' }}>
          📤 과제 제출
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="course-select-label">과목 선택</InputLabel>
              <Select
                labelId="course-select-label"
                value={selectedCourseId}
                onChange={(e) => handleCourseSelect(e.target.value)}
                label="과목 선택"
                disabled={loadingCourses || submitting}
              >
                {loadingCourses ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    로딩 중...
                  </MenuItem>
                ) : courses.length === 0 ? (
                  <MenuItem disabled>수강 중인 과목이 없습니다</MenuItem>
                ) : (
                  courses.map((course) => (
                    // [수정] courses 데이터 구조 변경 (id, course_code, course_name)
                    <MenuItem key={course.id} value={course.id}>
                      {course.course_code} - {course.course_name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

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
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      로딩 중...
                    </MenuItem>
                  ) : assignments.length === 0 ? (
                    <MenuItem disabled>등록된 과제가 없습니다</MenuItem>
                  ) : (
                    assignments.map((assignment) => (
                      // [수정] assignments 데이터 구조 변경 (id, assignment_name)
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

            {selectedCourseId && selectedAssignmentId && (
              <Alert 
                severity="info" 
                icon={<SuccessIcon />}
                sx={{ mt: 3 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  제출 준비 완료
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  선택한 과제에 현재 리포트를 제출합니다.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={() => setSubmitDialogOpen(false)}
            disabled={submitting}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            취소
          </Button>
          <Button 
            onClick={handleSubmitToAssignment}
            variant="contained"
            disabled={!selectedAssignmentId || submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : <SubmitIcon />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🔥 스낵바 (알림) */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ 
            width: '100%',
            borderRadius: 2,
            fontWeight: 600,
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}

export default AdvancementPage;