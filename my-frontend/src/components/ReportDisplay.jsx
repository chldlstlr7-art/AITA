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
import LogicFlowChart from './LogicFlowChart.jsx';
import { styled, alpha } from '@mui/material/styles';

// 🔄 요약 필드 순서 및 메타데이터 정의
const summaryFieldsConfig = [
  {
    key: 'assignment_type',
    label: '📌 과제 유형',
    icon: AssignmentIcon,
    description: '제출된 문서의 분류',
    color: '#667eea'
  },
  {
    key: 'Core_Thesis',
    label: '🎯 핵심 주장',
    icon: FlagIcon,
    description: '글의 가장 중요한 주장',
    color: '#f5576c'
  },
  {
    key: 'Problem_Framing',
    label: '❓ 문제 제기',
    icon: HelpOutlineIcon,
    description: '해결하려는 문제 정의',
    color: '#fa8231'
  },
  {
    key: 'Claim',
    label: '💡 세부 주장',
    icon: LightbulbIcon,
    description: '핵심 주장을 뒷받침하는 세부 논점',
    color: '#4caf50'
  },
  {
    key: 'Reasoning',
    label: '🔍 논거',
    icon: SearchIcon,
    description: '주장을 뒷받침하는 근거와 논리',
    color: '#2196f3'
  },
  {
    key: 'key_concepts',
    label: '🏷️ 주요 키워드',
    icon: LocalOfferIcon,
    description: '문서의 핵심 개념',
    color: '#9c27b0'
  }
];

// --- 스타일 컴포넌트 ---
const RootCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2.5),
  overflow: 'visible',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const SectionCard = styled(Paper)(({ theme, fieldcolor }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.spacing(2),
  background: theme.palette.background.paper,
  border: `2px solid ${alpha(fieldcolor || theme.palette.primary.main, 0.15)}`,
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
    background: `linear-gradient(90deg, ${fieldcolor || theme.palette.primary.main}, ${alpha(fieldcolor || theme.palette.primary.main, 0.5)})`,
  },
  '&:hover': {
    boxShadow: `0 8px 24px ${alpha(fieldcolor || theme.palette.primary.main, 0.2)}`,
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

function ReportDisplay({ data }) {
  if (!data) return null;

  const { summary = {} } = data;

  return (
    <Box sx={{ mt: 3 }}>
      {/* 분석 요약 섹션 */}
      <Fade in timeout={600}>
        <RootCard elevation={0}>
          <CardContent sx={{ p: 4 }}>
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

            {/* 정렬된 순서로 요약 필드 렌더링 */}
            <Stack spacing={3}>
              {summaryFieldsConfig.map((field) => {
                const value = summary[field.key];
                if (!value) return null;

                const IconComponent = field.icon;

                return (
                  <SectionCard key={field.key} elevation={0} fieldcolor={field.color}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: alpha(field.color, 0.1),
                          color: field.color,
                          width: 40,
                          height: 40
                        }}
                      >
                        <IconComponent fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 700,
                            color: field.color,
                            mb: 0.5
                          }}
                        >
                          {field.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          {field.description}
                        </Typography>

                        {/* 과제 유형은 Chip으로 표시 */}
                        {field.key === 'assignment_type' && (
                          <Chip 
                            label={value} 
                            color={value === '분석 불가능' ? 'error' : 'primary'} 
                            sx={{ fontWeight: 700, fontSize: '0.9rem' }}
                          />
                        )}

                        {/* 주요 키워드는 Chip 리스트로 표시 */}
                        {field.key === 'key_concepts' && Array.isArray(value) && (
                          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                            {value.map((keyword, i) => (
                              <Chip 
                                key={i} 
                                label={keyword} 
                                variant="outlined" 
                                size="small"
                                sx={{ 
                                  borderColor: alpha(field.color, 0.4),
                                  color: field.color,
                                  fontWeight: 600,
                                  '&:hover': {
                                    bgcolor: alpha(field.color, 0.08),
                                  }
                                }}
                              />
                            ))}
                          </Stack>
                        )}

                        {/* 나머지 필드는 텍스트로 표시 */}
                        {field.key !== 'assignment_type' && field.key !== 'key_concepts' && (
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontWeight: 500, 
                              lineHeight: 1.8,
                              color: 'text.primary'
                            }}
                          >
                            {typeof value === 'object' ? JSON.stringify(value) : value}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </SectionCard>
                );
              })}
            </Stack>

            {/* Flow_Pattern 차트 */}
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
                      📊 논리 흐름
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      문서의 논리적 흐름 시각화
                    </Typography>
                  </Box>
                </Box>
                <GlassCard elevation={0}>
                  <LogicFlowChart flowData={summary} />
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