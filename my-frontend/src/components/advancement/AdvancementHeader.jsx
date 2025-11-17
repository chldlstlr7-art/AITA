import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  Breadcrumbs,
  Link,
  Typography,
  Fade,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Description as DescriptionIcon,
  NavigateNext as NavigateNextIcon,
  TipsAndUpdates as TipsIcon,
} from '@mui/icons-material';
import { alpha, styled } from '@mui/material/styles';
import { HeaderPaper } from './AdvancementStyles';

const PageTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 800,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginBottom: theme.spacing(1),
}));

function AdvancementHeader({ reportId, reportTitle }) {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(`/report/${reportId}`);
  };

  return (
    <Fade in timeout={600}>
      <HeaderPaper elevation={0}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton 
            onClick={handleBack} 
            sx={{ 
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
              }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          
          <Box flex={1}>
            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" />}
              sx={{ mb: 1.5 }}
            >
              <Link
                underline="hover"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' }
                }}
                onClick={() => navigate('/')}
              >
                <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                대시보드
              </Link>
              <Link
                underline="hover"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: 'pointer',
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' }
                }}
                onClick={handleBack}
              >
                <DescriptionIcon sx={{ mr: 0.5 }} fontSize="small" />
                리포트
              </Link>
              <Typography
                sx={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}
                color="primary"
              >
                발전 아이디어
              </Typography>
            </Breadcrumbs>
            
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: (theme) => `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                }}
              >
                <TipsIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              
              <Box>
                <PageTitle variant="h4">
                  발전 아이디어
                </PageTitle>
                {reportTitle && (
                  <Typography variant="body2" color="text.secondary">
                    {reportTitle}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </HeaderPaper>
    </Fade>
  );
}

export default AdvancementHeader;