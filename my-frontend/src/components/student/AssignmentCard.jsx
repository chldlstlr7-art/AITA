import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  Button,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import AssignmentSubmitModal from './AssignmentSubmitModal';

const StyledCard = styled(Card)(({ theme, isOverdue }) => ({
  height: '100%',
  borderRadius: theme.spacing(2),
  border: `1px solid ${isOverdue ? theme.palette.error.main : alpha(theme.palette.primary.main, 0.12)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: isOverdue
      ? theme.palette.error.main
      : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
  
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  textTransform: 'none',
  fontWeight: 600,
  padding: theme.spacing(1.5, 3),
}));

function AssignmentCard({ assignment, courseName }) {
  const [modalOpen, setModalOpen] = useState(false);

  const dueDate = assignment.due_date ? parseISO(assignment.due_date) : null;
  const isOverdue = dueDate ? isPast(dueDate) : false;
  const daysLeft = dueDate ? differenceInDays(dueDate, new Date()) : null;
  
  const getUrgencyColor = () => {
    if (assignment.is_submitted) return 'success';
    if (isOverdue) return 'error';
    if (daysLeft !== null && daysLeft <= 3) return 'warning';
    return 'primary';
  };

  const getUrgencyLabel = () => {
    if (assignment.is_submitted) return '제출 완료';
    if (isOverdue) return '마감 지남';
    if (daysLeft !== null) {
      if (daysLeft === 0) return '오늘 마감';
      if (daysLeft === 1) return '내일 마감';
      if (daysLeft <= 3) return `${daysLeft}일 남음`;
      return `${daysLeft}일 남음`;
    }
    return '진행 중';
  };

  const handleSubmitClick = () => {
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  return (
    <>
      <StyledCard elevation={0} isOverdue={isOverdue && !assignment.is_submitted}>
        <CardContent sx={{ p: 3 }}>
          {/* 헤더 */}
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
            <Box flex={1}>
              <Chip
                label={courseName}
                size="small"
                sx={{ 
                  mb: 1, 
                  fontWeight: 600,
                  background: (theme) => alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                }}
              />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                {assignment.assignment_name}
              </Typography>
              {assignment.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {assignment.description}
                </Typography>
              )}
            </Box>

            <Chip
              label={getUrgencyLabel()}
              color={getUrgencyColor()}
              size="small"
              icon={assignment.is_submitted ? <CheckCircleIcon /> : <ScheduleIcon />}
              sx={{ fontWeight: 600 }}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* 과제 정보 */}
          <Stack spacing={1.5} mb={2}>
            {dueDate && (
              <Box display="flex" alignItems="center" gap={1}>
                <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  마감일:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {format(dueDate, 'yyyy년 MM월 dd일 (E)', { locale: ko })}
                </Typography>
              </Box>
            )}

            {assignment.submission_count !== undefined && (
              <Box display="flex" alignItems="center" gap={1}>
                <AssignmentIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  제출 현황:
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {assignment.submission_count}명 제출
                </Typography>
              </Box>
            )}
          </Stack>

          {/* 진행률 바 (선택적) */}
          {!assignment.is_submitted && daysLeft !== null && daysLeft >= 0 && (
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  남은 기간
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {Math.round((daysLeft / 7) * 100)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, (daysLeft / 7) * 100))}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: (theme) =>
                      daysLeft <= 3
                        ? `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${theme.palette.warning.main} 100%)`
                        : `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  },
                }}
              />
            </Box>
          )}

          {/* 액션 버튼 */}
          {!assignment.is_submitted && (
            <SubmitButton
              fullWidth
              variant="contained"
              color={isOverdue ? 'error' : 'primary'}
              startIcon={<SendIcon />}
              onClick={handleSubmitClick}
              disabled={isOverdue}
            >
              {isOverdue ? '마감됨' : '리포트 제출하기'}
            </SubmitButton>
          )}

          {assignment.is_submitted && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                background: (theme) => alpha(theme.palette.success.main, 0.1),
                border: (theme) => `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                textAlign: 'center',
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                제출 완료
              </Typography>
            </Box>
          )}
        </CardContent>
      </StyledCard>

      {/* 제출 모달 */}
      <AssignmentSubmitModal
        open={modalOpen}
        onClose={handleModalClose}
        assignmentId={assignment.assignment_id}
        assignmentName={assignment.assignment_name}
        courseName={courseName}
      />
    </>
  );
}

export default AssignmentCard;