import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Radio,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { submitReportToAssignment } from '../../services/api.js';

// ==================== Styled Components ====================

const ReportListItem = styled(ListItemButton)(({ theme, selected }) => ({
  borderRadius: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: selected ? theme.palette.primary.light + '10' : 'transparent',
  transition: 'all 0.2s',
  
  '&:hover': {
    backgroundColor: theme.palette.primary.light + '20',
    borderColor: theme.palette.primary.main,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(6, 2),
  color: theme.palette.text.secondary,
}));

// ==================== Main Component ====================

function ReportSelectionModal({ 
  open, 
  onClose, 
  unsubmittedReports, 
  assignment, 
  course,
  onSubmitSuccess 
}) {
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectReport = (reportId) => {
    setSelectedReportId(reportId);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedReportId) {
      setError('리포트를 선택해주세요.');
      return;
    }
    
    // [수정] assignmentId를 여기서 먼저 추출
    const assignmentId = assignment.assignment_id || assignment.id;

    if (!assignmentId) {
      setError('과제 ID를 찾을 수 없습니다.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      console.log('[ReportSelectionModal] 📤 리포트 제출 시작:', {
        reportId: selectedReportId,
        assignmentId: assignmentId,
        courseId: course?.course_id,
      });

      // --- 👇 [수정] ---
      // api.js의 함수 정의(reportId, assignmentId)에 맞게
      // 인자 2개를 순서대로 전달합니다.
      const response = await submitReportToAssignment(
        selectedReportId,
        assignmentId
      );
      // --- 👆 [수정] ---

      console.log('[ReportSelectionModal] ✅ 제출 성공:', response);

      // 성공 콜백 호출
      if (onSubmitSuccess) {
        onSubmitSuccess(response);
      }

      // 모달 닫기
      onClose();
      
    } catch (err) {
      console.error('[ReportSelectionModal] ❌ 제출 실패:', err);
      setError(err.message || '리포트 제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // [수정] 모달이 닫힐 때 선택 상태도 초기화
  const handleCloseModal = () => {
    setSelectedReportId(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCloseModal} // <-- 수정
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, tabIndex: -1 } // 접근성 경고 수정
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            제출할 리포트 선택
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          과제: {assignment.assignment_name}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {unsubmittedReports.length === 0 ? (
          <EmptyState>
            <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              제출 가능한 리포트가 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary">
              먼저 리포트를 작성하고 분석을 완료해주세요
            </Typography>
          </EmptyState>
        ) : (
          <List disablePadding>
            {unsubmittedReports.map((report) => {
              // [수정] report.id (혹은 report.report_id) 사용
              const reportId = report.report_id || report.id;
              const isSelected = selectedReportId === reportId;
              const isCompleted = report.status === 'completed';

              return (
                <ReportListItem
                  key={reportId}
                  selected={isSelected}
                  onClick={() => isCompleted && handleSelectReport(reportId)}
                  disabled={!isCompleted}
                >
                  <Radio
                    checked={isSelected}
                    disabled={!isCompleted}
                    sx={{ mr: 1 }}
                  />
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {report.report_title || '제목 없음'}
                        </Typography>
                        {isCompleted && (
                          <Chip
                            label="분석 완료"
                            color="success"
                            size="small"
                            icon={<CheckCircleIcon />}
                          />
                        )}
                        {!isCompleted && (
                          <Chip
                            label={report.status === 'processing' ? '처리 중' : '대기 중'}
                            color="warning"
                            size="small"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        작성일: {new Date(report.created_at).toLocaleDateString('ko-KR')}
                      </Typography>
                    }
                  />
                </ReportListItem>
              );
            })}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={handleCloseModal} disabled={submitting}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!selectedReportId || submitting || unsubmittedReports.length === 0}
          startIcon={submitting ? <CircularProgress size={20} /> : null}
        >
          {submitting ? '제출 중...' : '제출하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReportSelectionModal;