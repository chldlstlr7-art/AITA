import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Radio,
  Divider,
  Chip,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getStudentDashboard, submitReportToAssignment } from '../../services/api';
import { getUserIdFromToken } from '../../utils/jwtHelper';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: theme.spacing(3),
    minWidth: 600,
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5, 4),
  borderRadius: theme.spacing(2),
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '1rem',
}));

function AssignmentSubmitModal({ open, onClose, assignmentId, assignmentName, courseName }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);

  useEffect(() => {
    if (open) {
      fetchAvailableReports();
    }
  }, [open]);

  const fetchAvailableReports = async () => {
    try {
      setLoading(true);
      setError('');
      
      const userId = getUserIdFromToken();
      if (!userId) {
        setError('사용자 정보를 확인할 수 없습니다.');
        return;
      }

      const data = await getStudentDashboard(userId);
      
      // 제출 가능한 리포트 필터링 (completed 상태이고 아직 미제출)
      const availableReports = (data.submitted_reports || []).filter(
        report => report.status === 'completed' && !report.assignment_id
      );
      
      setReports(availableReports);
      
      if (availableReports.length === 0) {
        setError('제출 가능한 완성된 리포트가 없습니다. 먼저 분석을 완료해주세요.');
      }
      
    } catch (err) {
      console.error('[AssignmentSubmitModal] 리포트 로딩 실패:', err);
      setError(err.message || '리포트 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReport = (reportId) => {
    setSelectedReportId(reportId);
  };

  const handleSubmit = async () => {
    if (!selectedReportId) {
      setError('제출할 리포트를 선택해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      console.log('[AssignmentSubmitModal] 제출 시작:', {
        reportId: selectedReportId,
        assignmentId,
      });

      await submitReportToAssignment(selectedReportId, assignmentId);

      console.log('[AssignmentSubmitModal] ✅ 제출 성공!');
      setSuccess(true);

      // 2초 후 모달 닫기
      setTimeout(() => {
        handleClose();
        window.location.reload(); // 대시보드 새로고침
      }, 2000);

    } catch (err) {
      console.error('[AssignmentSubmitModal] ❌ 제출 실패:', err);
      setError(err.message || '제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSelectedReportId(null);
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <StyledDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            과제 제출
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {courseName} - {assignmentName}
          </Typography>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3 }}>
        {success ? (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              ✅ 제출 완료!
            </Typography>
            <Typography variant="body2">
              리포트가 성공적으로 제출되었습니다.
            </Typography>
          </Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : reports.length > 0 ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  제출할 리포트를 선택하세요:
                </Typography>

                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {reports.map((report, index) => (
                    <React.Fragment key={report.report_id}>
                      <ListItemButton
                        selected={selectedReportId === report.report_id}
                        onClick={() => handleSelectReport(report.report_id)}
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          border: (theme) =>
                            selectedReportId === report.report_id
                              ? `2px solid ${theme.palette.primary.main}`
                              : `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                          '&:hover': {
                            background: (theme) => alpha(theme.palette.primary.main, 0.05),
                          },
                        }}
                      >
                        <ListItemIcon>
                          <Radio
                            checked={selectedReportId === report.report_id}
                            sx={{ p: 0 }}
                          />
                        </ListItemIcon>
                        <ListItemIcon>
                          <DescriptionIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {report.report_title || '제목 없음'}
                            </Typography>
                          }
                          secondary={
                            <Box mt={0.5}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <ScheduleIcon sx={{ fontSize: 14 }} />
                                <Typography variant="caption">
                                  {report.submitted_at
                                    ? format(parseISO(report.submitted_at), 'yyyy.MM.dd HH:mm', { locale: ko })
                                    : '날짜 정보 없음'}
                                </Typography>
                                {report.similarity_score !== undefined && (
                                  <Chip
                                    label={`유사도 ${report.similarity_score}%`}
                                    size="small"
                                    color={report.similarity_score > 30 ? 'error' : 'success'}
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Stack>
                            </Box>
                          }
                        />
                      </ListItemButton>
                      {index < reports.length - 1 && <Divider sx={{ my: 1 }} />}
                    </React.Fragment>
                  ))}
                </List>
              </>
            ) : (
              <Alert severity="info">
                제출 가능한 리포트가 없습니다.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={submitting}>
          취소
        </Button>
        <SubmitButton
          variant="contained"
          onClick={handleSubmit}
          disabled={!selectedReportId || submitting || success}
          startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
        >
          {submitting ? '제출 중...' : '제출하기'}
        </SubmitButton>
      </DialogActions>
    </StyledDialog>
  );
}

export default AssignmentSubmitModal;