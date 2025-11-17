import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  School as SchoolIcon,
  Assignment as AssignmentIcon,
  ArrowForward as ArrowForwardIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
  
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.2)}`,
    borderColor: theme.palette.primary.main,
  },
}));

const CourseIcon = styled(Box)(({ theme }) => ({
  width: 56,
  height: 56,
  borderRadius: theme.spacing(2),
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

function CourseCard({ course }) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    // 과목 상세 페이지로 이동 (필요시 구현)
    console.log('과목 클릭:', course);
  };

  const assignmentCount = course.assignments?.length || 0;
  const pendingCount = course.assignments?.filter(a => !a.is_submitted)?.length || 0;

  return (
    <StyledCard elevation={0} onClick={handleCardClick}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
          <CourseIcon>
            <SchoolIcon sx={{ fontSize: 32, color: 'white' }} />
          </CourseIcon>
          
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {course.course_code}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {course.course_name}
            </Typography>
          </Box>

          <IconButton size="small" sx={{ mt: -1 }}>
            <ArrowForwardIcon />
          </IconButton>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <AssignmentIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                전체 과제
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {assignmentCount}
            </Typography>
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                미제출
              </Typography>
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 700, color: pendingCount > 0 ? 'error.main' : 'success.main' }}>
              {pendingCount}
            </Typography>
          </Box>
        </Stack>

        {pendingCount > 0 && (
          <Box mt={2}>
            <Chip
              label={`${pendingCount}개 과제 마감 임박`}
              size="small"
              color="error"
              sx={{ fontWeight: 600 }}
            />
          </Box>
        )}
      </CardContent>
    </StyledCard>
  );
}

export default CourseCard;