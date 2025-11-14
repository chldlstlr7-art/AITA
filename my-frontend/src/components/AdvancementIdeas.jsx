import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Collapse,
  IconButton,
  Divider,
  Button,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  LightbulbOutlined,
  TipsAndUpdates,
  ExpandMore,
  CheckCircle,
  AutoAwesome,
  ErrorOutline,
  Refresh,
} from '@mui/icons-material';
import { getAdvancementIdeas } from '../services/api.js';

const IdeaCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
  boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.08)}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
}));

const ExpandButton = styled(IconButton)(({ theme, expanded }) => ({
  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
  transition: 'transform 0.3s ease',
}));

function AdvancementIdeas({ reportId }) {
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  const fetchIdeas = async () => {
    if (!reportId) {
      setError('리포트 ID가 없습니다.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('[AdvancementIdeas] Fetching ideas for report:', reportId);
      const data = await getAdvancementIdeas(reportId);
      
      console.log('[AdvancementIdeas] 받은 데이터:', data);
      
      if (!data) {
        setIdeas(null);
      } else {
        setIdeas(data);
      }
    } catch (err) {
      console.error('[AdvancementIdeas] 에러:', err);
      setError(err.message || '아이디어를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, [reportId]);

  const toggleExpand = (index) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Paper
        sx={{
          p: 4,
          textAlign: 'center',
          background: (t) => alpha(t.palette.secondary.main, 0.05),
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
          borderRadius: 2,
        }}
      >
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          발전 아이디어 생성 중...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          AI가 리포트와 대화 내용을 분석하고 있습니다. (최대 30초 소요)
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        icon={<ErrorOutline />}
        sx={{ borderRadius: 2 }}
        action={
          <Button 
            color="inherit" 
            size="small" 
            startIcon={<Refresh />}
            onClick={fetchIdeas}
          >
            재시도
          </Button>
        }
      >
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {error}
        </Typography>
        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
          문제가 계속되면 다음을 확인해주세요:
        </Typography>
        <Typography variant="caption" display="block">
          • 백엔드 서버가 실행 중인지 확인
        </Typography>
        <Typography variant="caption" display="block">
          • 브라우저 콘솔(F12)에서 에러 메시지 확인
        </Typography>
      </Alert>
    );
  }

  if (!ideas) {
    return (
      <Paper
        sx={{
          p: 3,
          textAlign: 'center',
          background: (t) => alpha(t.palette.secondary.main, 0.05),
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
          borderRadius: 2,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          💡 발전 아이디어가 아직 생성되지 않았습니다.
        </Typography>
      </Paper>
    );
  }

  // 백엔드 응답 구조 처리
  const ideasArray = Array.isArray(ideas) ? ideas : (ideas.ideas || []);
  const summary = ideas.summary || null;

  if (!ideasArray || ideasArray.length === 0) {
    return (
      <Paper
        sx={{
          p: 3,
          textAlign: 'center',
          background: (t) => alpha(t.palette.secondary.main, 0.05),
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
          borderRadius: 2,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          💡 생성된 아이디어가 없습니다.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar
          sx={{
            bgcolor: (t) => t.palette.secondary.main,
            color: 'primary.main',
            width: 48,
            height: 48,
            boxShadow: (t) => `0 4px 12px ${alpha(t.palette.secondary.main, 0.3)}`,
          }}
        >
          <LightbulbOutlined sx={{ fontSize: 28 }} />
        </Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            💡 발전 아이디어
          </Typography>
          <Typography variant="body2" color="text.secondary">
            AI가 제안하는 리포트 개선 방향 ({ideasArray.length}가지)
          </Typography>
        </Box>
      </Box>

      {/* 아이디어 카드 리스트 */}
      <Stack spacing={2.5}>
        {ideasArray.map((idea, index) => {
          const isExpanded = expandedIds.has(index);
          const ideaTitle = idea.title || idea.category || `아이디어 ${index + 1}`;
          const ideaDescription = idea.description || idea.content || idea.idea || (typeof idea === 'string' ? idea : '');
          const ideaCategory = idea.category || null;
          const ideaDetails = idea.details || null;
          const ideaExamples = idea.examples || [];
          const ideaChecklist = idea.checklist || [];

          return (
            <IdeaCard key={index} elevation={0}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                      color: 'primary.main',
                      width: 40,
                      height: 40,
                      fontWeight: 800,
                      fontSize: '1rem',
                    }}
                  >
                    {index + 1}
                  </Avatar>

                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <TipsAndUpdates fontSize="small" />
                        {ideaTitle}
                      </Typography>

                      {ideaDetails && (
                        <ExpandButton
                          size="small"
                          expanded={isExpanded}
                          onClick={() => toggleExpand(index)}
                        >
                          <ExpandMore />
                        </ExpandButton>
                      )}
                    </Box>

                    {ideaCategory && ideaCategory !== ideaTitle && (
                      <Chip
                        label={ideaCategory}
                        size="small"
                        icon={<AutoAwesome fontSize="small" />}
                        sx={{
                          mb: 1.5,
                          bgcolor: (t) => alpha(t.palette.secondary.main, 0.15),
                          color: 'primary.main',
                          fontWeight: 600,
                        }}
                      />
                    )}

                    {ideaDescription && (
                      <Typography
                        variant="body1"
                        sx={{
                          lineHeight: 1.8,
                          color: 'text.primary',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {ideaDescription}
                      </Typography>
                    )}

                    {ideaDetails && (
                      <Collapse in={isExpanded} timeout="auto">
                        <Divider sx={{ my: 2 }} />
                        <Box
                          sx={{
                            pl: 2,
                            borderLeft: (t) => `3px solid ${alpha(t.palette.primary.main, 0.2)}`,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              color: 'text.secondary',
                              mb: 1,
                              display: 'block',
                            }}
                          >
                            상세 내용:
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                          >
                            {ideaDetails}
                          </Typography>
                        </Box>
                      </Collapse>
                    )}

                    {ideaExamples.length > 0 && (
                      <Box
                        sx={{
                          mt: 2,
                          pl: 2,
                          borderLeft: (t) => `3px solid ${alpha(t.palette.primary.main, 0.2)}`,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: 'text.secondary',
                            mb: 1,
                            display: 'block',
                          }}
                        >
                          예시:
                        </Typography>
                        <Stack spacing={0.5}>
                          {ideaExamples.map((ex, i) => (
                            <Typography key={i} variant="body2" color="text.secondary">
                              • {ex}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {ideaChecklist.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: 'text.secondary',
                            mb: 1,
                            display: 'block',
                          }}
                        >
                          ✅ 실행 체크리스트:
                        </Typography>
                        <Stack spacing={0.8}>
                          {ideaChecklist.map((item, i) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <CheckCircle
                                fontSize="small"
                                sx={{ color: 'success.main', mt: 0.3 }}
                              />
                              <Typography variant="body2">{item}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </IdeaCard>
          );
        })}
      </Stack>

      {summary && (
        <Paper
          sx={{
            mt: 3,
            p: 2.5,
            background: (t) => alpha(t.palette.primary.main, 0.04),
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.12)}`,
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            📝 종합 요약
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {summary}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default AdvancementIdeas;