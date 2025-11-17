import React from 'react';
import { Box, CircularProgress, Typography, LinearProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { LoadingBox } from './AdvancementStyles';

function AdvancementLoading({ pollingAttempts, maxAttempts }) {
  return (
    <LoadingBox>
      <CircularProgress 
        size={60} 
        sx={{ color: 'primary.main' }} 
      />
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        AI가 발전 아이디어를 생성하고 있습니다
      </Typography>
      <Typography variant="body2" color="text.secondary">
        리포트 내용과 대화 기록을 분석 중입니다
      </Typography>
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <LinearProgress 
          variant="determinate" 
          value={(pollingAttempts / maxAttempts) * 100}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
            },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          진행률: {pollingAttempts + 1} / {maxAttempts}
        </Typography>
      </Box>
    </LoadingBox>
  );
}

export default AdvancementLoading;