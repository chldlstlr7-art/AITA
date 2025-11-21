import React, { useState } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Avatar,
  Button,
  Collapse,
  Fade,
  Divider,
  Grid
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import DescriptionIcon from '@mui/icons-material/Description';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CodeIcon from '@mui/icons-material/Code'; // 아이콘 추가
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
  border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
  background: theme.palette.background.paper,
  boxShadow: 'none',
  '&:before': { display: 'none' },
  '&.Mui-expanded': {
    margin: '8px 0',
    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
    boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.08)}`,
  },
}));

const ReportContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  border: `1px solid ${theme.palette.grey[200]}`,
}));

// ==================== Constants ====================
const HIGH_RISK_THRESHOLD = 60;
const WARNING_THRESHOLD = 30; 

// 평가 항목 한글 매핑 (점수 대시보드용)
const SCORE_LABEL_MAP = {
  'Problem Framing': '문제 제기',
  'Claim': '핵심 주장',
  'Flow Pattern': '논리 전개',
  'Reasoning': '구체적 근거',
  'Conclusion Framing': '결론 정리',
  'Core Thesis': '주요 키워드'
};

// 리포트 본문 텍스트 한글 변환 맵
const REPORT_TEXT_REPLACEMENTS = {
  'Overall Comment': '종합 의견',
  'Detailed Scoring': '상세 평가 항목',
  'Core Thesis Similarity': '주요 키워드 유사도',
  'Problem Framing Similarity': '문제 제기 유사도',
  'Claim Similarity': '핵심 주장 유사도',
  'Reasoning Similarity': '구체적 근거 유사도',
  'Flow Pattern Similarity': '논리 전개 유사도',
  'Conclusion Framing Similarity': '결론 정리 유사도'
};

// ==================== Helper Components ====================

const RiskChip = ({ score }) => {
  const numeric = Number(score) || 0;
  
  const getConfig = () => {
    if (numeric >= HIGH_RISK_THRESHOLD) return { 
      color: 'error', 
      icon: <ErrorIcon fontSize="small" />,
      label: `고위험 (${numeric})`,
      bgcolor: (t) => alpha(t.palette.error.main, 0.08),
      textColor: 'error.dark'
    };
    if (numeric >= WARNING_THRESHOLD) return { 
      color: 'warning', 
      icon: <WarningIcon fontSize="small" />,
      label: `주의 (${numeric})`,
      bgcolor: (t) => alpha(t.palette.warning.main, 0.08),
      textColor: 'warning.dark'
    };
    return { 
      color: 'success', 
      icon: <CheckCircleIcon fontSize="small" />,
      label: `안전 (${numeric})`,
      bgcolor: (t) => alpha(t.palette.success.main, 0.08),
      textColor: 'success.dark'
    };
  };

  const config = getConfig();
  
  return (
    <Chip 
      icon={config.icon}
      label={config.label}
      sx={{ 
        fontWeight: 700,
        bgcolor: config.bgcolor,
        color: config.textColor,
        border: 'none',
        borderRadius: '8px',
        px: 0.5,
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

// 텍스트 포맷팅 로직 (한글 변환 및 스타일링)
const formatReportText = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, index) => {
    let processedLine = line;

    // 영문 키워드를 한글로 치환
    Object.entries(REPORT_TEXT_REPLACEMENTS).forEach(([eng, kor]) => {
      if (processedLine.includes(eng)) {
        processedLine = processedLine.replace(eng, kor);
      }
    });

    const trimmed = processedLine.trim();
    
    // 헤더 (Bold 처리된 항목)
    if (/^-\s\*\*/.test(processedLine) || /^\*\*/.test(trimmed)) {
      return (
        <Typography 
          key={index} 
          variant="subtitle2" 
          sx={{ 
            mt: 2, 
            mb: 0.5, 
            fontWeight: 800, 
            color: 'text.primary',
            letterSpacing: '-0.01em'
          }}
        >
          {trimmed.replace(/\*\*/g, '').replace(/^-\s/, '')}
        </Typography>
      );
    }
    
    // 인용구 또는 리스트 상세
    if (/^-\s/.test(processedLine) || /^>\s/.test(processedLine)) {
      return (
        <Typography 
          key={index} 
          variant="body2" 
          sx={{ 
            mb: 0.5, 
            pl: 1.5,
            borderLeft: (t) => `2px solid ${t.palette.grey[300]}`,
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
            fontSize: '0.9rem'
          }}
        >
          {trimmed.replace(/^>\s/, '')}
        </Typography>
      );
    }

    // 일반 텍스트
    if (trimmed === "") return <Box key={index} sx={{ height: 8 }} />; 

    return (
      <Typography 
        key={index} 
        variant="body2" 
        sx={{ 
          mb: 0.5, 
          whiteSpace: 'pre-wrap', 
          lineHeight: 1.7,
          color: 'text.secondary'
        }}
      >
        {processedLine}
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

  const { similarity_details = [] } = data;
  const displayCandidates = [...similarity_details].sort((a, b) => (b.plagiarism_score || 0) - (a.plagiarism_score || 0));

  return (
    <Box>
      {/* Header Section */}
      <Fade in timeout={600}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar 
            variant="rounded"
            sx={{ 
              bgcolor: (t) => alpha(t.palette.warning.main, 0.1),
              color: 'warning.main',
              width: 48, 
              height: 48,
            }}
          >
            <CompareArrowsIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              표절 의심 문서
            </Typography>
            <Typography variant="body2" color="text.secondary">
              LLM 정밀 비교 분석 리포트
            </Typography>
          </Box>
        </Box>
      </Fade>

      {/* Comparison List */}
      <Fade in timeout={800}>
        <Stack spacing={2}>
          {displayCandidates && displayCandidates.length > 0 ? (
            displayCandidates.map((item, index) => {
              const score = item.plagiarism_score || 0; 

              return (
                <StyledAccordion key={item.candidate_id || index}>
                  {/* Accordion Header */}
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                    sx={{ 
                      px: 2.5, 
                      py: 0.5,
                      '& .MuiAccordionSummary-content': { margin: '12px 0' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <RiskChip score={score} />
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            {item.candidate_filename || `문서 #${index + 1}`}
                          </Typography>
                          <Typography variant="caption" color="text.tertiary" sx={{ fontFamily: 'monospace' }}>
                            ID: {item.candidate_id?.substring(0, 8)}...
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </AccordionSummary>

                  {/* Accordion Content */}
                  <AccordionDetails sx={{ p: 3, pt: 0 }}>
                    {item.llm_comparison_report && (
                      <ReportContainer>
                        {/* 1. Report Header & Stats */}
                        <Box sx={{ mb: 3 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AssessmentIcon fontSize="small" color="action" />
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                세부 유사도 분석
                              </Typography>
                            </Box>
                            <Tooltip title="전체 리포트 복사" arrow>
                              <IconButton 
                                size="small" 
                                onClick={() => copyToClipboard(item.llm_comparison_report)}
                                sx={{ color: 'text.secondary' }}
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>

                          {/* Score Grid Dashboard (Korean Labels) */}
                          {item.scores_detail && (
                            <Grid container spacing={2} sx={{ mb: 1 }}>
                              {Object.entries(item.scores_detail).map(([key, val]) => {
                                const rawLabel = key.replace('Similarity', '').trim();
                                // 매핑된 한글 라벨 사용
                                const label = SCORE_LABEL_MAP[rawLabel] || rawLabel;
                                
                                return (
                                  <Grid item xs={6} sm={4} md={2} key={key}>
                                    <Box sx={{ 
                                      p: 1.5, 
                                      borderRadius: 2, 
                                      bgcolor: 'white',
                                      border: (t) => `1px solid ${t.palette.divider}`,
                                      textAlign: 'center',
                                      height: '100%',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center'
                                    }}>
                                      <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.75rem', fontWeight: 500 }}>
                                        {label}
                                      </Typography>
                                      <Typography variant="h6" sx={{ fontWeight: 700, color: val > 5 ? 'warning.main' : 'text.primary' }}>
                                        {val}<Typography component="span" variant="caption" color="text.secondary">/10</Typography>
                                      </Typography>
                                    </Box>
                                  </Grid>
                                );
                              })}
                            </Grid>
                          )}
                        </Box>

                        <Divider sx={{ mb: 3, borderStyle: 'dashed' }} />

                        {/* 2. Text Content */}
                        <Box>
                           <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <DescriptionIcon fontSize="small" color="action" />
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                LLM 정밀 코멘트
                              </Typography>
                           </Box>
                           <Box sx={{ pl: 0.5 }}>
                             {formatReportText(item.llm_comparison_report)}
                           </Box>
                        </Box>
                      </ReportContainer>
                    )}
                  </AccordionDetails>
                </StyledAccordion>
              );
            })
          ) : (
            <GlassCard elevation={0} sx={{ textAlign: 'center', py: 4 }}>
              <Avatar
                sx={{
                  width: 64, height: 64,
                  bgcolor: (t) => alpha(t.palette.success.main, 0.1),
                  color: 'success.main',
                  margin: '0 auto',
                  mb: 2
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                발견된 유사 문서가 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary">
                제출된 문서는 비교군과 유사성이 낮은 것으로 판단됩니다.
              </Typography>
            </GlassCard>
          )}
        </Stack>
      </Fade>

      {/* Debug Section - 복구 및 스타일 개선 */}
      <Box sx={{ mt: 4 }}>
        <Button 
          variant="outlined" 
          size="small"
          startIcon={<CodeIcon />}
          onClick={() => setDebugOpen(!debugOpen)}
          sx={{ 
            color: 'text.secondary',
            borderColor: (t) => alpha(t.palette.grey[400], 0.5),
            fontSize: '0.8rem',
            textTransform: 'none',
            '&:hover': {
               borderColor: 'primary.main',
               color: 'primary.main',
               backgroundColor: (t) => alpha(t.palette.primary.main, 0.05)
            }
          }}
        >
          {debugOpen ? '원본 데이터(JSON) 닫기' : '개발자용 데이터(JSON) 보기'}
        </Button>
        
        <Collapse in={debugOpen}>
          <Paper 
            elevation={0}
            sx={{ 
              mt: 2, p: 2, 
              bgcolor: (t) => alpha(t.palette.common.black, 0.03),
              borderRadius: 2,
              border: (t) => `1px solid ${t.palette.divider}`,
              textAlign: 'left'
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
               RAW JSON DATA
            </Typography>
            <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'Consolas, monospace', overflow: 'auto', maxHeight: 300 }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </Paper>
        </Collapse>
      </Box>
    </Box>
  );
}

export default SimilarityAnalysis;