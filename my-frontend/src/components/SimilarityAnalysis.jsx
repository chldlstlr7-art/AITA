import React, { useState } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Grid,
  Accordion,
  AccordionSummary, 
  AccordionDetails,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  LinearProgress,
  Avatar,
  Button,
  Collapse,
  Fade
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { styled, alpha } from '@mui/material/styles';

// ==================== Styled Components ====================

const GlassCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: `${theme.spacing(2)} !important`,
  overflow: 'hidden',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  background: theme.palette.background.paper,
  boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.06)}`,
  '&:before': { display: 'none' },
  '&.Mui-expanded': {
    margin: '8px 0',
    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
  },
}));

// ==================== Helper Components ====================

const ScoreChip = ({ score }) => {
  const numeric = Number(score) || 0;
  const getConfig = () => {
    // 🔄 수정: 점수가 높을수록 위험
    if (numeric >= 40) return { 
      color: 'error', 
      icon: <ErrorIcon fontSize="small" />,
      label: '고위험',
      bgcolor: (t) => alpha(t.palette.error.main, 0.12),
      textColor: 'error.main'
    };
    if (numeric >= 25) return { 
      color: 'warning', 
      icon: <WarningIcon fontSize="small" />,
      label: '주의',
      bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
      textColor: 'warning.main'
    };
    return { 
      color: 'success', 
      icon: <CheckCircleIcon fontSize="small" />,
      label: '안전',
      bgcolor: (t) => alpha(t.palette.success.main, 0.12),
      textColor: 'success.main'
    };
  };

  const config = getConfig();
  
  return (
    <Chip 
      icon={config.icon}
      label={`${numeric}/50 · ${config.label}`}
      sx={{ 
        fontWeight: 700,
        bgcolor: config.bgcolor,
        color: config.textColor,
        border: 'none',
        px: 1,
      }}
      size="medium"
    />
  );
};

const copyToClipboard = (text) => {
  try {
    navigator.clipboard.writeText(text);
  } catch (e) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
};

const formatReportText = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, index) => {
    const trimmed = line.trim();
    if (/^-\s\*\*/.test(line) || /^\*\*/.test(trimmed)) {
      return (
        <Typography key={index} variant="body2" sx={{ mb: 1.5, fontWeight: 700, color: 'primary.main' }}>
          {trimmed.replace(/\*\*/g, '')}
        </Typography>
      );
    }
    if (/^-\s/.test(line) || /^>\s/.test(line)) {
      return (
        <Typography 
          key={index} 
          variant="body2" 
          sx={{ 
            mb: 1.2, 
            pl: 2,
            borderLeft: (t) => `3px solid ${alpha(t.palette.primary.main, 0.2)}`,
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
          }}
        >
          {trimmed}
        </Typography>
      );
    }
    return (
      <Typography 
        key={index} 
        variant="body2" 
        sx={{ mb: 1, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
      >
        {line}
      </Typography>
    );
  });
};

// ==================== Main Component ====================

function SimilarityAnalysis({ data }) {
  const [debugOpen, setDebugOpen] = useState(false);

  if (!data) {
    return (
      <GlassCard elevation={0}>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 2 }}>
          유사도 분석 데이터를 불러올 수 없습니다.
        </Typography>
      </GlassCard>
    );
  }

  const { 
    similarity_details = [],
    high_similarity_candidates = []
  } = data;

  const displayCandidates = high_similarity_candidates;

  return (
    <Box>
      {/* 헤더 */}
      <Fade in timeout={600}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar 
            sx={{ 
              bgcolor: (t) => t.palette.warning.main,
              width: 56, 
              height: 56,
              boxShadow: (t) => `0 4px 12px ${alpha(t.palette.warning.main, 0.3)}`
            }}
          >
            <CompareArrowsIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>표절 의심 문서</Typography>
            <Typography variant="body2" color="text.secondary">
              LLM 정밀 비교 결과 · 20점 이상 유사도 발견 ({displayCandidates.length}건)
            </Typography>
          </Box>
        </Box>
      </Fade>

      {/* 유사도 분석 결과 */}
      <Fade in timeout={800}>
        <Box>
          {displayCandidates && displayCandidates.length > 0 ? (
            <Stack spacing={2}>
              {displayCandidates.map((item, index) => {
                const score = item.total_score || 0;
                const numeric = Number(score);
                const progress = Math.min((numeric / 50) * 100, 100);

                return (
                  <StyledAccordion key={index}>
                    <AccordionSummary 
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ 
                        px: 3,
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.02)
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <ScoreChip score={score} />
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                              {item.filename || `비교 문서 #${index + 1}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {item.candidate_id}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ width: 180, display: { xs: 'none', sm: 'block' } }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={progress} 
                            sx={{ 
                              height: 8, 
                              borderRadius: 2,
                              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 2,
                                // 🔄 수정: 점수가 높을수록 빨간색
                                background: (t) => numeric >= 40 
                                  ? t.palette.error.main 
                                  : numeric >= 25 
                                  ? t.palette.warning.main 
                                  : t.palette.success.main
                              }
                            }} 
                          />
                        </Box>
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails sx={{ bgcolor: (t) => alpha(t.palette.secondary.main, 0.03), px: 3, py: 2.5 }}>
                      {/* 세부 점수 표시 */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1.5 }}>
                          📊 세부 항목별 점수
                        </Typography>
                        <Grid container spacing={1.5}>
                          {item.itemized_scores && Object.entries(item.itemized_scores).map(([key, value]) => (
                            <Grid item xs={6} sm={4} key={key}>
                              <Paper 
                                elevation={0}
                                sx={{ 
                                  p: 1.5, 
                                  textAlign: 'center',
                                  bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
                                  border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`
                                }}
                              >
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  {key}
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                  {value}
                                </Typography>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>

                      {/* LLM 비교 리포트 */}
                      {similarity_details[index]?.llm_comparison_report && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                              🔍 LLM 정밀 비교 리포트
                            </Typography>
                            <Tooltip title="리포트 복사" arrow>
                              <IconButton 
                                size="small" 
                                onClick={() => copyToClipboard(similarity_details[index].llm_comparison_report)}
                                sx={{ 
                                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                                  '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.15) }
                                }}
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Box sx={{ 
                            p: 2, 
                            borderRadius: 2, 
                            bgcolor: 'background.paper',
                            border: (t) => `1px solid ${t.palette.divider}`
                          }}>
                            {formatReportText(similarity_details[index].llm_comparison_report)}
                          </Box>
                        </>
                      )}
                    </AccordionDetails>
                  </StyledAccordion>
                );
              })}
            </Stack>
          ) : (
            <GlassCard elevation={0}>
              <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: (t) => alpha(t.palette.success.main, 0.12),
                    color: 'success.main'
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 48 }} />
                </Avatar>
                <Typography variant="h6" color="text.primary" fontWeight={700}>
                  표절 의심 문서가 발견되지 않았습니다
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  모든 문서의 유사도 점수가 20점 미만입니다.
                </Typography>
              </Stack>
            </GlassCard>
          )}
        </Box>
      </Fade>

      {/* 디버깅용 JSON */}
      <Box sx={{ mt: 4 }}>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => setDebugOpen(!debugOpen)}
          sx={{ 
            borderColor: (t) => alpha(t.palette.grey[500], 0.3),
            color: 'text.secondary',
            textTransform: 'none'
          }}
        >
          {debugOpen ? '원본 JSON 숨기기' : '(개발자용) 원본 JSON 보기'}
        </Button>
        <Collapse in={debugOpen}>
          <Paper 
            sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: (t) => alpha(t.palette.grey[500], 0.05),
              border: (t) => `1px solid ${t.palette.divider}`,
              borderRadius: 2
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              📌 전체 비교 결과 (similarity_details): {similarity_details.length}건
            </Typography>
            <Box 
              component="pre" 
              sx={{ 
                whiteSpace: 'pre-wrap', 
                wordWrap: 'break-word',
                fontFamily: 'monospace',
                fontSize: '11px',
                maxHeight: 360,
                overflow: 'auto',
                margin: 0
              }}
            >
              {JSON.stringify(data, null, 2)}
            </Box>
          </Paper>
        </Collapse>
      </Box>
    </Box>
  );
}

export default SimilarityAnalysis;