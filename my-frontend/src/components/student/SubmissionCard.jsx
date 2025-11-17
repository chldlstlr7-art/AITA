import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  Button,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  Visibility as VisibilityIcon,
  TipsAndUpdates as TipsIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
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
    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
  
  '&:hover': {
    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
    borderColor: theme.palette.primary.main,
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  textTransform: 'none',
  fontWeight: 600,
}));

function SubmissionCard({ report }) {
  const navigate = useNavigate();

  const submittedDate = report.submitted_at ? parseISO(report.submitted_at) : null;

  const handleViewReport = () => {
    navigate(`/report/${report.report_id}`);
  };

  const handleViewAdvancement = () => {
    navigate(`/report/${report.report_id}/advancement`);
  };

  return (
    <StyledCard elevation={0}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="flex-start" gap={2}>
          {/* 아이콘 */}
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
            <DescriptionIcon sx={{ fontSize: 28, color: 'white' }} />
          </Box>

          {/* 콘텐츠 */}
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Chip
                label={report.course_name || '과목명'}
                size="small"
                sx={{
                  fontWeight: 600,
                  background: (theme) => alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                }}
              />
              {report.status === 'completed' && (
                <Chip
                  label="분석 완료"
                  size="small"
                  color="success"
                  icon={<CheckCircleIcon />}
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {report.report_title || report.assignment_name || '제목 없음'}
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
              {submittedDate && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {format(submittedDate, 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </Typography>
                </Box>
              )}

              {report.similarity_score !== undefined && (
                <Chip
                  label={`유사도 ${report.similarity_score}%`}
                  size="small"
                  color={report.similarity_score > 30 ? 'error' : 'success'}
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* 액션 버튼 */}
            <Stack direction="row" spacing={2}>
              <ActionButton
                variant="outlined"
                startIcon={<VisibilityIcon />}
                onClick={handleViewReport}
                size="small"
              >
                리포트 보기
              </ActionButton>

              {report.status === 'completed' && (
                <ActionButton
                  variant="contained"
                  startIcon={<TipsIcon />}
                  onClick={handleViewAdvancement}
                  size="small"
                >
                  발전 아이디어
                </ActionButton>
              )}
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </StyledCard>
  );
}

export default SubmissionCard;