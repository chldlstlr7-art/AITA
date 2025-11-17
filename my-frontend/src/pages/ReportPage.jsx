// [파일 경로] src/pages/ReportPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
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
import QAChat from '../components/QAChat.jsx';
import FloatingAdvancementButton from '../components/FloatingAdvancementButton';

const POLLING_INTERVAL = 3000;

// ==================== Styled Components ====================
// ... (스타일 컴포넌트는 이전과 동일) ...
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
  const location = useLocation();
  
  const [reportData, setReportData] = useState(null);
  const [status, setStatus] = useState('processing_analysis'); 
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('AI가 리포트를 분석 중입니다...');
  const [showAdvancement, setShowAdvancement] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // 각 단계별 완료 상태 (3단계 구조에 맞게 수정)
  const [step1Complete, setStep1Complete] = useState(false); // 분석 완료 (summary)
  const [step2Complete, setStep2Complete] = useState(false); // 유사도 비교 완료 (similarity_details)
  const [step3Complete, setStep3Complete] = useState(false); // QA 생성 완료 (initialQuestions)

  // AnalysisForm에서 전달받은 제목과 제출물 형식
  const submissionTitle = location.state?.submissionTitle || '제목 없음';
  const userAssignmentType = location.state?.userAssignmentType;

  useEffect(() => {
    let timerId = null;

    const pollReport = async () => {
      // 🔒 완료 또는 에러 상태면 폴링 중지
      if (status === 'completed' || status === 'error') { 
        return; 
      }

      try {
        console.log(`[Polling] 현재 상태: ${status}`);
        const response = await getReportStatus(reportId);
        console.log('[Polling] 서버 응답:', response);
        
        // 🎯 상태 1: processing_analysis (분석 중)
        if (response.status === 'processing_analysis') {
          setLoadingMessage('AI가 리포트를 분석하고 있습니다... (1/3단계)');
          setStatus('processing_analysis');
          timerId = setTimeout(pollReport, POLLING_INTERVAL); 
        }
        
        // 🎯 상태 2: processing_comparison (유사도 비교 중)
        else if (response.status === 'processing_comparison') {
          console.log('[Polling] ✅ 1단계 완료! summary 데이터 수신');
          setReportData(response.data); 
          setStep1Complete(true); // 🟢 분석 탭 활성화
          setLoadingMessage('유사 문서를 비교하고 있습니다... (2/3단계)');
          setStatus('processing_comparison');
          
          if (activeTab === 0 && !step1Complete) {
            setActiveTab(0);
          }
          
          timerId = setTimeout(pollReport, POLLING_INTERVAL);
        }
        
        // 🎯 상태 3: processing_questions (QA 생성 중)
        else if (response.status === 'processing_questions') {
          console.log('[Polling] ✅ 2단계 완료! similarity_details 데이터 수신');
          setReportData(response.data); // summary + similarity_details
          setStep1Complete(true);
          setStep2Complete(true); // 🟢 유사도 탭 활성화
          setLoadingMessage('AITA가 질문을 생성하고 있습니다... (3/3단계)');
          setStatus('processing_questions');
          timerId = setTimeout(pollReport, POLLING_INTERVAL); 
        }
        
        // 🎯 상태 4: completed (모든 작업 완료)
        else if (response.status === 'completed') {
          console.log('[Polling] ✅ 3단계 완료! 모든 데이터 수신');
          setReportData(response.data); // 모든 데이터 포함
          setStep1Complete(true);
          setStep2Complete(true);
          setStep3Complete(true); // 🟢 QA 탭 활성화
          setStatus('completed');
          setLoadingMessage('분석이 완료되었습니다!');
        }
        
        // 🎯 상태 5: error
        else if (response.status === 'error') {
          console.error('[Polling] ❌ 에러 발생:', response.data?.error);
          setError(response.data?.error || '분석 중 알 수 없는 오류가 발생했습니다.');
          setStatus('error');
        }
        
      } catch (err) {
        console.error('[Polling] 네트워크 에러:', err);
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

  }, [reportId, status, activeTab, step1Complete]);

  const handleTabChange = (event, newValue) => {
    if (newValue === 0 && step1Complete) setActiveTab(newValue);
    if (newValue === 1 && step2Complete) setActiveTab(newValue);
    if (newValue === 2 && step3Complete) setActiveTab(newValue);
  };

  // ... (handleShowAdvancement, 에러 상태 UI는 동일) ...
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
        {/* ... (헤더 내용 동일) ... */}
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
              
              {userAssignmentType && (
                <Chip
                  label={userAssignmentType}
                  size="small"
                  sx={{
                    background: alpha('#fff', 0.25),
                    color: 'white',
                    fontWeight: 700,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha('#fff', 0.4)}`
                  }}
                />
              )}
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
        {/* ... (탭 1, 2, 3 스타일 동일) ... */}
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
                  처리 중... (1/3)
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
              <Typography variant="body1" fontWeight={700}>유사 문서 비교</Typography>
              {!step2Complete && step1Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중... (2/3)
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
              <Typography variant="body1" fontWeight={700}>AITA와의 대화</Typography>
              {!step3Complete && step2Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중... (3/3)
                </Typography>
              )}
            </Box>
          }
          iconPosition="top"
          disabled={!step3Complete}
        />
      </StyledTabs>

      {/* 🎯 탭 1: 분석 요약 */}
      <TabPanel value={activeTab} index={0}>
        {step1Complete && reportData?.summary ? (
          <ReportDisplay 
            data={reportData} 
            userAssignmentType={userAssignmentType}
            reportId={reportId} // <--- [수정] reportId를 여기에서 전달
          />
        ) : (
          <LoadingTabContent elevation={3}>
            {/* ... (로딩 UI 동일) ... */}
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 🎯 탭 2: 유사 문서 비교 */}
      <TabPanel value={activeTab} index={1}>
        {/* ... (유사도 탭 내용 동일) ... */}
        {step2Complete && reportData?.similarity_details ? (
          <SimilarityAnalysis data={reportData} />
        ) : (
          <LoadingTabContent elevation={3}>
            {/* ... (로딩 UI 동일) ... */}
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 🎯 탭 3: AITA와의 대화 */}
      <TabPanel value={activeTab} index={2}>
        {/* ... (QA 탭 내용 동일) ... */}
        {step3Complete && reportData?.initialQuestions ? (
          <>
            <QAChat 
              reportId={reportId}
              initialQuestions={reportData.initialQuestions} 
              qaHistory={reportData.qa_history}
              questionsPoolCount={reportData.questions_pool_count}
              isRefilling={reportData.is_refilling}
            />
          </>
        ) : (
          <LoadingTabContent elevation={3}>
            {/* ... (로딩 UI 동일) ... */}
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 🆕 우측 하단 고정 버튼 추가 */}
      {reportId && status === 'completed' && (
        <FloatingAdvancementButton reportId={reportId} />
      )}
    </Container>
  );
}

export default ReportPage;