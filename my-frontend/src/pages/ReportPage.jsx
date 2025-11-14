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
  Divider
} from '@mui/material';
import { 
  AutoAwesome, 
  Assessment, 
  ChatBubbleOutline,
  TipsAndUpdates 
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import ReportDisplay from '../components/ReportDisplay.jsx';
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

const SectionHeader = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  border: `2px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`,
  position: 'relative',
  overflow: 'hidden',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
}));

const IconWrapper = styled(Avatar)(({ theme }) => ({
  width: 56,
  height: 56,
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

// ==================== Main Component ====================

function ReportPage() {
  const { reportId } = useParams(); 
  const [reportData, setReportData] = useState(null);
  const [status, setStatus] = useState('processing_analysis'); 
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('AI가 리포트를 분석 중입니다... (1/2단계)');
  const [step2Complete, setStep2Complete] = useState(false);
  const [showAdvancement, setShowAdvancement] = useState(false);

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
      {/* 🆕 개선된 페이지 헤더 */}
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
      
      {/* 1단계 결과 */}
      <ReportDisplay data={reportData} />

      {/* 🆕 개선된 Q&A 섹션 헤더 */}
      <Box mt={6}>
        <SectionHeader>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconWrapper sx={{ width: 48, height: 48 }}>
              <ChatBubbleOutline sx={{ fontSize: 28, color: 'white' }} />
            </IconWrapper>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 800,
                  background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5
                }}
              >
                💬 AI 대화형 Q&A
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ fontWeight: 500 }}
              >
                AI와 대화하며 리포트를 심화 분석하세요 • 최대 9개 대화창 지원
              </Typography>
            </Box>
          </Stack>
        </SectionHeader>
        
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
          <QAChat 
            reportId={reportId}
            initialQuestions={reportData.initialQuestions} 
            qaHistory={reportData.qa_history}
            questionsPoolCount={reportData.questions_pool_count}
            isRefilling={reportData.is_refilling}
          />
        )}
      </Box>

      {/* 발전 아이디어 생성 버튼 */}
      {step2Complete && !showAdvancement && (
        <Fade in timeout={800}>
          <Box sx={{ mt: 6, mb: 4 }}>
            <Paper 
              elevation={4} 
              sx={{ 
                p: 5, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -100,
                  right: -100,
                  width: 300,
                  height: 300,
                  background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                  borderRadius: '50%',
                }
              }}
            >
              <Stack spacing={3} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
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
                    <br />
                    질문에 답변하지 않아도 기본 분석으로 아이디어를 제공합니다.
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
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    textTransform: 'none',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.95)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                    },
                    transition: 'all 0.3s ease',
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
          <Box sx={{ mt: 6, mb: 6 }}>
            <AdvancementIdeas reportId={reportId} />
          </Box>
        </Fade>
      )}
    </Container>
  );
}

export default ReportPage;