import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button,
  Stack,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Avatar,
  IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import { submitAnswer, getNextQuestion, requestDeepDiveQuestion, getReportStatus } from '../services/api.js';

// ==================== Styled Components ====================

const ChatContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 960,
  margin: '0 auto',
  padding: theme.spacing(2),
}));

const ChatPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  background: `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
  boxShadow: '0 10px 30px rgba(2,6,23,0.08)',
}));

const QAItemPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.25),
  borderRadius: theme.spacing(2),
  background: theme.palette.mode === 'light' ? '#ffffff' : theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'transform 180ms ease, box-shadow 180ms ease',
  '&:hover': {
    transform: 'translateY(-6px)',
    boxShadow: '0 12px 40px rgba(2,6,23,0.06)',
  },
}));

const MetaRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const MessagesBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
  marginTop: theme.spacing(1.5),
  maxHeight: 420,
  overflow: 'auto',
  paddingRight: theme.spacing(1),
  scrollbarWidth: 'thin',
}));

const MessageBubble = styled(Box, { shouldForwardProp: (p) => p !== 'role' })(({ theme, role }) => ({
  alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
  background: role === 'user' 
    ? `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})` 
    : (theme.palette.mode === 'light' ? theme.palette.secondary.main + '20' : theme.palette.grey[500] + '10'),
  color: role === 'user' ? '#fff' : theme.palette.text.primary,
  padding: theme.spacing(1, 1.25),
  borderRadius: theme.spacing(1.5),
  maxWidth: '84%',
  boxShadow: role === 'user' ? `0 8px 30px ${theme.palette.primary.main}20` : 'none',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

const MessageMeta = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
  marginTop: theme.spacing(0.5),
}));

const InputRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
  alignItems: 'stretch',
}));

const formatTime = (ts) => {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// 🔥 데이터를 계층 구조로 변환하는 헬퍼 함수
const groupQuestions = (flatQuestions) => {
  if (!Array.isArray(flatQuestions)) return [];
  
  const questionMap = new Map();
  const rootQuestions = [];

  // 1. 모든 질문 등록
  flatQuestions.forEach(q => {
    questionMap.set(q.question_id, { ...q, children: [] });
  });

  // 2. 부모-자식 연결
  flatQuestions.forEach(q => {
    const current = questionMap.get(q.question_id);
    if (q.parent_question_id && questionMap.has(q.parent_question_id)) {
      const parent = questionMap.get(q.parent_question_id);
      parent.children.push(current);
    } else if (!q.parent_question_id) {
      rootQuestions.push(current);
    }
  });

  return rootQuestions;
};

// ==================== QAItem Component ====================

function QAItem({ reportId, qaItem, onAnswerSubmit, onRefreshQuestion, index }) {
  // 초기 메시지 구성
  const initialMessages = [];
  
  // 1. 부모 질문
  if (qaItem.question) {
    initialMessages.push({ 
      id: `${qaItem.question_id}-q`, 
      role: 'ai', 
      text: qaItem.question, 
      ts: Date.now() 
    });
  }
  // 2. 부모 답변
  if (qaItem.answer && qaItem.answer.trim()) {
    initialMessages.push({ 
      id: `${qaItem.question_id}-a`, 
      role: 'user', 
      text: qaItem.answer, 
      ts: Date.now() 
    });
  }

  // 3. 자식(심화) 질문들 처리
  if (qaItem.children && qaItem.children.length > 0) {
    qaItem.children.forEach(child => {
      initialMessages.push({
        id: `${child.question_id}-q`,
        role: 'ai',
        text: child.question,
        ts: Date.now() 
      });
      if (child.answer && child.answer.trim()) {
        initialMessages.push({
          id: `${child.question_id}-a`,
          role: 'user',
          text: child.answer,
          ts: Date.now()
        });
      }
    });
  }

  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 현재 대화가 끝난 시점의 질문 ID
  const currentQuestionId = (qaItem.children && qaItem.children.length > 0)
    ? qaItem.children[qaItem.children.length - 1].question_id
    : qaItem.question_id;

  // 답변 제출 여부 확인
  const hasSubmittedAnswer = messages.length > 0 && messages[messages.length - 1].role === 'user';
  
  const [error, setError] = useState('');
  const msgsRef = useRef(null);

  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, expanded]);

  const handleSubmitAnswer = async () => {
    const text = input.trim();
    if (!text) return;
    
    setError('');
    const targetId = currentQuestionId;
    
    const msgId = `${targetId}-u-${Date.now()}`;
    const userMsg = { id: msgId, role: 'user', text: text, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setIsSending(true);
    setInput('');

    try {
      const res = await submitAnswer(reportId, targetId, text);
      onAnswerSubmit(targetId, text); 

      if (res && res.assistant_reply) {
        const aiId = `${targetId}-ai-${Date.now()}`;
        setMessages((m) => [...m, { id: aiId, role: 'ai', text: res.assistant_reply, ts: Date.now() }]);
      }
      setExpanded(true);
    } catch (err) {
      setError(err?.message || '메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeepDive = async () => {
    if (!hasSubmittedAnswer) return;
    
    setError('');
    setIsDeepDiveLoading(true);

    const targetId = currentQuestionId;
    const tempId = `${targetId}-deep-temp-${Date.now()}`;
    const tempMsg = { id: tempId, role: 'ai', text: '심화 질문을 생성하고 있습니다...', ts: Date.now(), loading: true };
    setMessages((m) => [...m, tempMsg]);
    
    try {
      await requestDeepDiveQuestion(reportId, targetId);
      
      let foundQuestion = null;
      const maxAttempts = 15; 
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusRes = await getReportStatus(reportId);
        const history = statusRes.data?.qa_history || [];
        foundQuestion = history.find(q => q.parent_question_id === targetId);
        if (foundQuestion) break;
      }

      if (foundQuestion) {
        setMessages((m) => m.map(msg => 
          msg.id === tempId 
            ? { ...msg, text: foundQuestion.question, loading: false, ts: Date.now() } 
            : msg
        ));
      } else {
        throw new Error("시간 내에 심화 질문을 가져오지 못했습니다.");
      }
      setExpanded(true);
    } catch (err) {
      console.error("Deep dive error:", err);
      const errText = err?.message || '심화 질문 요청 중 오류가 발생했습니다.';
      setMessages((m) => m.map(msg => msg.id === tempId ? { ...msg, text: `[오류] ${errText}`, loading: false, ts: Date.now() } : msg));
      setError(errText);
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (hasSubmittedAnswer || (qaItem.children && qaItem.children.length > 0)) {
      setError('이미 답변을 제출했거나 심화 질문이 있는 경우 새로고침할 수 없습니다.');
      return;
    }
    setIsRefreshing(true);
    setError('');
    try {
      await onRefreshQuestion(qaItem.question_id);
    } catch (err) {
      setError(err?.message || '질문 새로고침 중 오류가 발생했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  return (
    <QAItemPaper variant="outlined" elevation={0}>
      <MetaRow>
        <Avatar sx={{ bgcolor: (t) => t.palette.primary.main, width: 40, height: 40 }}>
          <AutoAwesomeIcon />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
            {`사고 자극 질문 ${typeof index === 'number' ? index + 1 : ''}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {qaItem.topic || qaItem.category || ''}
          </Typography>
        </Box>

        {messages.length === 1 && (
          <IconButton 
            size="small" 
            onClick={handleRefresh}
            disabled={isRefreshing || isSending}
          >
            {isRefreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        )}

        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </MetaRow>

      {expanded && (
        <>
          <MessagesBox id={`msgs-${qaItem.question_id}`} ref={msgsRef}>
            {messages.map((m) => (
              <Box key={m.id || m.ts} sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'ai' && <Avatar sx={{ bgcolor: (t) => t.palette.secondary.main, width: 28, height: 28, mr: 1 }}><AutoAwesomeIcon fontSize="small" /></Avatar>}
                <Box>
                  <MessageBubble role={m.role}>
                    {m.loading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={14} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {m.text}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: m.role === 'user' ? 700 : 600 }}>
                        {m.text}
                      </Typography>
                    )}
                  </MessageBubble>
                  <MessageMeta>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(m.ts)}
                    </Typography>
                  </MessageMeta>
                </Box>
                {m.role === 'user' && <Avatar sx={{ bgcolor: (t) => t.palette.primary.main, width: 28, height: 28 }}><ChatBubbleOutlineIcon fontSize="small" /></Avatar>}
              </Box>
            ))}
          </MessagesBox>

          <Box sx={{ mt: 2 }}>
            <InputRow>
              <TextField
                fullWidth
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="답변을 입력하세요"
                multiline
                minRows={2}
                disabled={isSending || isDeepDiveLoading || isRefreshing}
              />

              <Button 
                variant="contained" 
                color="primary"
                onClick={handleSubmitAnswer} 
                disabled={isSending || isDeepDiveLoading || !input.trim() || isRefreshing}
                startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                sx={{ minWidth: 120, alignSelf: 'stretch' }}
              >
                {isSending ? '전송 중...' : '답변 제출'}
              </Button>
            </InputRow>
            
            {/* 🔥 [수정됨] 심화 질문 버튼 - Solid(채움) 스타일 적용 */}
            <Button 
              fullWidth
              variant="contained" 
              color="secondary" 
              onClick={handleDeepDive} 
              disabled={!hasSubmittedAnswer || isDeepDiveLoading || isSending || isRefreshing}
              startIcon={isDeepDiveLoading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              sx={{ 
                mt: 1, 
                height: 44,
                fontWeight: 700, // 굵은 글씨
                boxShadow: 2, // 약간의 그림자
                color: 'white', // 흰색 글씨 (배경이 노란색/주황색일 때 잘 보이도록)
                
                // 활성화 상태 스타일
                backgroundColor: 'secondary.main',
                '&:hover': {
                    backgroundColor: 'secondary.dark',
                    transform: 'translateY(-1px)',
                    boxShadow: 3,
                },
                
                // 비활성화 상태 스타일
                '&.Mui-disabled': {
                    backgroundColor: 'action.disabledBackground',
                    color: 'text.disabled'
                }
              }}
            >
              {isDeepDiveLoading ? '생성 중...' : '심화 질문 생성'}
            </Button>
          </Box>

          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </>
      )}
    </QAItemPaper>
  );
}

