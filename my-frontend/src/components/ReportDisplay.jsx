// [파일 경로] src/components/ReportDisplay.jsx

import React, { useState } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Card,
  CardContent, 
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  Avatar,
  Fade
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FlagIcon from '@mui/icons-material/Flag';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SearchIcon from '@mui/icons-material/Search';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
// [수정] LogicFlowChart 대신 LogicFlowDiagram을 import 합니다.
import LogicFlowDiagram from './LogicFlowDiagram.jsx';
import { styled, alpha } from '@mui/material/styles';

// 🔄 요약 필드 순서 및 메타데이터 정의
// ... (설정 동일) ...
const summaryFieldsConfig = [
  {
    key: 'assignment_type',
    label: '과제 유형',
    icon: AssignmentIcon,
    description: '제출된 문서의 분류',
    color: 'primary.main'
  },
  {
    key: 'Problem_Framing',
    label: '문제 제기',
    icon: HelpOutlineIcon,
    description: '해결하려는 문제 정의',
    color: 'primary.main'
  },
  {
    key: 'Core_Thesis',
    label: '핵심 주장',
    icon: FlagIcon,
    description: '글의 가장 중요한 주장',
    color: 'primary.main'
  },
  {
    key: 'Reasoning_Logic',
    label: '논리 전개',
    icon: SearchIcon,
    description: '주장을 뒷받침하는 논리적 전개',
    color: 'primary.main'
  },
  {
    key: 'Specific_Evidence',
    label: '구체적 근거',
    icon: LightbulbIcon,
    description: '주장을 뒷받침하는 구체적 근거',
    color: 'primary.main'
  },
  {
    key: 'Conclusion_Framing',
    label: '결론 정리',
    icon: FlagIcon,
    description: '글의 결론 및 마무리',
    color: 'primary.main'
  },
  {
    key: 'key_concepts',
    label: '주요 키워드',
    icon: LocalOfferIcon,
    description: '문서의 핵심 개념',
    color: 'primary.main'
  }
];

// --- 스타일 컴포넌트 ---
// ... (스타일 동일) ...
const RootCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2.5),
  overflow: 'visible',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const SectionCard = styled(Paper)(({ theme }) => {
  const color = theme.palette.primary.main;
  return {
    padding: theme.spacing(3),
    borderRadius: theme.spacing(2),
    background: theme.palette.background.paper,
    border: `2px solid ${alpha(color, 0.15)}`,
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
    '&:before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      background: color,
    },
    '&:hover': {
      boxShadow: `0 8px 24px ${alpha(color, 0.13)}`,
      transform: 'translateY(-2px)',
    },
  };
});

const GlassCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
}));

// ... (copyToClipboard 함수 동일) ...
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


// [수정] prop으로 reportId를 받습니다.
function ReportDisplay({ data, userAssignmentType, reportId }) {
  if (!data) return null;

  const { summary = {} } = data;

  return (
    <Box sx={{ mt: 3 }}>
      <Fade in timeout={600}>
        <RootCard elevation={0}>
          <CardContent sx={{ p: 4 }}>
            {/* ... (헤더 및 요약 필드 렌더링 동일) ... */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: (t) => t.palette.primary.main,
                    width: 56, 
                    height: 56,
                    boxShadow: (t) => `0 4px 12px ${alpha(t.palette.primary.main, 0.3)}`
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 800, mb: 0.5 }}>
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

            <Stack spacing={3}>
              {summaryFieldsConfig.map((field) => {
                let value = summary[field.key];
                if (field.key === 'assignment_type') {
                  value = userAssignmentType || summary[field.key] || 'AI 자동 판단';
                }
                
                if (!value) return null;

                const IconComponent = field.icon;
                const displayValue = Array.isArray(value) ? value.join(', ') : value;

                return (
                  <SectionCard key={field.key} elevation={0} fieldcolor={field.color}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Avatar 
                        sx={(theme) => ({
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          color: theme.palette.primary.main,
                          width: 40,
                          height: 40
                        })}
                      >
                        <IconComponent fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography 
                          variant="h6" 
                          sx={(theme) => ({
                            fontWeight: 700,
                            color: theme.palette.primary.main,
                            mb: 0.5
                          })}
                        >
                          {field.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          {field.description}
                        </Typography>

                        {field.key === 'assignment_type' ? (
                          <Box>
                            <Chip 
                              label={value} 
                              color={value === '분석 불가능' ? 'error' : 'primary'} 
                              sx={{ fontWeight: 700, fontSize: '0.9rem' }}
                            />
                            
                          </Box>
                        ) : (
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontWeight: 500, 
                              lineHeight: 1.8,
                              color: 'text.primary'
                            }}
                          >
                            {typeof displayValue === 'object' ? JSON.stringify(displayValue) : displayValue}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </SectionCard>
                );
              })}
            </Stack>

            {/* [수정] Flow_Pattern 차트 섹션 */}
            {summary.Flow_Pattern && (
              <>
                <Divider sx={{ my: 4 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: alpha('#9c27b0', 0.1),
                      color: '#9c27b0',
                      width: 40,
                      height: 40
                    }}
                  >
                    <AutoAwesomeIcon fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 700,
                        color: '#9c27b0'
                      }}
                    >
                      논리 흐름
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      문서의 논리적 흐름 시각화
                    </Typography>
                  </Box>
                </Box>
                <GlassCard elevation={0}>
                  {/* [수정] LogicFlowChart 대신 LogicFlowDiagram을 사용하고, 
                    prop으로 'reportId'를 전달합니다.
                  */}
                  <LogicFlowDiagram reportId={reportId} />
                </GlassCard>
              </>
            )}
          </CardContent>
        </RootCard>
      </Fade>
    </Box>
  );
}

export default ReportDisplay;