import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  getAssignmentDetail,
  getAssignmentSubmissions,
  putAssignmentCriteria,
} from '../../services/api';

function TAAssignmentDetail() {
  const { courseId, assignmentId } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('view'); // 'view' | 'edit'
  const [criteriaText, setCriteriaText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAssignmentDetail(assignmentId);
        // backend may return either the object directly or { assignment: {...} }
        const a = data.assignment || data;
        setAssignment(a);
        setCriteria(a.criteria || data.criteria || null);
        setCriteriaText(JSON.stringify(a.criteria || data.criteria || null, null, 2) || '');

        // try submissions from detail first, otherwise fetch separate endpoint
        const subs = a.submissions || data.submissions || null;
        if (subs) {
          setSubmissions(subs);
        } else {
          const subsRes = await getAssignmentSubmissions(assignmentId);
          // subsRes may be { submissions: [...] } or array
          setSubmissions(subsRes.submissions || subsRes || []);
        }
      } catch (err) {
        setError(err.message || '데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [assignmentId]);

  const formatDateString = (d) => {
    if (!d) return '미정';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleString('ko-KR');
    } catch (e) {
      return d;
    }
  };

  const handleOpenRegister = () => {
    setDialogMode('edit');
    setDialogOpen(true);
    // if no criteria yet, prefill with an example structure
    if (!criteria) {
      setCriteriaText(JSON.stringify({ criteria_1: { name: '', max_score: 0 } }, null, 2));
    }
  };

  const handleOpenView = () => {
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleSaveCriteria = async () => {
    try {
      const parsed = JSON.parse(criteriaText);
      await putAssignmentCriteria(assignmentId, parsed);
      // refresh
      const data = await getAssignmentDetail(assignmentId);
      const a = data.assignment || data;
      setCriteria(a.criteria || data.criteria || parsed);
      setCriteriaText(JSON.stringify(a.criteria || data.criteria || parsed, null, 2));
      setDialogOpen(false);
    } catch (err) {
      alert('채점 기준 저장 중 오류: ' + (err.message || err));
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
        과제 상세
      </Typography>

      <Typography variant="body1">과목 ID: {courseId}</Typography>
      <Typography variant="body1" sx={{ mb: 1 }}>과제 ID: {assignmentId}</Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {assignment?.assignment_name || assignment?.name || assignment?.title || '과제명 없음'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          제출기한: {assignment?.due_date ? formatDateString(assignment.due_date) : '미정'}
        </Typography>
        {assignment?.description && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
            {assignment.description}
          </Typography>
        )}
      </Box>

      <Paper sx={{ p: 2, mb: 3 }} elevation={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">채점 기준</Typography>
            <Typography variant="body2" color="text.secondary">
              저장된 채점 기준을 등록하거나 확인할 수 있습니다.
            </Typography>
          </Box>
          <Box>
            {loading ? (
              <CircularProgress size={24} />
            ) : criteria ? (
              <Button variant="outlined" onClick={handleOpenView}>보기</Button>
            ) : (
              <Button variant="contained" onClick={handleOpenRegister}>등록</Button>
            )}
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }} elevation={0}>
        <Typography variant="h6" sx={{ mb: 1 }}>제출된 리포트</Typography>

        {loading ? (
          <CircularProgress />
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : submissions && submissions.length > 0 ? (
          <List>
            {submissions.map((s, idx) => (
              <React.Fragment key={s.id || s.report_id || idx}>
                <ListItem>
                  <ListItemText
                    primary={s.student_name || s.student_email || `제출자 ${idx + 1}`}
                    secondary={`리포트 ID: ${s.id || s.report_id || '-'}  | 상태: ${s.status || s.state || 'N/A'}`}
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary">제출된 리포트가 없습니다.</Typography>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dialogMode === 'view' ? '채점 기준 보기' : '채점 기준 등록/수정'}</DialogTitle>
        <DialogContent>
          <TextField
            label="채점 기준 (JSON)"
            value={criteriaText}
            onChange={(e) => setCriteriaText(e.target.value)}
            multiline
            minRows={8}
            fullWidth
            variant="outlined"
            InputProps={{ readOnly: dialogMode === 'view' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>닫기</Button>
          {dialogMode === 'edit' && (
            <Button variant="contained" onClick={handleSaveCriteria}>저장</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TAAssignmentDetail;
