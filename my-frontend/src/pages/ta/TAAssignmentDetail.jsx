import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import {
  getAssignmentDetail,
  getAssignmentSubmissions,
  putAssignmentCriteria,
} from '../../services/api';
import { getTaCourses } from '../../services/api';

function TAAssignmentDetail() {
  const { courseId, assignmentId } = useParams();
  const location = useLocation();
  const courseFromState = location.state?.course || null;
  const assignmentFromState = location.state?.assignment || null;
  const navigate = useNavigate();

  const [taCourses, setTaCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState('');
  const SIDEBAR_WIDTH = { xs: '180px', sm: '220px', md: '260px' };
  const MAIN_LEFT_MARGIN = { xs: '150px', sm: '200px', md: '220px' };

  const HeaderPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    borderRadius: theme.spacing(2),
    backgroundColor: '#fff',
  }));

  const AssignmentListPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    borderRadius: theme.spacing(2),
    minHeight: 280,
    backgroundColor: '#fff',
  }));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [criteriaText, setCriteriaText] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAssignmentDetail(assignmentId);
        const a = data.assignment || data;
        setAssignment(a);

        const criteriaData = a.criteria || data.criteria || null;
        setCriteria(criteriaData);
        // 기준이 없으면 빈 문자열, 있으면 예쁘게 포매팅
        setCriteriaText(criteriaData ? JSON.stringify(criteriaData, null, 2) : '');

        const subs = a.submissions || data.submissions || null;
        if (subs) {
          setSubmissions(subs);
        } else {
          const subsRes = await getAssignmentSubmissions(assignmentId);
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

  useEffect(() => {
    const fetchTaCourseList = async () => {
      setLoadingCourses(true);
      try {
        const data = await getTaCourses();
        const list = data?.courses || [];
        setTaCourses(list);
      } catch (e) {
        console.error(e);
        setCoursesError(e.message || '내 과목 목록을 불러오는 중 문제가 발생했습니다.');
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchTaCourseList();
  }, []);

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

  // 🔹 “보기” 버튼: 항상 수정 가능한 다이얼로그 오픈
  const handleOpenCriteriaDialog = () => {
    // criteria가 없으면 그냥 빈 상태로 시작
    if (!criteria) {
      setCriteriaText('');
    }
    setDialogOpen(true);
  };

  const handleSaveCriteria = async () => {
    try {
      const parsed = criteriaText ? JSON.parse(criteriaText) : null;
      await putAssignmentCriteria(assignmentId, parsed);

      // 다시 상세 정보 받아와서 state 갱신
      const data = await getAssignmentDetail(assignmentId);
      const a = data.assignment || data;
      const criteriaData = a.criteria || data.criteria || parsed || null;

      setCriteria(criteriaData);
      setCriteriaText(criteriaData ? JSON.stringify(criteriaData, null, 2) : '');
      setDialogOpen(false);
    } catch (err) {
      alert('채점 기준 저장 중 오류: ' + (err.message || err));
    }
  };

  const courseName =
    courseFromState?.course_name ||
    courseFromState?.name ||
    courseFromState?.course_code ||
    assignmentFromState?.course_name ||
    assignment?.course_name ||
    '과목명 없음';

  return (
    <Box sx={{ mt: 4, px: { xs: 1, md: 1 }, boxSizing: 'border-box' }}>
      {/* Sidebar: TA courses */}
      <Box sx={{ width: SIDEBAR_WIDTH, position: 'fixed', left: 0, top: '64px', height: `calc(100vh - 64px)`, p: 2, boxSizing: 'border-box', zIndex: 1200 }}>
        <Paper sx={{ p: 2, borderRadius: 1.5, backgroundColor: '#fff', height: '100%', overflowY: 'auto' }} elevation={1}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, mb: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
            onClick={() => navigate('/ta')}
          >
            내 과목
          </Typography>
          {loadingCourses ? (
            <Typography variant="body2">불러오는 중...</Typography>
          ) : coursesError ? (
            <Typography variant="body2" color="error">{coursesError}</Typography>
          ) : taCourses.length === 0 ? (
            <Typography variant="body2" color="text.secondary">담당 과목이 없습니다.</Typography>
          ) : (
            <List disablePadding sx={{ overflowY: 'auto', maxHeight: 'calc(100% - 32px)' }}>
              {taCourses.map((c) => (
                <ListItemButton
                  key={c.id}
                  onClick={() => navigate(`/ta/course/${c.id}`, { state: { course: c } })}
                  sx={{
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    py: 1.1,
                    backgroundColor: 'transparent',
                    '&.Mui-selected': { backgroundColor: 'transparent' },
                    '&:hover': { backgroundColor: 'transparent' },
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography
                        variant="subtitle2"
                        noWrap
                        sx={{
                          fontWeight: String(c.id) === String(courseFromState?.id) || String(c.id) === String(assignment?.course_id) ? 700 : 400,
                          textDecoration: String(c.id) === String(courseFromState?.id) || String(c.id) === String(assignment?.course_id) ? 'underline' : 'none',
                          color: 'text.primary',
                        }}
                      >
                        {c.course_name || c.course_code || '무명'}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.semester_label || c.semester_text || c.semester}
                      </Typography>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>
      </Box>
      {/* 상단 과목 / 과제 정보 */}
      <HeaderPaper elevation={2} sx={{ mx: 'auto', maxWidth: '1100px', ml: MAIN_LEFT_MARGIN }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography
                variant="h5"
                sx={{ fontWeight: 400, mb: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'text.secondary' }}
                onClick={() => navigate(-1)}
              >
                <Box component="span" sx={{ fontWeight: 400, color: 'text.disabled', mr: 0.5 }}>{'<'}</Box>
                {courseName}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 0 }}>
            <Typography
              variant="h4"
              sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', md: '1.6rem' } }}
            >
              {assignment?.assignment_name ||
                assignment?.name ||
                assignment?.title ||
                '과제명 없음'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              제출기한:{' '}
              {assignment?.due_date ? formatDateString(assignment.due_date) : '미정'}
            </Typography>
            {assignment?.description && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 1, whiteSpace: 'pre-line' }}
              >
                {assignment.description}
              </Typography>
            )}
          </Box>
        </Box>
      </HeaderPaper>

      {/* 아래: 좌 3 / 우 1 (메인 캔버스 중앙 정렬) */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mx: 'auto', maxWidth: '1100px', ml: MAIN_LEFT_MARGIN }}>
        {/* 왼쪽: 제출된 리포트 (3) */}
        <Box sx={{ flex: 3 }}>
          <AssignmentListPaper elevation={1}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              제출된 리포트
            </Typography>

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
                        secondary={`리포트 ID: ${
                          s.id || s.report_id || '-'
                        }  | 상태: ${s.status || s.state || 'N/A'}`}
                        primaryTypographyProps={{
                          noWrap: true,
                          sx: {
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                        }}
                        secondaryTypographyProps={{
                          noWrap: true,
                          sx: {
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                        }}
                        sx={{ maxWidth: '100%' }}
                      />
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">
                제출된 리포트가 없습니다.
              </Typography>
            )}
          </AssignmentListPaper>
        </Box>

        {/* 오른쪽: 채점 기준 + 채점 관리 (1) */}
        <Box sx={{ flex: 1, minWidth: 260 }}>
          {/* 채점 기준 카드 */}
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }} elevation={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6">채점 기준</Typography>
                <Typography variant="body2" color="text.secondary">
                  저장된 채점 기준을 확인하고 수정할 수 있습니다.
                </Typography>
              </Box>
              <Box>
                {loading ? (
                  <CircularProgress size={24} />
                ) : (
                  <Button variant="outlined" onClick={handleOpenCriteriaDialog}>
                    보기
                  </Button>
                )}
              </Box>
            </Stack>
          </Paper>

          {/* 채점 관리 카드 */}
          <Paper sx={{ p: 2, borderRadius: 2 }} elevation={1}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              채점 관리
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              제출된 리포트에 대한 점수 입력 및 채점 현황을 관리하는 영역입니다.
              (추후 기능 연동 예정)
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                • 총 제출 수: {submissions?.length ?? 0}개
              </Typography>
              <Typography variant="body2">
                • 채점 기준 상태: {criteria ? '등록됨' : '미등록'}
              </Typography>
            </Stack>
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Button variant="outlined" size="small" disabled>
                채점 페이지 (준비중)
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* 채점 기준 JSON 다이얼로그 (항상 수정 가능) */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>채점 기준 보기/수정</DialogTitle>
        <DialogContent>
          <TextField
            label="채점 기준 (JSON)"
            value={criteriaText}
            onChange={(e) => setCriteriaText(e.target.value)}
            multiline
            minRows={8}
            fullWidth
            variant="outlined"
            placeholder='예: { "criteria_1": { "name": "논리성", "max_score": 10 } }'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>닫기</Button>
          <Button variant="contained" onClick={handleSaveCriteria}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TAAssignmentDetail;
