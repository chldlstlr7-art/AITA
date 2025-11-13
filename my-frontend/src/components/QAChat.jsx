import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Stack,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Divider // [신규]
} from '@mui/material';
// 1. [신규] 방금 추가한 3개의 API 함수 임포트
import { submitAnswer, getNextQuestion, getDeepDiveQuestion } from '../services/api.js';

// -----------------------------------------------------------------
// [신규] 2. Q&A "한 항목"을 관리하는 별도 컴포넌트
// -----------------------------------------------------------------
function QAItem({ reportId, qaItem, onAnswerSubmit, onDeepDive }) {
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 3. 답변 제출 핸들러
  const handleAnswerSubmit = async () => {
    if (answer.trim() === '') {
      setError('답변을 입력해 주세요.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // 4. API 호출
      await submitAnswer(reportId, qaItem.question_id, answer);
      // 5. [핵심] 성공 시, 부모(QAChat)에게 "데이터 갱신"을 알림
      onAnswerSubmit(qaItem.question_id, answer); 
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 6. 심화 질문 핸들러
  const handleDeepDive = async () => {
    setIsLoading(true);
    setError('');
    try {
      // 7. API 호출
      await onDeepDive(qaItem.question_id); // 부모(QAChat)의 함수를 호출
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, overflow: 'hidden' }}>
      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
        [AI 질문] {qaItem.question}
      </Typography>
      
      {/* 8. [핵심] 백엔드 명세서에 따라 UI를 조건부 렌더링 */}
      
      {/* 8A: 이미 답변한 경우 (답변 표시 + 심화 질문 버튼) */}
      {qaItem.answer !== null && (
        <Box sx={{ mt: 2, pl: 2, borderLeft: '3px solid #1976d2' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            [나의 답변]
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
            {qaItem.answer}
          </Typography>
          <Button 
            onClick={handleDeepDive} 
            disabled={isLoading} 
            variant="text" 
            size="small"
          >
            {isLoading ? <CircularProgress size={20} /> : '심화 질문하기'}
          </Button>
        </Box>
      )}

      {/* 8B: 아직 답변 안 한 경우 (답변 폼 + 제출 버튼) */}
      {qaItem.answer === null && (
        <Box mt={2}>
          <TextField
            fullWidth
            label="답변 입력..."
            multiline
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            variant="outlined"
            disabled={isLoading}
          />
          <Button 
            onClick={handleAnswerSubmit} 
            disabled={isLoading} 
            variant="contained" 
            size="small"
            sx={{ mt: 1 }}
          >
            {isLoading ? <CircularProgress size={20} /> : '답변 제출'}
          </Button>
        </Box>
      )}
      
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Paper>
  );
}

// -----------------------------------------------------------------
// [신규] 9. 메인 Q&A 컨테이너 (상태 관리자)
// -----------------------------------------------------------------
function QAChat({ 
  reportId, 
  initialQuestions, 
  qaHistory, 
  questionsPoolCount, 
  isRefilling 
}) {
  
  // 10. [핵심] 
  // qaHistory가 "전체 대화"이므로, initialQuestions 대신 qaHistory를 기본값으로 사용
  const [history, setHistory] = useState(qaHistory || initialQuestions || []);
  const [poolCount, setPoolCount] = useState(questionsPoolCount || 0);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingRefill, setIsLoadingRefill] = useState(isRefilling || false);
  const [error, setError] = useState('');

  // 11. "다음 질문" 버튼 핸들러
  const handleNextQuestion = async () => {
    setIsLoadingNext(true);
    setError('');
    try {
      const newQuestion = await getNextQuestion(reportId);
      // 백엔드 명세서에 따라, newQuestion은 answer: null, parent_question_id: null
      setHistory([...history, newQuestion]); // 대화 목록에 새 질문 추가
      setPoolCount(poolCount - 1); // 남은 풀 카운트 1 감소
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingNext(false);
    }
  };

  // 12. "답변 제출" 시 호출될 콜백 함수
  const handleAnswerSubmit = (questionId, userAnswer) => {
    // UI를 즉시 업데이트 (Optimistic Update)
    setHistory(currentHistory => 
      currentHistory.map(item => 
        item.question_id === questionId 
          ? { ...item, answer: userAnswer } // 얕은 복사로 answer만 갱신
          : item
      )
    );
  };

  // 13. "심화 질문" 시 호출될 콜백 함수
  const handleDeepDive = async (parentQuestionId) => {
    setError('');
    try {
      // 심화 질문 API 호출
      const newDeepDiveQuestion = await getDeepDiveQuestion(reportId, parentQuestionId);
      
      // 백엔드 명세서: 새 질문은 parent_question_id를 가짐
      const newQuestionItem = {
        ...newDeepDiveQuestion,
        answer: null, // (새 질문이므로 답변은 null)
        type: 'deep_dive',
        parent_question_id: parentQuestionId
      };
      
      // 대화 목록에 새 심화 질문 추가
      setHistory([...history, newQuestionItem]);

    } catch (err) {
      setError(err.message);
      // (실패 시 UI 롤백은 생략 - 단순화를 위해)
    }
  };

  return (
    <Box>
      <Paper elevation={2} sx={{ p: 3, backgroundColor: '#fafafa' }}>
        <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
          AI가 생성한 초기 질문 3개입니다. 답변을 입력하거나 '다음 질문'을 요청해 보세요.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {/* 14. [핵심] 'history' 상태를 순회하며 QAItem 렌더링 */}
        <Stack spacing={2}>
          {history.length > 0 ? (
            history.map((item) => (
              <QAItem 
                key={item.question_id} 
                reportId={reportId}
                qaItem={item} 
                onAnswerSubmit={handleAnswerSubmit}
                onDeepDive={handleDeepDive}
              />
            ))
          ) : (
            <Typography>Q&A 내역이 없습니다.</Typography>
          )}
        </Stack>
        
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        
        <Box mt={3} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button 
            variant="outlined" 
            onClick={handleNextQuestion}
            // 15. [핵심] 백엔드 명세서에 따른 버튼 상태 제어
            disabled={isLoadingNext || isLoadingRefill || poolCount === 0}
          >
            {isLoadingNext ? <CircularProgress size={24} /> : 
             isLoadingRefill ? 'AI가 질문 리필 중...' : 
             poolCount === 0 ? '남은 질문 없음' : `다음 질문 받기 (${poolCount}개 남음)`}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default QAChat;