import React from 'react';
import { Box, Typography, Stack, Divider, Fade, Paper, Button } from '@mui/material';
import {
  AddCircleOutline as NewReportIcon,
  Dashboard as DashboardIcon,
  Send as SubmitIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// ==================== Styled Components (기존 디자인 유지) ====================
const ActionsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(3),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
}));

const ActionButton = styled(Button)(({ theme, variant: buttonVariant }) => {
  const isPrimary = buttonVariant === 'primary';
  const isSecondary = buttonVariant === 'secondary';
  
  return {
    padding: theme.spacing(2, 4),
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: theme.spacing(2),
    textTransform: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: 56,
    
    ...(isPrimary && {
      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
      color: 'white',
      boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
      
      '&:hover': {
        background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 28px ${alpha(theme.palette.primary.main, 0.5)}`,
      },
    }),
    
    ...(isSecondary && {
      background: alpha(theme.palette.primary.main, 0.08),
      color: theme.palette.primary.main,
      border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
      
      '&:hover': {
        background: alpha(theme.palette.primary.main, 0.15),
        borderColor: alpha(theme.palette.primary.main, 0.3),
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
      },
    }),
    
    ...(!isPrimary && !isSecondary && {
      background: 'white',
      color: theme.palette.text.primary,
      border: `2px solid ${theme.palette.divider}`,
      
      '&:hover': {
        background: alpha(theme.palette.primary.main, 0.05),
        borderColor: theme.palette.primary.main,
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
      },
    }),
  };
});

// ==================== Component ====================

function AdvancementActions({ onNewReport, onViewDashboard, onSubmit }) {
  return (
    <Fade in timeout={1000}>
      <ActionsContainer elevation={0}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            ✨ 마무리
          </Typography>
          <Typography variant="body2" color="text.secondary">
            발전 아이디어를 확인했다면 다음 단계를 진행하세요
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          spacing={2}
          sx={{ width: '100%' }}
        >
          {/* (버튼 1: 새로운 보고서) */}
          <ActionButton
            variant="secondary"
            fullWidth
            startIcon={<NewReportIcon />}
            onClick={onNewReport}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                새로운 보고서 분석하기
              </Typography>
              <Typography variant="caption" color="text.secondary">
                다른 과제의 보고서를 분석합니다
              </Typography>
            </Box>
          </ActionButton>

          {/* (버튼 2: 대시보드) */}
          <ActionButton
            fullWidth
            startIcon={<DashboardIcon />}
            onClick={onViewDashboard}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                학생 대시보드 보기
              </Typography>
              <Typography variant="caption" color="text.secondary">
                제출 현황과 피드백을 확인합니다
              </Typography>
            </Box>
          </ActionButton>

          {/* (버튼 3: 과제 제출) */}
          <ActionButton
            variant="primary"
            fullWidth
            startIcon={<SubmitIcon />}
            onClick={onSubmit} // 🔥 여기서 부모 컴포넌트(Page)의 다이얼로그 열기 함수를 실행
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                해당 과제 제출하기
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                최종 보고서를 제출합니다
              </Typography>
            </Box>
          </ActionButton>
        </Stack>
      </ActionsContainer>
    </Fade>
  );
}

export default AdvancementActions;