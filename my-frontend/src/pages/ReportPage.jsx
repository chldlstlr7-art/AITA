import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getReportStatus } from '../services/api.js';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Alert, 
  Backdrop,
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
import AdvancementIdeas from '../components/AdvancementIdeas.jsx';
import QAChat from '../components/QAChat.jsx';

const POLLING_INTERVAL = 3000;

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
  '&:hover:not(.Mui-disabled)': {
    background: alpha(theme.palette.primary.main, 0.08),
  },
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    background: alpha(theme.palette.primary.main, 0.12),
  },
  '&.Mui-disabled': {
    opacity: 0.5,
  },
}));

const IconWrapper = styled(Avatar)(({ theme }) => ({
  width: 56,
  height: 56,
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const LoadingTabContent = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(6),
  textAlign: 'center',
  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  borderRadius: theme.spacing(3),
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
  const [loadingMessage, setLoadingMessage] = useState('AI가 리포트를 분석 중입니다...');
  const [showAdvancement, setShowAdvancement] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // 각 단계별 완료 상태
  const [step1Complete, setStep1Complete] = useState(false); // 분석 요약
  const [step2Complete, setStep2Complete] = useState(false); // 표절 의심 문서
  const [step3Complete, setStep3Complete] = useState(false); // Q&A

  // 로컬 스토리지에서 파일명 가져오기
  const [submissionTitle, setSubmissionTitle] = useState('');

  useEffect(() => {
    const storedFilename = localStorage.getItem(`report_${reportId}_filename`);
    if (storedFilename) {
      setSubmissionTitle(storedFilename);
    } else {
      setSubmissionTitle('제목 없음');
    }
  }, [reportId]);

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
          setStep1Complete(true);
          setStep2Complete(true);
          setStep3Complete(true);
          
        } else if (response.status === 'processing_analysis') {
          setLoadingMessage('AI가 리포트를 분석 중입니다... (1/3단계)');
          setStatus('processing_analysis');
          timerId = setTimeout(pollReport, POLLING_INTERVAL); 
          
        } else if (response.status === 'processing_similarity') {
          // 1단계(분석 요약) 완료
          setReportData(response.data);
          setStep1Complete(true);
          setLoadingMessage('표절 의심 문서를 분석 중입니다... (2/3단계)');
          setStatus('processing_similarity');
          timerId = setTimeout(pollReport, POLLING_INTERVAL);
          
        } else if (response.status === 'processing_questions') {
          // 2단계(표절 의심 문서) 완료
          setReportData(response.data); 
          setStep1Complete(true);
          setStep2Complete(true);
          setLoadingMessage('AI가 질문을 생성 중입니다... (3/3단계)');
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
    // 완료된 탭만 클릭 가능
    if (newValue === 0 && step1Complete) setActiveTab(newValue);
    if (newValue === 1 && step2Complete) setActiveTab(newValue);
    if (newValue === 2 && step3Complete) setActiveTab(newValue);
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

  return (
    <Container maxWidth="lg">
      {/* 페이지 헤더 */}
      <PageHeader>
        <Stack direction="row" spacing={3} alignItems="center">
          <IconWrapper>
            <Assessment sx={{ fontSize: 32, color: 'white' }} />
          </IconWrapper>
          <Box sx={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
              <Typography 
                variant="h3" 
                sx={{ 
                  fontWeight: 900, 
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                 리포트 분석
              </Typography>
              <Chip
                icon={<Description sx={{ color: 'white !important' }} />}
                label="제출물"
                size="small"
                sx={{
                  background: alpha('#fff', 0.2),
                  color: 'white',
                  fontWeight: 700,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${alpha('#fff', 0.3)}`
                }}
              />
            </Stack>
            
            <Typography 
              variant="h5" 
              sx={{ 
                color: 'white',
                fontWeight: 700,
                mb: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
               {submissionTitle}
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

        {/* 진행 상황 표시 */}
        {status !== 'completed' && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress 
              variant="determinate" 
              value={
                step3Complete ? 100 : 
                step2Complete ? 66 : 
                step1Complete ? 33 : 0
              }
              sx={{ 
                height: 8, 
                borderRadius: 4,
                background: alpha('#fff', 0.2),
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)',
                  borderRadius: 4,
                }
              }}
            />
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'white', 
                mt: 1, 
                fontWeight: 600,
                opacity: 0.9
              }}
            >
              {loadingMessage}
            </Typography>
          </Box>
        )}
      </PageHeader>

      {/* 탭 네비게이션 */}
      <StyledTabs 
        value={activeTab} 
        onChange={handleTabChange}
        variant="fullWidth"
        centered
      >
        <StyledTab 
          icon={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Summarize sx={{ fontSize: 28 }} />
              {step1Complete && <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />}
              {!step1Complete && <Lock sx={{ fontSize: 20, opacity: 0.5 }} />}
            </Stack>
          }
          label={
            <Box>
              <Typography variant="body1" fontWeight={700}>분석 요약</Typography>
              {!step1Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중...
                </Typography>
              )}
            </Box>
          }
          iconPosition="top"
          disabled={!step1Complete}
        />
        <StyledTab 
          icon={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ContentCopy sx={{ fontSize: 28 }} />
              {step2Complete && <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />}
              {!step2Complete && <Lock sx={{ fontSize: 20, opacity: 0.5 }} />}
            </Stack>
          }
          label={
            <Box>
              <Typography variant="body1" fontWeight={700}>표절 의심 문서</Typography>
              {!step2Complete && step1Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중...
                </Typography>
              )}
            </Box>
          }
          iconPosition="top"
          disabled={!step2Complete}
        />
        <StyledTab 
          icon={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ChatBubbleOutline sx={{ fontSize: 28 }} />
              {step3Complete && <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />}
              {!step3Complete && <Lock sx={{ fontSize: 20, opacity: 0.5 }} />}
            </Stack>
          }
          label={
            <Box>
              <Typography variant="body1" fontWeight={700}>AI 대화형 Q&A</Typography>
              {!step3Complete && step2Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중...
                </Typography>
              )}
            </Box>
          }
          iconPosition="top"
          disabled={!step3Complete}
        />
      </StyledTabs>

      {/* 탭 1: 분석 요약 */}
      <TabPanel value={activeTab} index={0}>
        {step1Complete && reportData ? (
          <ReportDisplay data={reportData} />
        ) : (
          <LoadingTabContent elevation={3}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              분석 요약을 생성 중입니다
            </Typography>
            <Typography variant="body1" color="text.secondary">
              AI가 리포트를 분석하고 있습니다. 잠시만 기다려주세요...
            </Typography>
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 탭 2: 표절 의심 문서 - 🆕 SimilarityAnalysis 컴포넌트 연결 */}
      <TabPanel value={activeTab} index={1}>
        {step2Complete && reportData ? (
          <SimilarityAnalysis data={reportData} />
        ) : (
          <LoadingTabContent elevation={3}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              표절 의심 문서를 분석 중입니다
            </Typography>
            <Typography variant="body1" color="text.secondary">
              유사 문서를 검색하고 분석하고 있습니다. 잠시만 기다려주세요...
            </Typography>
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 탭 3: AI 대화형 Q&A */}
      <TabPanel value={activeTab} index={2}>
        {step3Complete && reportData ? (
          <>
            <QAChat 
              reportId={reportId}
              initialQuestions={reportData.initialQuestions} 
              qaHistory={reportData.qa_history}
              questionsPoolCount={reportData.questions_pool_count}
              isRefilling={reportData.is_refilling}
            />

            {/* 발전 아이디어 생성 버튼 */}
            {!showAdvancement && (
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
        ) : (
          <LoadingTabContent elevation={3}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              AI 질문을 생성 중입니다
            </Typography>
            <Typography variant="body1" color="text.secondary">
              사고 자극 질문을 생성하고 있습니다. 잠시만 기다려주세요...
            </Typography>
          </LoadingTabContent>
        )}
      </TabPanel>
    </Container>
  );
}

export default ReportPage;