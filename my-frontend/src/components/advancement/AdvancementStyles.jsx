import { styled, alpha } from '@mui/material/styles';
import { Box, Paper, Accordion, Button, Chip } from '@mui/material';

export const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(6),
}));

export const HeaderPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginBottom: theme.spacing(3),
  background: 'white',
  borderRadius: theme.spacing(3),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

export const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  background: 'white',
  borderRadius: theme.spacing(3),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

export const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: `${theme.spacing(2)} !important`,
  overflow: 'hidden',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  marginBottom: theme.spacing(2),
  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.06)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  '&:before': { display: 'none' },
  
  '&:hover': {
    boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
    transform: 'translateY(-2px)',
  },
  
  '&.Mui-expanded': {
    margin: `${theme.spacing(2)} 0`,
    boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
}));

export const ActionButton = styled(Button)(({ theme, variant: buttonVariant }) => {
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

export const ActionsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(3),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
}));

export const LoadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8),
  gap: theme.spacing(3),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
  borderRadius: theme.spacing(3),
  border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
}));

export const IdeaChip = styled(Chip)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  color: 'white',
  fontWeight: 700,
  minWidth: 36,
  height: 36,
  fontSize: '0.875rem',
  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

export const EvidenceBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  position: 'relative',
  overflow: 'hidden',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '4px',
    height: '100%',
    background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
}));