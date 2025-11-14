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
  Button
} from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';
import ReportDisplay from '../components/ReportDisplay.jsx';
import AdvancementIdeas from '../components/AdvancementIdeas.jsx';
import QAChat from '../components/QAChat.jsx';

const POLLING_INTERVAL = 3000;

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

  // 🆕 수정: 하나의 질문이라도 답변이 있으면 true 반환
  const hasAnyAnswer = () => {
    if (!reportData || !reportData.qa_history) return false;
    
    // 답변이 있는 질문이 하나라도 있으면 true
    return reportData.qa_history.some(qa => 
      qa.answer !== null && 
      qa.answer.trim() !== ''
    );
  };

  const handleShowAdvancement = () => {
    setShowAdvancement(true);
  };

  if (status === 'error') {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        <Typography>분석 리포트를 불러오는 데 실패했습니다.</Typography>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  if (status === 'processing_analysis' || !reportData) {
    return (
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={true}
      >
        <CircularProgress color="inherit" />
        <Typography sx={{ ml: 2 }}>{loadingMessage}</Typography>
      </Backdrop>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        리포트 분석
      </Typography>
      
      {/* 1단계 결과 */}
      <ReportDisplay data={reportData} />

      {/* 2단계(Q&A) 섹션 */}
      <Box mt={4}>
        <Typography variant="h5" component="h2" gutterBottom>
          AI 대화형 Q&A
        </Typography>
        
        {status === 'processing_questions' && (
          <Paper elevation={2} sx={{ p: 3, display: 'flex', alignItems: 'center', backgroundColor: '#f9f9f9' }}>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography variant="body1" color="text.secondary">
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

      {/* 🆕 수정: 하나의 질문이라도 답변하면 버튼 표시 */}
      {step2Complete && hasAnyAnswer() && !showAdvancement && (
        <Fade in timeout={800}>
          <Box sx={{ mt: 5, textAlign: 'center' }}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 4, 
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                borderRadius: 2
              }}
            >
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                💡 대화가 진행되었습니다!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                AI가 대화 내용을 바탕으로 리포트 개선 아이디어를 생성할 수 있습니다.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<AutoAwesome />}
                onClick={handleShowAdvancement}
                sx={{
                  py: 1.5,
                  px: 4,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #0f0f70 30%, #2e2eb8 90%)',
                  boxShadow: '0 3px 5px 2px rgba(15, 15, 112, .3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #0a0a50 30%, #1e1e88 90%)',
                  }
                }}
              >
                발전 아이디어 생성하기
              </Button>
            </Paper>
          </Box>
        </Fade>
      )}

      {/* 발전 아이디어 섹션 */}
      {showAdvancement && (
        <Fade in timeout={1000}>
          <Box sx={{ mt: 5 }}>
            <AdvancementIdeas reportId={reportId} />
          </Box>
        </Fade>
      )}
    </Box>
  );
}

export default ReportPage;