// ==================== QAChat Component ====================

function QAChat({ 
  reportId, 
  initialQuestions, 
  qaHistory, 
  questionsPoolCount, 
  isRefilling 
}) {
  const rawHistory = qaHistory || initialQuestions || [];
  const groupedHistory = groupQuestions(rawHistory);

  const [history, setHistory] = useState(groupedHistory);
  const [poolCount, setPoolCount] = useState(questionsPoolCount || 0);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingRefill, setIsLoadingRefill] = useState(isRefilling || false);
  const [error, setError] = useState('');

  useEffect(() => {
    const newGrouped = groupQuestions(qaHistory || initialQuestions || []);
    setHistory(newGrouped);
  }, [qaHistory, initialQuestions]);

  const handleAddQuestion = async () => {
    setIsLoadingNext(true);
    setError('');
    try {
      const newQuestion = await getNextQuestion(reportId);
      if (!newQuestion) return;
      setHistory((h) => [...h, { ...newQuestion, children: [] }]);
      setPoolCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err?.message || '추가 질문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingNext(false);
    }
  };

  const handleAnswerSubmit = (questionId, userAnswer) => {
    // 로컬 상태 처리는 QAItem에서 담당
  };

  const handleRefreshQuestion = useCallback(async (questionId) => {
    setError('');
    try {
      const newQuestion = await getNextQuestion(reportId);
      if (!newQuestion) throw new Error('새 질문을 가져올 수 없습니다.');
      
      setHistory((currentHistory) => 
        currentHistory.map(item => 
          item.question_id === questionId ? { ...newQuestion, children: [] } : item
        )
      );
      setPoolCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err?.message || '질문 새로고침 중 오류가 발생했습니다.');
      throw err;
    }
  }, [reportId]);

  return (
    <ChatContainer>
      <ChatPaper>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: (t) => t.palette.primary.main }}>
            <ChatBubbleOutlineIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              AITA와의 대화
            </Typography>
            <Typography variant="body2" color="text.secondary">
              질문 답변 후 심화 질문을 생성해 더욱 창의적인 아이디어를 얻으세요!
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        <Stack spacing={2}>
          {history.length > 0 ? history.map((item, idx) => (
            <QAItem 
              key={item.question_id} 
              reportId={reportId}
              qaItem={item}
              index={idx}
              onAnswerSubmit={handleAnswerSubmit}
              onRefreshQuestion={handleRefreshQuestion}
            />
          )) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                아직 질문이 없습니다.
              </Typography>
              <Button variant="outlined" onClick={handleAddQuestion}>질문 생성</Button>
            </Box>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button 
            variant="contained" 
            onClick={handleAddQuestion}
            disabled={isLoadingNext || isLoadingRefill || poolCount === 0}
            sx={{ mr: 0, px: 3 }}
          >
            {isLoadingNext ? <CircularProgress size={20} color="inherit" /> :
             isLoadingRefill ? 'AI가 질문 리필 중...' : 
             poolCount === 0 ? '남은 질문 없음' : `추가 질문 (${poolCount})`}
          </Button>

          <Button 
            variant="outlined" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            맨 위로
          </Button>
        </Box>
      </ChatPaper>
    </ChatContainer>
  );
}

export default QAChat;