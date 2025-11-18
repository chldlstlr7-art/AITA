import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// ==================== Styled Components ====================

const WhiteContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.3rem',
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
}));

const SubmissionCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s',
  
  '&:hover': {
    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-4px)',
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(8, 2),
  color: theme.palette.text.secondary,
}));

const ViewButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 600,
  borderRadius: theme.spacing(1),
}));

// ==================== Helper Functions ====================

const getStatusInfo = (status) => {
  switch (status) {
    case 'completed':
      return {
        label: '분석 완료',
        color: 'success',
        icon: <CheckCircleIcon fontSize="small" />,
      };
    case 'processing':
      return {
        label: '처리 중',
        color: 'warning',
        icon: <ScheduleIcon fontSize="small" />,
      };
    case 'failed':
      return {
        label: '실패',
        color: 'error',
        icon: <ErrorIcon fontSize="small" />,
      };
    default:
      return {
        label: '대기 중',
        color: 'default',
        icon: <ScheduleIcon fontSize="small" />,
      };
  }
};

// ==================== Main Component ====================

function SubmissionList({ course, submissions }) {
  const navigate = useNavigate();

  const handleViewReport = (reportId) => {
    navigate(`/report/${reportId}`);
  };

  return (
    <WhiteContainer>
      <Box sx={{ mb: 3 }}>
        <SectionTitle>
          {course.course_code} - {course.course_name}
        </SectionTitle>
        <Typography variant="body2" color="text.secondary">
          제출한 리포트: {submissions.length}개
        </Typography>
      </Box>

      {submissions.length === 0 ? (
        <EmptyState>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            아직 제출한 리포트가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            과제를 완료하고 리포트를 제출해보세요
          </Typography>
        </EmptyState>
      ) : (
        <Grid container spacing={2}>
          {submissions.map((report) => {
            const statusInfo = getStatusInfo(report.status);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={report.report_id}>
                <SubmissionCard>
                  <CardContent>
                    <Box sx={{ mb: 2 }}>
                      <Chip
                        label={statusInfo.label}
                        color={statusInfo.color}
                        size="small"
                        icon={statusInfo.icon}
                      />
                    </Box>
                    
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }} noWrap>
                      {report.report_title || '제목 없음'}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      과제: {report.assignment_name || '미지정'}
                    </Typography>
                    
                    <Typography variant="caption" color="text.secondary">
                      제출일: {report.created_at ? new Date(report.created_at).toLocaleDateString('ko-KR') : '-'}
                    </Typography>
                  </CardContent>
                  
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <ViewButton
                      fullWidth
                      variant="contained"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewReport(report.report_id)}
                    >
                      리포트 보기
                    </ViewButton>
                  </CardActions>
                </SubmissionCard>
              </Grid>
            );
          })}
        </Grid>
      )}
    </WhiteContainer>
  );
}

export default SubmissionList;