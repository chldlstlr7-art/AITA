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
// (스타일 코드는 변경 없음)
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

// ==================== [신규] 백엔드 로직 (JS) ====================

// 🔥 백엔드 _parse_comparison_scores 로직 (점수 계산을 위해 내부적으로 필요)
const parseComparisonScores = (reportText) => {
  if (!reportText) return { final_score: 0, converted_scores: {} };

  const scores = {
    "Core Thesis": 0, "Problem Framing": 0, "Claim": 0,
    "Reasoning": 0, "Flow Pattern": 0, "Conclusion Framing": 0,
  };
  
  const keyMapping = [
    { key: "Core Thesis", re: /Core Thesis.*?(?:Similarity):\s*(?:\*\*)?\s*(\d)(?:\*\*)?\s*[–-]/i },
    { key: "Problem Framing", re: /Problem Framing.*?(?:Similarity):\s*(?:\*\*)?\s*(\d)(?:\*\*)?\s*[–-]/i },
    { key: "Claim", re: /Claim.*?(?:Similarity):\s*(?:\*\*)?\s*(\d)(?:\*\*)?\s*[–-]/i },
    { key: "Reasoning", re: /Reasoning.*?(?:Similarity):\s*(?:\*\*)?\s*(\d)(?:\*\*)?\s*[–-]/i },
    { key: "Flow Pattern", re: /Flow Pattern.*?(?:Similarity):\s*(?:\*\*)?\s*(\d)(?:\*\*)?\s*[–-]/i },
    { key: "Conclusion Framing", re: /Conclusion Framing.*?(?:Similarity):\s*(?:\*\*)?\s*(\d)(?:\*\*)?\s*[–-]/i },
  ];

  try {
    keyMapping.forEach(({ key, re }) => {
      const match = reportText.match(re);
      if (match && match[1]) {
        scores[key] = parseInt(match[1], 10);
      }
    });

    const converted_scores = {};
    converted_scores["Core Thesis"] = Math.pow(Math.max(0, scores["Core Thesis"] - 8), 2) * 2;
    converted_scores["Claim"] = Math.pow(Math.max(0, scores["Claim"] - 8), 2) * 2;
    converted_scores["Reasoning"] = Math.floor(Math.pow(Math.max(0, scores["Reasoning"] - 5), 1.5) * 2);
    converted_scores["Flow Pattern"] = Math.pow(Math.max(0, scores["Flow Pattern"] - 6), 2) * 2;
    converted_scores["Problem Framing"] = Math.max(0, scores["Problem Framing"] - 5) * 2;
    converted_scores["Conclusion Framing"] = Math.max(0, scores["Conclusion Framing"] - 5) * 2;

    const final_score = Object.values(converted_scores).reduce((a, b) => a + b, 0);

    return { final_score, converted_scores };
    
  } catch (e) {
    console.error("점수 파싱 중 에러:", e);
    return { final_score: 0, converted_scores: {} };
  }
};

const HIGH_RISK_THRESHOLD = 60;
const WARNING_THRESHOLD = 30; // <-- 점수 계산에는 필요

// ==================== Helper Components ====================

// [수정] RiskChip (점수 숨기기)
const RiskChip = ({ score }) => {
  const numeric = Number(score) || 0;
  
  const getConfig = () => {
    if (numeric >= HIGH_RISK_THRESHOLD) return { 
      color: 'error', 
      icon: <ErrorIcon fontSize="small" />,
      label: '고위험',
      bgcolor: (t) => alpha(t.palette.error.main, 0.12),
      textColor: 'error.main'
    };
    if (numeric >= WARNING_THRESHOLD) return { 
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
      label={config.label}
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

// ... (copyToClipboard, formatReportText 헬퍼 함수는 변경 없음) ...
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
  } = data;

  // 🔥 프론트에서 점수 계산 및 필터링 (로직은 동일하게 유지)
  const displayCandidates = similarity_details
    .map(item => {
      const { final_score, converted_scores } = parseComparisonScores(item.llm_comparison_report);
      return {
        ...item,
        total_score: final_score,
        itemized_scores: converted_scores,
      };
    })
    .filter(item => item.total_score >= WARNING_THRESHOLD) // 30점 이상 (계산에는 필요)
    .sort((a, b) => b.total_score - a.total_score);

  console.log('[SimilarityAnalysis] 📊 원본 데이터:', similarity_details.length, '건');
  console.log(`[SimilarityAnalysis] 🔍 ${WARNING_THRESHOLD}점 이상 필터링:`, displayCandidates.length, '건');

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
              LLM 정밀 비교 결과
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

                return (
                  <StyledAccordion key={item.candidate_id || index}>
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
                          <RiskChip score={score} />
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                              {item.candidate_filename || `비교 문서 #${index + 1}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {item.candidate_id}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails sx={{ bgcolor: (t) => alpha(t.palette.secondary.main, 0.03), px: 3, py: 2.5 }}>
                      
                      {/* LLM 비교 리포트 (유지) */}
                      {item.llm_comparison_report && (
                        <>
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
                          <Box sx={{ 
                            p: 2, 
                            borderRadius: 2, 
                            bgcolor: 'background.paper',
                            border: (t) => `1px solid ${t.palette.divider}`
                          }}>
                            {formatReportText(item.llm_comparison_report)}
                          </Box>
                        </>
                      )}
                    </AccordionDetails>
                  </StyledAccordion>
                );
              })}
            </Stack>
          ) : (
            // [수정] 표절 의심 없음 메시지
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
                {/* 🔥 수정: 점수 기준 문구 삭제 */}
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
              {/* 🔥 수정: 점수 기준 문구 삭제 */}
              📌 전체 비교 결과 (similarity_details): {similarity_details.length}건 | 주의 기준 이상: {displayCandidates.length}건
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