import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getReportStatus } from '../services/api.js';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Alert, 
  Paper,
  Fade,
  Button,
  Container,
  Stack,
  Avatar,
  Tabs,
  Tab,
  Chip,
  LinearProgress
} from '@mui/material';
import { 
  AutoAwesome, 
  Assessment, 
  ChatBubbleOutline,
  TipsAndUpdates,
  Summarize,
  ContentCopy,
  Description,
  Lock,
  CheckCircle
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import ReportDisplay from '../components/ReportDisplay.jsx';
import SimilarityAnalysis from '../components/SimilarityAnalysis.jsx';

// ==================== Styled Components ====================

const PageHeader = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  borderRadius: theme.spacing(3),
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.25)}`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    background: `radial-gradient(circle, ${alpha(theme.palette.common.white, 0.1)} 0%, transparent 70%)`,
    borderRadius: '50%',
  },
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  background: alpha(theme.palette.primary.main, 0.05),
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1),
  marginBottom: theme.spacing(4),
  '& .MuiTabs-indicator': {
    height: 4,
    borderRadius: 2,
    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '1.1rem',
  minHeight: 72,
  padding: theme.spacing(2, 4),
  borderRadius: theme.spacing(1.5),
  transition: 'all 0.3s ease',
  '&:hover': {
    background: alpha(theme.palette.primary.main, 0.08),
  },
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    background: alpha(theme.palette.primary.main, 0.12),
  },
}));

const IconWrapper = styled(Avatar)(({ theme }) => ({
  width: 56,
  height: 56,
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const TabPanel = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index}>
    {value === index && (
      <Fade in timeout={500}>
        <Box>{children}</Box>
      </Fade>
    )}
  </Box>
);

// ==================== Main Component ====================

function ReportPage() {
  const { reportId } = useParams(); 
  const [reportData, setReportData] = useState(null);
  const [status, setStatus] = useState('processing_analysis'); 
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('AI가 리포트를 분석 중입니다... (1/2단계)');
  const [step2Complete, setStep2Complete] = useState(false);
  const [showAdvancement, setShowAdvancement] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    let timerId = null;

    const pollReport = async () => {
      if (status === 'completed' || status === 'error') { 
        return; 
      }

      try {
        const response = await getReportStatus(reportId);
        
        if (response.status === 'completed') {
          setReportData(response.data);
          setStatus('completed');
          setStep2Complete(true);
          
        } else if (response.status === 'processing_analysis') {
          setLoadingMessage('AI가 리포트를 분석 중입니다... (1/2단계)');
          setStatus('processing_analysis');
          timerId = setTimeout(pollReport, POLLING_INTERVAL); 
          
        } else if (response.status === 'processing_questions') {
          setReportData(response.data); 
          setLoadingMessage('분석 완료! AI가 질문을 생성 중입니다... (2/2단계)');
          setStatus('processing_questions');
          timerId = setTimeout(pollReport, POLLING_INTERVAL); 
          
        } else if (response.status === 'error') {
          setError(response.data.error || '분석 중 알 수 없는 오류가 발생했습니다.');
          setStatus('error');
        }
        
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    pollReport(); 

    return () => { 
      if (timerId) {
        clearTimeout(timerId);
      }
    };

  }, [reportId, status]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleShowAdvancement = () => {
    setShowAdvancement(true);
  };

  if (status === 'error') {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">분석 리포트를 불러오는 데 실패했습니다.</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Container>
    );
  }

  if (status === 'processing_analysis' || !reportData) {
    return (
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={true}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {loadingMessage}
          </Typography>
        </Stack>
      </Backdrop>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* 페이지 헤더 */}
      <PageHeader>
        <Stack direction="row" spacing={3} alignItems="center">
          <IconWrapper>
            <Assessment sx={{ fontSize: 32, color: 'white' }} />
          </IconWrapper>
          <Box sx={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 900, 
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                mb: 0.5
              }}
            >
              📊 리포트 분석
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: alpha('#fff', 0.9),
                fontWeight: 500
              }}
            >
              AI가 생성한 종합 분석 리포트를 확인하세요
            </Typography>
          </Box>
        </Stack>
      </PageHeader>

      {/* 🆕 탭 네비게이션 */}
      <StyledTabs 
        value={activeTab} 
        onChange={handleTabChange}
        variant="fullWidth"
        centered
      >
        <StyledTab 
          icon={<Summarize sx={{ fontSize: 28, mb: 1 }} />} 
          label="분석 요약" 
          iconPosition="top"
        />
        <StyledTab 
          icon={<ContentCopy sx={{ fontSize: 28, mb: 1 }} />} 
          label="표절 의심 문서" 
          iconPosition="top"
        />
        <StyledTab 
          icon={<ChatBubbleOutline sx={{ fontSize: 28, mb: 1 }} />} 
          label="AI 대화형 Q&A" 
          iconPosition="top"
        />
      </StyledTabs>

      {/* 탭 1: 분석 요약 */}
      <TabPanel value={activeTab} index={0}>
        <ReportDisplay data={reportData} />
      </TabPanel>

      {/* 탭 2: 표절 의심 문서 */}
      <TabPanel value={activeTab} index={1}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            borderRadius: 3,
            background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.05)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`,
            border: (theme) => `2px solid ${alpha(theme.palette.warning.main, 0.2)}`,
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Avatar
              sx={{
                width: 80,
                height: 80,
                background: (theme) => `linear-gradient(135deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.main} 100%)`,
              }}
            >
              <ContentCopy sx={{ fontSize: 48, color: 'white' }} />
            </Avatar>
            
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 800,
                background: (theme) => `linear-gradient(90deg, ${theme.palette.warning.main} 0%, ${theme.palette.error.main} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              표절 의심 문서 분석
            </Typography>
            
            <Typography 
              variant="h6" 
              color="text.secondary" 
              textAlign="center"
              sx={{ maxWidth: 600 }}
            >
              백엔드 API에서 표절 분석 데이터가 제공되면<br />
              여기에 표시됩니다.
            </Typography>

            {/* 예시 데이터 표시 */}
            {reportData.plagiarism_check && (
              <Box sx={{ width: '100%', mt: 3 }}>
                <Typography variant="body1">
                  표절 의심도: {reportData.plagiarism_check.score}%
                </Typography>
                {/* 추가 표절 분석 컴포넌트 */}
              </Box>
            )}
          </Stack>
        </Paper>
      </TabPanel>

      {/* 탭 3: AI 대화형 Q&A */}
      <TabPanel value={activeTab} index={2}>
        {status === 'processing_questions' && (
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              borderRadius: 3
            }}
          >
            <CircularProgress size={28} sx={{ mr: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
              {loadingMessage}
            </Typography>
          </Paper>
        )}
        
        {status === 'completed' && (
          <>
            <QAChat 
              reportId={reportId}
              initialQuestions={reportData.initialQuestions} 
              qaHistory={reportData.qa_history}
              questionsPoolCount={reportData.questions_pool_count}
              isRefilling={reportData.is_refilling}
            />

            {/* 발전 아이디어 생성 버튼 */}
            {step2Complete && !showAdvancement && (
              <Fade in timeout={800}>
                <Box sx={{ mt: 6 }}>
                  <Paper 
                    elevation={4} 
                    sx={{ 
                      p: 5, 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: 3,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Stack spacing={3} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                      <Avatar
                        sx={{
                          width: 80,
                          height: 80,
                          background: 'rgba(255,255,255,0.2)',
                          backdropFilter: 'blur(10px)',
                        }}
                      >
                        <TipsAndUpdates sx={{ fontSize: 48, color: 'white' }} />
                      </Avatar>
                      
                      <Box textAlign="center">
                        <Typography 
                          variant="h4" 
                          gutterBottom 
                          sx={{ 
                            fontWeight: 900, 
                            color: 'white',
                            textShadow: '0 2px 8px rgba(0,0,0,0.2)'
                          }}
                        >
                          💡 Q&A 준비가 완료되었습니다!
                        </Typography>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: 'rgba(255,255,255,0.95)',
                            fontWeight: 500,
                            maxWidth: 600,
                            mx: 'auto',
                            lineHeight: 1.6
                          }}
                        >
                          대화 내용과 리포트를 바탕으로 AI가 개선 아이디어를 생성할 수 있습니다.
                        </Typography>
                      </Box>

                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<AutoAwesome />}
                        onClick={handleShowAdvancement}
                        sx={{
                          py: 2,
                          px: 6,
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          background: 'white',
                          color: '#667eea',
                          borderRadius: 2,
                          textTransform: 'none',
                          '&:hover': {
                            background: 'rgba(255,255,255,0.95)',
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        발전 아이디어 생성하기
                      </Button>
                    </Stack>
                  </Paper>
                </Box>
              </Fade>
            )}

            {/* 발전 아이디어 섹션 */}
            {showAdvancement && (
              <Fade in timeout={1000}>
                <Box sx={{ mt: 6 }}>
                  <AdvancementIdeas reportId={reportId} />
                </Box>
              </Fade>
            )}
          </>
        )}
      </TabPanel>
    </Container>
  );
}

export default ReportPage;