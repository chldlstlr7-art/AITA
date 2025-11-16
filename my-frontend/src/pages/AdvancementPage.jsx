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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Description as DescriptionIcon,
  NavigateNext as NavigateNextIcon,
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
  TipsAndUpdates as TipsIcon,
  AddCircleOutline as NewReportIcon,
  List as ListIcon,
  Send as SubmitIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { getReportStatus, requestAdvancementIdeas } from '../services/api';

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

const ActionButton = styled(Button)(({ theme, variant: buttonVariant }) => {
  const isPrimary = buttonVariant === 'primary';
  const isSecondary = buttonVariant === 'secondary';
  
  return {
    padding: theme.spacing(2, 4),
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: theme.spacing(2),
    textTransform: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: 56,
    
    ...(isPrimary && {
      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
      color: 'white',
      boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
      
      '&:hover': {
        background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 28px ${alpha(theme.palette.primary.main, 0.5)}`,
      },
    }),
    
    ...(isSecondary && {
      background: alpha(theme.palette.primary.main, 0.08),
      color: theme.palette.primary.main,
      border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
      
      '&:hover': {
        background: alpha(theme.palette.primary.main, 0.15),
        borderColor: alpha(theme.palette.primary.main, 0.3),
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
      },
    }),
    
    ...(!isPrimary && !isSecondary && {
      background: 'white',
      color: theme.palette.text.primary,
      border: `2px solid ${theme.palette.divider}`,
      
      '&:hover': {
        background: alpha(theme.palette.primary.main, 0.05),
        borderColor: theme.palette.primary.main,
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
      },
    }),
  };
});

const ActionsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(3),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
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
  
  const pollingTimerRef = useRef(null);

  // 초기 리포트 데이터 로드
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const response = await getReportStatus(reportId);
        
        if (response.status === 'completed' || response.status === 'processing_questions') {
          setReportData(response.data);
          
          // 🔥 이미 생성된 아이디어가 있으면 자동 표시
          if (response.data?.advancement_ideas) {
            const parsed = typeof response.data.advancement_ideas === 'string'
              ? JSON.parse(response.data.advancement_ideas)
              : response.data.advancement_ideas;
            setIdeas(parsed);
            console.log('[AdvancementPage] ✅ 기존 아이디어 로드:', parsed);
          } else {
            // 🔥 없으면 자동 생성 시작
            console.log('[AdvancementPage] 💡 아이디어가 없습니다. 자동 생성을 시작합니다.');
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
      console.log(`[AdvancementPage] 📡 폴링 시도 ${pollingAttempts + 1}/${MAX_POLLING_ATTEMPTS}`);
      
      const response = await getReportStatus(reportId);
      const advancementIdeas = response.data?.advancement_ideas;

      if (advancementIdeas) {
        console.log('[AdvancementPage] ✅ 아이디어 생성 완료!');
        const parsed = typeof advancementIdeas === 'string'
          ? JSON.parse(advancementIdeas)
          : advancementIdeas;
        
        setIdeas(parsed);
        setIsGenerating(false);
        clearTimeout(pollingTimerRef.current);
      } else {
        setPollingAttempts(prev => prev + 1);
        
        if (pollingAttempts + 1 >= MAX_POLLING_ATTEMPTS) {
          console.error('[AdvancementPage] ⏱️ 폴링 타임아웃');
          setError('아이디어 생성 시간이 초과되었습니다. 나중에 다시 시도해주세요.');
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
      
      console.log('[AdvancementPage] 🚀 발전 아이디어 생성 요청 시작');
      const response = await requestAdvancementIdeas(reportId);
      
      console.log('[AdvancementPage] 📥 응답 데이터:', response);

      if (response.message && typeof response.message === 'string') {
        console.log('[AdvancementPage] ⏳ 202 Accepted - 백그라운드 작업 시작');
        pollingTimerRef.current = setTimeout(pollForIdeas, POLLING_INTERVAL);
      } else if (Array.isArray(response)) {
        console.log('[AdvancementPage] ✅ 200 OK - 이미 생성된 아이디어 반환');
        setIdeas(response);
        setIsGenerating(false);
      } else {
        throw new Error('예상치 못한 응답 형식입니다.');
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

  // 🔥 마무리 버튼 핸들러들
  const handleNewReport = () => {
    navigate('/'); // 🔥 홈(=대시보드)으로 이동
  };

  const handleViewSubmissions = () => {
    navigate('/'); // 🔥 홈(=대시보드)으로 이동
  };

  const handleSubmitAssignment = () => {
    alert('과제 제출 기능은 준비 중입니다.');
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

  // 로딩 화면
  if (loading) {
    return (
      <PageContainer>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress size={60} />
          </Box>
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
                <CircularProgress 
                  size={60} 
                  sx={{ 
                    color: 'primary.main',
                  }} 
                />
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

        {/* 🔥 마무리 액션 버튼들 */}
        {ideas && !isGenerating && (
          <Fade in timeout={1000}>
            <ActionsContainer elevation={0}>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  ✨ 마무리
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  발전 아이디어를 확인했다면 다음 단계를 진행하세요
                </Typography>
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Stack 
                direction={{ xs: 'column', md: 'row' }} 
                spacing={2}
                sx={{ width: '100%' }}
              >
                {/* 새로운 보고서 분석하기 */}
                <ActionButton
                  variant="secondary"
                  fullWidth
                  startIcon={<NewReportIcon />}
                  onClick={handleNewReport}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      새로운 보고서 분석하기
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      다른 과제의 보고서를 분석합니다
                    </Typography>
                  </Box>
                </ActionButton>

                {/* 나의 제출 목록 보기 */}
                <ActionButton
                  fullWidth
                  startIcon={<ListIcon />}
                  onClick={handleViewSubmissions}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      나의 제출 목록 보기
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      제출한 과제 목록을 확인합니다
                    </Typography>
                  </Box>
                </ActionButton>

                {/* 해당 과제 제출하기 */}
                <ActionButton
                  variant="primary"
                  fullWidth
                  startIcon={<SubmitIcon />}
                  onClick={handleSubmitAssignment}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      해당 과제 제출하기
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      최종 보고서를 제출합니다
                    </Typography>
                  </Box>
                </ActionButton>
              </Stack>
            </ActionsContainer>
          </Fade>
        )}
      </Container>
    </PageContainer>
  );
}

export default AdvancementPage;