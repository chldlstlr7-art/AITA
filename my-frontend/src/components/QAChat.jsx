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
import { submitAnswer, getNextQuestion, getDeepDiveQuestion } from '../services/api.js';

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
  alignItems: 'flex-end',
}));

// 중복 제거 헬퍼 (question_id 기준)
const dedupeById = (arr = []) => {
  const map = new Map();
  for (const item of arr) {
    if (!item) continue;
    if (!map.has(item.question_id)) map.set(item.question_id, item);
  }
  return Array.from(map.values());
};

const formatTime = (ts) => {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// QAItem: 각 질문별 "채팅" 형태 UI
function QAItem({ reportId, qaItem, onAnswerSubmit, onDeepDive, index }) {
  // messages: [{ id, role: 'ai'|'user', text, ts, loading? }]
  const initialMessages = [];
  if (qaItem.question) initialMessages.push({ id: `${qaItem.question_id}-q`, role: 'ai', text: qaItem.question, ts: Date.now() });
  if (qaItem.answer && qaItem.answer.trim()) {
    initialMessages.push({ id: `${qaItem.question_id}-a`, role: 'user', text: qaItem.answer, ts: Date.now() - 1000 });
  }

  // 기본적으로 펼쳐진 상태로 표시
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);
  const [error, setError] = useState('');

  const msgsRef = useRef(null);

  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, expanded]);

  const handleSend = async (text) => {
    // 전송 요청은 서버에 저장만 하고, 대체 AI 안내 메시지는 더 이상 추가하지 않습니다.
    if (!text || !text.trim()) return;
    setError('');
    const userText = text.trim();
    const msgId = `${qaItem.question_id}-u-${Date.now()}`;
    const userMsg = { id: msgId, role: 'user', text: userText, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setIsSending(true);

    try {
      const res = await submitAnswer(reportId, qaItem.question_id, userText);
      onAnswerSubmit(qaItem.question_id, userText);

      // 서버가 assistant_reply를 반환하면 대화로 추가. 없으면 아무런 AI 안내문을 추가하지 않습니다.
      if (res && res.assistant_reply) {
        const aiId = `${qaItem.question_id}-ai-${Date.now()}`;
        setMessages((m) => [...m, { id: aiId, role: 'ai', text: res.assistant_reply, ts: Date.now() }]);
      }
      setExpanded(true);
    } catch (err) {
      setError(err?.message || '메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // 변경: 심화질문은 기존 대화창(같은 messages 배열)에 이어서 표시.
  // 생성 중 표시를 위해 임시 로딩 메시지를 삽입하고, 결과로 교체/업데이트합니다.
  const handleDeepDive = async () => {
    setError('');
    setIsDeepDiveLoading(true);
    const tempId = `${qaItem.question_id}-deep-temp-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const tempMsg = { id: tempId, role: 'ai', text: '심화 질문을 생성 중입니다...', ts: Date.now(), loading: true };
    setMessages((m) => [...m, tempMsg]);
    try {
      const deepText = await onDeepDive(qaItem.question_id);
      // 결과가 없으면 사용자에게 알림 텍스트로 대체
      const finalText = deepText || '심화 질문을 생성하지 못했습니다.';
      setMessages((m) => m.map(msg => msg.id === tempId ? { ...msg, text: finalText, loading: false, ts: Date.now() } : msg));
      setExpanded(true);
    } catch (err) {
      const errText = err?.message || '심화 질문 요청 중 오류가 발생했습니다.';
      setMessages((m) => m.map(msg => msg.id === tempId ? { ...msg, text: errText, loading: false, ts: Date.now() } : msg));
      setError(err?.message || '심화 질문 요청 중 오류가 발생했습니다.');
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  // Enter 키: 심화질문 실행 (Shift+Enter -> 줄바꿈)
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.trim();
      if (text) {
        // 먼저 사용자의 메모(입력)를 서버에 저장(옵션)하고, 그 후 심화질문 요청
        handleSend(text).then(() => {
          handleDeepDive();
        });
        setInput('');
      } else {
        // 입력이 비어있으면 바로 심화질문 요청 (기존 대화창에 이어짐)
        handleDeepDive();
      }
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

        <IconButton size="small" onClick={() => setExpanded(!expanded)} aria-label={expanded ? '접기' : '펼치기'}>
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
                    {m.role === 'ai' && m.loading === true && (
                      <Typography variant="caption" color="text.secondary">생성 중…</Typography>
                    )}
                  </MessageMeta>
                </Box>
                {m.role === 'user' && <Avatar sx={{ bgcolor: (t) => t.palette.primary.main, width: 28, height: 28 }}><ChatBubbleOutlineIcon fontSize="small" /></Avatar>}
              </Box>
            ))}
          </MessagesBox>

          <InputRow>
            <TextField
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              multiline
              minRows={2}
              disabled={isSending || isDeepDiveLoading}
            />

            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleDeepDive} 
                disabled={isDeepDiveLoading || isSending}
                sx={{ minWidth: 160, height: 44 }}
              >
                {isDeepDiveLoading ? <CircularProgress size={18} color="inherit" /> : '심화 질문'}
              </Button>
            </Box>
          </InputRow>

          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </>
      )}
    </QAItemPaper>
  );
}

// 메인 QAChat: 여러 QAItem을 채팅처럼 렌더
function QAChat({ 
  reportId, 
  initialQuestions, 
  qaHistory, 
  questionsPoolCount, 
  isRefilling 
}) {
  // 초기 히스토리 중복 제거 (question_id 기준)
  const init = dedupeById(qaHistory || initialQuestions || []);
  const [history, setHistory] = useState(init);
  const [poolCount, setPoolCount] = useState(questionsPoolCount || 0);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingRefill, setIsLoadingRefill] = useState(isRefilling || false);
  const [error, setError] = useState('');

  const handleNextQuestion = async () => {
    setIsLoadingNext(true);
    setError('');
    try {
      const newQuestion = await getNextQuestion(reportId);
      if (!newQuestion) return;
      const exists = history.some(h => h.question_id === newQuestion.question_id);
      if (!exists) {
        setHistory((h) => [...h, newQuestion]);
        setPoolCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      setError(err?.message || '다음 질문을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingNext(false);
    }
  };

  const handleAnswerSubmit = (questionId, userAnswer) => {
    setHistory((currentHistory) => 
      currentHistory.map(item => 
        item.question_id === questionId 
          ? { ...item, answer: userAnswer } 
          : item
      )
    );
  };

  // 심화질문: 텍스트를 반환하도록 하고 QAItem에서 같은 스레드에 추가 (부모는 새 항목 생성하지 않음)
  const handleDeepDive = useCallback(async (parentQuestionId) => {
    setError('');
    try {
      const res = await getDeepDiveQuestion(reportId, parentQuestionId);
      const text = res?.question || res?.text || res?.prompt || (typeof res === 'string' ? res : null);
      return text || null;
    } catch (err) {
      setError(err?.message || '심화 질문 생성 중 오류가 발생했습니다.');
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
              대화형 Q&A
            </Typography>
            <Typography variant="body2" color="text.secondary">
              각 질문별로 AI와 이어서 대화하세요 — 심화질문은 기존 대화창에 이어집니다.
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
              onDeepDive={handleDeepDive}
            />
          )) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                아직 질문이 없습니다.
              </Typography>
              <Button variant="outlined" onClick={handleNextQuestion}>질문 생성</Button>
            </Box>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button 
            variant="contained" 
            onClick={handleNextQuestion}
            disabled={isLoadingNext || isLoadingRefill || poolCount === 0}
            sx={{ mr: 0, px: 3 }}
          >
            {isLoadingNext ? <CircularProgress size={20} color="inherit" /> :
             isLoadingRefill ? 'AI가 질문 리필 중...' : 
             poolCount === 0 ? '남은 질문 없음' : `다음 질문 (${poolCount})`}
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