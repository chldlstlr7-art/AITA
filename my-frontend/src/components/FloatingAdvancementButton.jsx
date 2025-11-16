import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Fab, Tooltip, Typography, Chip } from '@mui/material';
import { 
  TipsAndUpdates as IdeaIcon,
  ArrowForward as ArrowIcon 
} from '@mui/icons-material';
import { styled, alpha, keyframes } from '@mui/material/styles';

const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7);
  }
  70% {
    box-shadow: 0 0 0 20px rgba(102, 126, 234, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(102, 126, 234, 0);
  }
`;

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
`;

const shine = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`;

const FloatingContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  right: theme.spacing(3),
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  animation: `${bounce} 3s ease-in-out infinite`,
}));

const LabelBox = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  padding: theme.spacing(1.5, 3),
  borderRadius: theme.spacing(3),
  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
  
  '&:before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '200%',
    height: '100%',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
    animation: `${shine} 3s infinite`,
  },
  
  '&:hover': {
    transform: 'scale(1.05)',
    boxShadow: '0 12px 32px rgba(102, 126, 234, 0.6)',
  },
}));

const StyledFab = styled(Fab)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  width: 72,
  height: 72,
  boxShadow: '0 8px 24px rgba(102, 126, 234, 0.5)',
  transition: 'all 0.3s ease',
  animation: `${pulse} 2s infinite`,
  
  '&:hover': {
    transform: 'scale(1.1) rotate(10deg)',
    boxShadow: '0 12px 32px rgba(102, 126, 234, 0.7)',
    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
  },
  
  '& .MuiSvgIcon-root': {
    fontSize: 36,
  },
}));

const NextStepChip = styled(Chip)(({ theme }) => ({
  background: alpha('#fff', 0.25),
  color: 'white',
  fontWeight: 700,
  fontSize: '0.7rem',
  height: 20,
  borderRadius: 10,
  animation: `${pulse} 2s infinite`,
  
  '& .MuiChip-label': {
    padding: '0 8px',
  },
}));

function FloatingAdvancementButton({ reportId }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/report/${reportId}/advancement`);
  };

  return (
    <FloatingContainer>
      {/* 텍스트 라벨 */}
      <LabelBox onClick={handleClick}>
        <Box>
          <Box display="flex" alignItems="center" gap={0.5} mb={0.3}>
            <NextStepChip label="다음 단계" size="small" />
          </Box>
          
          <Typography 
            variant="caption" 
            sx={{ 
              opacity: 0.9,
              fontSize: '0.75rem',
            }}
          >
            AITA와의 대화 내용으로
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1.2,
            }}
          >
            발전 아이디어 생성하기
          </Typography>
        </Box>
        <ArrowIcon sx={{ fontSize: 24 }} />
      </LabelBox>

      {/* 아이콘 버튼 */}
      <Tooltip 
        title="발전 아이디어 페이지로 이동" 
        placement="left"
        arrow
      >
        <StyledFab onClick={handleClick}>
          <IdeaIcon />
        </StyledFab>
      </Tooltip>
    </FloatingContainer>
  );
}

export default FloatingAdvancementButton;