import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Divider,
  IconButton,
  Card,
  CardContent,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import ReportSelectionModal from './ReportSelectionModal.jsx';

// ==================== Styled Components ====================

const DetailContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  height: 'calc(100vh - 120px)',
  position: 'sticky',
  top: 80,
  overflow: 'auto',
}));

const DetailHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(3),
}));

const DetailTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.1rem',
  color: theme.palette.text.primary,
}));

const InfoCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
}));

const ActionButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 600,
  borderRadius: theme.spacing(1),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(6, 2),
  color: theme.palette.text.secondary,
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

function SubmissionDetail({ assignment, course, submissions, unsubmittedReports, onClose, onRefresh }) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  // 🔥 ID 필드 통일
  const getAssignmentId = (obj) => obj?.assignment_id || obj?.id;
  const assignmentId = getAssignmentId(assignment);

  console.log('[SubmissionDetail] 📦 Props:', {
    assignment,
    assignmentId,
    course,
    submissions,
    unsubmittedReports,
  });

  const hasSubmission = submissions.length > 0;
  const latestSubmission = hasSubmission ? submissions[0] : null;
  const statusInfo = latestSubmission ? getStatusInfo(latestSubmission.status) : null;

  const handleViewReport = (reportId) => {
    navigate(`/report/${reportId}`);
  };

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleSubmitSuccess = () => {
    console.log('[SubmissionDetail] ✅ 제출 성공! 데이터 새로고침...');
    // 부모 컴포넌트에 데이터 새로고침 요청
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
      <DetailContainer>
        <DetailHeader>
          <DetailTitle>
            과제 상세
          </DetailTitle>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DetailHeader>

        {/* 과제 정보 */}
        <InfoCard variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              과제명
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              {assignment.assignment_name}
            </Typography>

            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              설명
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
              {assignment.description || '설명이 없습니다'}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={3}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  마감일
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {assignment.due_date 
                    ? new Date(assignment.due_date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : '없음'}
                </Typography>
              </Box>
              
              {assignment.report_count !== undefined && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    전체 제출 수
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {assignment.report_count}개
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </InfoCard>

        {/* 제출 상태 */}
        {hasSubmission ? (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              제출 내역
            </Typography>

            {submissions.map((submission) => {
              const status = getStatusInfo(submission.status);
              return (
                <InfoCard key={submission.report_id} variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {submission.report_title || '제목 없음'}
                      </Typography>
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                        icon={status.icon}
                      />
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      제출일: {new Date(submission.created_at).toLocaleDateString('ko-KR')}
                    </Typography>

                    {submission.grade !== null && submission.grade !== undefined && (
                      <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
                        점수: {submission.grade}점
                      </Typography>
                    )}

                    <ActionButton
                      fullWidth
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleViewReport(submission.report_id)}
                      sx={{ mt: 1 }}
                    >
                      리포트 보기
                    </ActionButton>
                  </CardContent>
                </InfoCard>
              );
            })}

            <ActionButton
              fullWidth
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={handleOpenModal}
              sx={{ mt: 2 }}
            >
              새 리포트 제출
            </ActionButton>
          </>
        ) : (
          <>
            <EmptyState>
              <UploadIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                아직 제출한 리포트가 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary">
                리포트를 작성하고 제출하세요
              </Typography>
            </EmptyState>

            <ActionButton
              fullWidth
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={handleOpenModal}
              size="large"
            >
              리포트 제출하기
            </ActionButton>
          </>
        )}
      </DetailContainer>

      {/* 🔥 리포트 선택 모달 */}
      <ReportSelectionModal
        open={modalOpen}
        onClose={handleCloseModal}
        unsubmittedReports={unsubmittedReports || []}
        assignment={assignment}
        course={course}
        onSubmitSuccess={handleSubmitSuccess}
      />
    </>
  );
}

export default SubmissionDetail;