import React, { useState } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Grid,
  Card,
  CardContent, 
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
  Fade,
  Collapse
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LogicFlowChart from './LogicFlowChart.jsx';
import { styled, alpha } from '@mui/material/styles';

const summaryTitles = {
  assignment_type: "과제 유형",
  Core_Thesis: "핵심 주장",
  Problem_Framing: "문제 제기",
  Claim: "세부 주장",
  Reasoning: "논거",
  Flow_Pattern: "논리 흐름",
  key_concepts: "주요 키워드"
};

// --- 스타일 컴포넌트 (전역 팔레트 사용) ---
const RootCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2.5),
  overflow: 'visible',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const SectionPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.5),
  borderRadius: theme.spacing(2),
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
    transform: 'translateY(-2px)',
  },
}));

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

const ScoreChip = ({ score }) => {
  const numeric = Number(score) || 0;
  const getConfig = () => {
    if (numeric >= 40) return { 
      color: 'success', 
      icon: <CheckCircleIcon fontSize="small" />,
      label: '안전',
      bgcolor: (t) => alpha(t.palette.success.main, 0.12),
      textColor: 'success.main'
    };
    if (numeric >= 25) return { 
      color: 'warning', 
      icon: <WarningIcon fontSize="small" />,
      label: '주의',
      bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
      textColor: 'warning.main'
    };
    return { 
      color: 'error', 
      icon: <ErrorIcon fontSize="small" />,
      label: '위험',
      bgcolor: (t) => alpha(t.palette.error.main, 0.12),
      textColor: 'error.main'
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

function ReportDisplay({ data }) {
  const [debugOpen, setDebugOpen] = useState(false);
  
  if (!data) return null;

  const { summary = {}, similarity_details = [] } = data;

  return (
    <Box sx={{ mt: 3 }}>
      {/* --- 1. 분석 요약 섹션 --- */}
      <Fade in timeout={600}>
        <RootCard elevation={0} sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: (t) => t.palette.primary.main,
                    width: 48, 
                    height: 48,
                    boxShadow: (t) => `0 4px 12px ${alpha(t.palette.primary.main, 0.3)}`
                  }}
                >
                  <AutoAwesomeIcon />
                </Avatar>
                <Box>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 0.5 }}>
                    분석 요약
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    AI 기반 핵심 요약 및 논리 구조 분석
                  </Typography>
                </Box>
              </Box>
              <Tooltip title="전체 데이터 복사" arrow>
                <IconButton 
                  size="small" 
                  onClick={() => copyToClipboard(JSON.stringify(data, null, 2))}
                  sx={{ 
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                    '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.15) }
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Grid container spacing={2.5}>
              {Object.entries(summary).map(([key, value]) => {
                if (key === 'Flow_Pattern') return null;

                return (
                  <Grid item xs={12} sm={6} key={key}>
                    <SectionPaper elevation={0}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Typography 
                          variant="overline" 
                          sx={{ 
                            fontWeight: 700,
                            color: 'primary.main',
                            letterSpacing: 0.5
                          }}
                        >
                          {summaryTitles[key] || key}
                        </Typography>
                        {key === 'assignment_type' && (
                          <Chip 
                            label={value} 
                            color={value === '분석 불가능' ? 'error' : 'primary'} 
                            sx={{ fontWeight: 700 }}
                            size="small"
                          />
                        )}
                      </Box>

                      {key === 'key_concepts' && Array.isArray(value) ? (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {value.map((k, i) => (
                            <Chip 
                              key={i} 
                              label={k} 
                              variant="outlined" 
                              size="small"
                              sx={{ 
                                borderColor: (t) => alpha(t.palette.primary.main, 0.3),
                                color: 'primary.main',
                                fontWeight: 600,
                                '&:hover': {
                                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                                }
                              }}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="body1" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                          {typeof value === 'object' ? JSON.stringify(value) : value || <em style={{ color: '#999' }}>정보 없음</em>}
                        </Typography>
                      )}
                    </SectionPaper>
                  </Grid>
                );
              })}
            </Grid>

            {/* Flow_Pattern 차트 */}
            {summary.Flow_Pattern && (
              <>
                <Divider sx={{ my: 4 }} />
                <Typography 
                  variant="overline" 
                  sx={{ 
                    fontWeight: 700, 
                    color: 'primary.main',
                    letterSpacing: 0.5,
                    mb: 2,
                    display: 'block'
                  }}
                >
                  {summaryTitles['Flow_Pattern']}
                </Typography>
                <GlassCard elevation={0}>
                  <LogicFlowChart flowData={summary.Flow_Pattern} />
                </GlassCard>
              </>
            )}
          </CardContent>
        </RootCard>
      </Fade>

      {/* --- 2. 유사도 분석 섹션 --- */}
      <Fade in timeout={800}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar 
              sx={{ 
                bgcolor: (t) => t.palette.secondary.main,
                color: 'primary.main',
                width: 48, 
                height: 48,
                boxShadow: (t) => `0 4px 12px ${alpha(t.palette.secondary.main, 0.3)}`
              }}
            >
              <CompareArrowsIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>유사도 분석 결과</Typography>
              <Typography variant="body2" color="text.secondary">
                LLM 기반 정밀 비교 · 표절 가능성 탐지
              </Typography>
            </Box>
          </Box>

          {similarity_details && similarity_details.length > 0 ? (
            <Stack spacing={2}>
              {similarity_details.map((item, index) => {
                const score = item.plagiarism_score ?? item.weighted_similarity ?? null;
                const numeric = Number(score) || 0;
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
                              비교 문서 #{index + 1}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.source_title || '제목 없음'}
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
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          🔍 LLM 정밀 비교 리포트
                        </Typography>
                        <Tooltip title="리포트 복사" arrow>
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(item.llm_comparison_report)}
                            sx={{ 
                              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                              '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.15) }
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ 
                        p: 2, 
                        borderRadius: 2, 
                        bgcolor: 'background.paper',
                        border: (t) => `1px solid ${t.palette.divider}`
                      }}>
                        {formatReportText(item.llm_comparison_report)}
                      </Box>
                    </AccordionDetails>
                  </StyledAccordion>
                );
              })}
            </Stack>
          ) : (
            <GlassCard elevation={0}>
              <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 2 }}>
                💡 유사도 비교 결과가 없습니다.
              </Typography>
            </GlassCard>
          )}
        </Box>
      </Fade>

      {/* --- 3. 디버깅용 JSON (접이식) --- */}
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

export default ReportDisplay;