import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getReportStatus } from '../services/api.js';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Alert, 
  Backdrop,
  Paper // [신규] 2단계 로딩을 위한 Paper
} from '@mui/material';
import ReportDisplay from '../components/ReportDisplay.jsx';
// 1. [신규] Q&A 컴포넌트 임포트 (곧 만듭니다)
import QAChat from '../components/QAChat.jsx';

const POLLING_INTERVAL = 3000; // 3초

function ReportPage() {
  const { reportId } = useParams(); 
  const [reportData, setReportData] = useState(null);
  // [수정] 초기 상태를 'processing_analysis'로 명확하게 변경
  const [status, setStatus] = useState('processing_analysis'); 
  const [error, setError] = useState('');
  
  // 2. [신규] 2단계 로딩 메시지
  const [loadingMessage, setLoadingMessage] = useState('AI가 리포트를 분석 중입니다... (1/2단계)');

  useEffect(() => {
    let timerId = null;

    const pollReport = async () => {
      // (status가 'completed'나 'error'가 되면 더 이상 폴링하지 않음)
      if (status === 'completed' || status === 'error') { 
        return; 
      }

      try {
        const response = await getReportStatus(reportId);
        
        if (response.status === 'completed') {
          // 3. [최종 완료]
          console.log("폴링 최종 완료:", response.data);
          setReportData(response.data);
          setStatus('completed');
          
        } else if (response.status === 'processing_analysis') {
          // 4. [1단계 진행 중] (데이터 없음)
          setLoadingMessage('AI가 리포트를 분석 중입니다... (1/2단계)');
          setStatus('processing_analysis');
          timerId = setTimeout(pollReport, POLLING_INTERVAL); 
          
        } else if (response.status === 'processing_questions') {
          // 5. [핵심 수정!] 1단계 완료, 2단계(QA) 진행 중
          console.log("1단계 완료, 2단계(QA) 시작:", response.data);
          // 1단계(분석) 데이터만 먼저 화면에 렌더링하기 위해 data 저장
          setReportData(response.data); 
          setLoadingMessage('분석 완료! AI가 질문을 생성 중입니다... (2/2단계)');
          setStatus('processing_questions');
          timerId = setTimeout(pollReport, POLLING_INTERVAL); 
          
        } else if (response.status === 'error') {
          // 6. [실패]
          setError(response.data.error || '분석 중 알 수 없는 오류가 발생했습니다.');
          setStatus('error');
        }
        
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    pollReport(); // 7. 최초 1회 폴링 시작

    return () => { // 8. (Cleanup)
      if (timerId) {
        clearTimeout(timerId);
      }
    };

  }, [reportId, status]); // 9. [수정] status가 바뀔 때마다 이 effect를 재검토합니다.

  // --- 렌더링 로직 ---

  // 10. [수정] 1단계 로딩과 에러 처리
  // (아직 1단계 데이터(reportData)가 도착하지 않았거나, 에러가 났을 때)
  if (status === 'error') {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        <Typography>분석 리포트를 불러오는 데 실패했습니다.</Typography>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  // 11. [수정] 1단계 로딩 중일 때 (데이터가 아예 없음)
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

  // 12. [핵심 수정!] 1단계 데이터가 도착했을 때 (2단계 진행 중 or 최종 완료)
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        리포트 분석
      </Typography>
      
      {/* 1단계 결과(summary, similarity)는 즉시 렌더링 */}
      <ReportDisplay data={reportData} />

      {/* 2단계(Q&A) 섹션 */}
      <Box mt={4}>
        <Typography variant="h5" component="h2" gutterBottom>
          AI 대화형 Q&A
        </Typography>
        
        {/* 2단계가 아직 진행 중이면 '부분 로딩'을 표시 */}
        {status === 'processing_questions' && (
          <Paper elevation={2} sx={{ p: 3, display: 'flex', alignItems: 'center', backgroundColor: '#f9f9f9' }}>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography variant="body1" color="text.secondary">
              {loadingMessage}
            </Typography>
          </Paper>
        )}
        
        {/* 2단계가 최종 완료되면 Q&A 컴포넌트를 렌더링 */}
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
    </Box>
  );
}

export default ReportPage;