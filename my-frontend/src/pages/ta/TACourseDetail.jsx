// src/pages/ta/TACourseDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { getCourseDetail, getAssignmentsByCourse, getTaCourses, getAssignmentSubmissions, getTaGrade, updateCourse, createAssignment, getCourseStudents, addCourseStudent, deleteCourseStudent } from '../../services/api.js';

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

const AssignmentRow = styled(ListItemButton)(({ theme }) => ({
  borderRadius: theme.spacing(1.2),
  marginBottom: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  '&:hover': {
    backgroundColor: 'rgba(15,15,112,0.04)',
  },
}));

function formatKoreanDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TACourseDetail() {
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [course, setCourse] = useState(location.state?.course || null);
  const [taCourses, setTaCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [courseError, setCourseError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');

  // student management
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState('');
  const [totalStudents, setTotalStudents] = useState(undefined);
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addStudentNotFoundOpen, setAddStudentNotFoundOpen] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAssignmentName, setNewAssignmentName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDateLocal, setNewDueDateLocal] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchCourse = async () => {
      setCourseError('');
      if (course && String(course.id) === String(courseId)) return;
      try {
        const data = await getCourseDetail(courseId);
        setCourse(data.course || data);
      } catch (err) {
        console.error(err);
        setCourseError(err.message || '과목 정보를 불러오는 중 문제가 발생했습니다.');
      }
    };
    fetchCourse();
  }, [courseId]);

  // 수강생 목록을 다이얼로그가 열릴 때 불러옵니다.
  useEffect(() => {
    const fetchStudents = async () => {
      if (!studentDialogOpen) return;
      if (!course?.id) return;
      setLoadingStudents(true);
      try {
        const res = await getCourseStudents(course.id);
        const list = res?.students || [];
        setStudents(list);
        setStudentsError('');
      } catch (e) {
        console.error('수강생 목록 API 에러:', e);
        setStudentsError(e.message || '수강생 목록을 불러오지 못했습니다.');
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [studentDialogOpen, course?.id]);

  // 코스가 로드되면 전체 수강생 수를 미리 가져와서 과제 리스트에 사용합니다.
  useEffect(() => {
    const fetchTotalStudents = async () => {
      if (!course?.id) {
        setTotalStudents(undefined);
        return;
      }
      try {
        const res = await getCourseStudents(course.id);
        const list = res?.students || [];
        setTotalStudents(list.length);
      } catch (e) {
        console.error('전체 수강생 수 로드 실패:', e);
        setTotalStudents(undefined);
      }
    };
    fetchTotalStudents();
  }, [course?.id]);

  useEffect(() => {
    const fromState = location.state?.course;
    if (fromState && String(fromState.id) === String(courseId)) {
      setCourse(fromState);
      setCourseError('');
    }
  }, [location.state, courseId]);

  useEffect(() => {
    const fetchTaCourseList = async () => {
      setLoadingCourses(true);
      try {
        const data = await getTaCourses();
        setTaCourses(data?.courses || []);
      } catch (err) {
        console.error(err);
        setCoursesError(err.message || '내 과목 목록을 불러오는 중 문제가 발생했습니다.');
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchTaCourseList();
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchAssignments = async () => {
      setLoadingAssignments(true);
      try {
        const data = await getAssignmentsByCourse(courseId);
        const list = data?.assignments || [];
        if (!mounted) return;
        setAssignments(list);

        // Preload submissions + ta_grade flags for assignments that don't have submissions loaded
        try {
          const toLoad = (list || []).filter((a) => !Array.isArray(a.submissions) || a.submissions.length === 0).map((a) => a.id);
          if (toLoad.length > 0) {
            const results = await Promise.all(toLoad.map(async (aid) => {
              try {
                const resSub = await getAssignmentSubmissions(aid);
                const subs = resSub?.submissions || resSub || [];
                const checks = await Promise.allSettled((subs || []).map((s) => getTaGrade(s.id || s.report_id)));
                const subsWithTa = (subs || []).map((s, idx) => ({ ...s, ta_grade_exists: isTaGradeMeaningful(checks[idx] && checks[idx].status === 'fulfilled' ? checks[idx].value : null) }));
                return { assignmentId: aid, submissions: subsWithTa };
              } catch (e) {
                console.warn('Failed to preload submissions for assignment', aid, e);
                return null;
              }
            }));

            if (!mounted) return;
            setAssignments((prev) => prev.map((a) => {
              const found = results.find((r) => r && String(r.assignmentId) === String(a.id));
              return found ? { ...a, submissions: found.submissions } : a;
            }));
          }
        } catch (e) {
          console.error('Preload submissions failed', e);
        }
      } catch (err) {
        console.error(err);
        setAssignmentError(err.message || '과제 목록을 불러오는 중 문제가 발생했습니다.');
        setAssignments([]);
      } finally {
        if (mounted) setLoadingAssignments(false);
      }
    };
    fetchAssignments();
    return () => { mounted = false; };
  }, [courseId]);

  const handleEditCourse = () => {
    setEditCourseName(course?.course_name || '');
    setEditCourseCode(course?.course_code || '');
    setEditDialogOpen(true);
  };

  // 수강생 추가 핸들러
  const handleAddStudent = async () => {
    if (!course?.id) return;
    const email = (newStudentEmail || '').trim();
    if (!email) {
      setStudentsError('학생 이메일을 입력하세요.');
      return;
    }
    try {
      const res = await addCourseStudent(course.id, { email });

      // 일부 백엔드는 200을 반환하면서 body에 메시지를 담을 수 있으므로 검사
      const bodyStr = JSON.stringify(res || '');
      if (/존재하지|해당 계정|계정이 없습니다|not found/i.test(bodyStr)) {
        setAddStudentNotFoundOpen(true);
        return;
      }

      // 추가 성공 -> 리스트 갱신
      try {
        const listRes = await getCourseStudents(course.id);
        setStudents(listRes?.students || []);
        setStudentsError('');
      } catch (e) {
        console.error('수강생 갱신 실패:', e);
      }

      // 다이얼로그 닫고 입력 초기화
      setAddStudentDialogOpen(false);
      setNewStudentEmail('');
    } catch (e) {
      console.error('수강생 추가 실패:', e);
      // 응답 상태나 메시지 기반으로 '계정 없음' 판단
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || '';
      if (status === 404 || /존재하지|해당 계정|계정이 없습니다|not found/i.test(msg)) {
        setAddStudentNotFoundOpen(true);
      } else {
        setStudentsError(msg || '수강생 추가 중 오류가 발생했습니다.');
      }
    }
  };

  const handleEditCourseCancel = () => setEditDialogOpen(false);

  const handleEditCourseSubmit = async () => {
    if (!course?.id) return;
    try {
      await updateCourse(course.id, { course_name: editCourseName, course_code: editCourseCode });
      try {
        const data = await getCourseDetail(courseId);
        setCourse(data.course || data);
        setCourseError('');
      } catch (e) {
        console.error('과목 갱신 실패:', e);
      }
      setEditDialogOpen(false);
    } catch (err) {
      console.error('과목 수정 실패:', err);
      setCourseError(err.message || '과목 수정 중 오류가 발생했습니다.');
    }
  };

  const handleAssignmentClick = (assignment) => {
    if (!assignment?.id) return;
    navigate(`/ta/course/${courseId}/assignment/${assignment.id}`, { state: { course, assignment } });
  };

  const handleCourseSelect = (c) => {
    if (!c?.id) return;
    navigate(`/ta/course/${c.id}`, { state: { course: c } });
  };

  const handleCreateAssignment = async () => {
    if (!course?.id) return;
    setCreating(true);
    try {
      const dueIso = newDueDateLocal ? new Date(newDueDateLocal).toISOString() : null;
      await createAssignment(course.id, { assignment_name: newAssignmentName, description: newDescription, due_date: dueIso });
      try {
        const res = await getAssignmentsByCourse(courseId);
        setAssignments(res?.assignments || []);
      } catch (e) {
        console.error('과제 갱신 실패:', e);
      }
      setCreateDialogOpen(false);
      setNewAssignmentName('');
      setNewDescription('');
      setNewDueDateLocal('');
    } catch (err) {
      console.error('과제 생성 실패:', err);
      setAssignmentError(err.message || '과제 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const courseTitle = course?.course_name || course?.course_code || `과목 ID: ${courseId}`;
  const courseCode = course?.course_code;
  const semester = course?.semester_label || course?.semester_text || course?.semester;

  const SIDEBAR_WIDTH = { xs: '180px', sm: '220px', md: '260px' };

  // Helper: determine if TA-grade payload contains meaningful grading
  const isTaGradeMeaningful = (val) => {
    if (!val) return false;
    const feedback = (typeof val.feedback === 'string' ? val.feedback : '') || (val.score_details && typeof val.score_details.feedback === 'string' ? val.score_details.feedback : '');
    if (feedback && String(feedback).trim().length > 0) return true;
    const scores = val.score_details && Array.isArray(val.score_details.scores) ? val.score_details.scores : [];
    if (scores.length === 0) return false;
    for (let i = 0; i < scores.length; i++) {
      const sVal = scores[i];
      const sc = sVal && (sVal.score ?? sVal.value ?? sVal.points);
      if (sc != null && Number(sc) !== 0) return true;
    }
    return false;
  };

  return (
    <Box sx={{ mt: 4, px: { xs: 1, md: 1 }, boxSizing: 'border-box' }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Box sx={{ width: SIDEBAR_WIDTH, position: 'fixed', left: 0, top: '64px', height: `calc(100vh - 64px)`, p: 2, boxSizing: 'border-box', zIndex: 1200 }}>
          <Paper sx={{ p: 2, borderRadius: 1.5, backgroundColor: '#fff', height: '100%', overflowY: 'auto' }} elevation={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={() => navigate('/ta')}>내 과목</Typography>

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
                    onClick={() => handleCourseSelect(c)}
                    sx={{ justifyContent: 'flex-start', alignItems: 'flex-start', py: 1.1, backgroundColor: 'transparent', '&.Mui-selected': { backgroundColor: 'transparent' }, '&:hover': { backgroundColor: 'transparent' } }}
                  >
                    <ListItemText
                      primary={<Typography variant="subtitle2" noWrap sx={{ fontWeight: c.id === course?.id ? 700 : 400, textDecoration: c.id === course?.id ? 'underline' : 'none', color: 'text.primary' }}>{c.course_name || c.course_code || '무명'}</Typography>}
                      secondary={<Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.semester_label || c.semester_text || c.semester}</Typography>}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        </Box>

        <Box sx={{ ml: { xs: '150px', sm: '200px', md: '220px' }, width: '100%' }}>
          <HeaderPaper elevation={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{courseTitle}</Typography>
                {courseCode && <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 0.5 }}>과목 코드: {courseCode}</Typography>}
                {semester && <Typography variant="body2" color="text.secondary">학기: {semester}</Typography>}
                {courseError && !course && <Typography variant="body2" color="error" sx={{ mt: 1 }}>{courseError}</Typography>}
              </Box>

              <Stack direction="column" spacing={1} alignItems="flex-end">
                <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={handleEditCourse} sx={{ minWidth: 140 }}>과목 정보 수정</Button>
                <Button variant="outlined" size="small" startIcon={<PersonIcon />} onClick={() => setStudentDialogOpen(true)} sx={{ minWidth: 140 }}>수강생 관리</Button>
              </Stack>
            </Stack>
          </HeaderPaper>

          <Dialog open={editDialogOpen} onClose={handleEditCourseCancel} fullWidth maxWidth="sm">
            <DialogTitle>과목 정보 수정</DialogTitle>
            <DialogContent>
              <TextField label="과목 이름" fullWidth margin="dense" value={editCourseName} onChange={(e) => setEditCourseName(e.target.value)} />
              <TextField label="과목 코드" fullWidth margin="dense" value={editCourseCode} onChange={(e) => setEditCourseCode(e.target.value)} />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleEditCourseCancel}>취소</Button>
              <Button variant="contained" onClick={handleEditCourseSubmit}>저장</Button>
            </DialogActions>
          </Dialog>

          <AssignmentListPaper elevation={2} sx={{ width: '100%', backgroundColor: '#fff', mt: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AssignmentIcon fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>과제 리스트</Typography>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`${assignments.length}개`} size="small" color="primary" variant="outlined" />
                <Button variant="outlined" color="primary" size="small" onClick={() => setCreateDialogOpen(true)}>새 과제 생성</Button>
              </Stack>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {assignmentError && <Typography variant="body2" color="error" sx={{ mb: 1 }}>{assignmentError}</Typography>}

            {loadingAssignments ? (
              <Typography variant="body2">과제 목록을 불러오는 중입니다...</Typography>
            ) : assignments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">등록된 과제가 없습니다. '새 과제 생성' 버튼을 눌러 과제를 생성해주세요.</Typography>
            ) : (
              <List disablePadding>
                {assignments.map((a) => {
                  const dueText = formatKoreanDateTime(a.due_date);
                  const submitted = a.report_count ?? a.submission_count ?? (Array.isArray(a.submissions) ? a.submissions.length : 0);
                  const total = a.total_students ?? undefined;
                  const submissionLabel = total ? `${submitted}/${total}명 제출` : `${submitted}명 제출`;

                  return (
                    <AssignmentRow key={a.id} onClick={() => handleAssignmentClick(a)}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Box sx={{ flex: 1, pr: 2 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>{a.assignment_name || a.name || '제목 없는 과제'}</Typography>
                          {a.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.description}</Typography>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 180 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>마감: {dueText}</Typography>
                          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>{submissionLabel}</Typography>
                        </Box>

                        <Box sx={{ ml: 2 }}>
                          <ArrowForwardIosIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </Box>
                      </Box>
                    </AssignmentRow>
                  );
                })}
              </List>
            )}
          </AssignmentListPaper>

          {/* 수강생 관리 다이얼로그 */}
          <Dialog open={studentDialogOpen} onClose={() => { setStudentDialogOpen(false); setDeleteMode(false); }} fullWidth maxWidth="sm">
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">수강생 관리</Typography>
                <Box>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setAddStudentDialogOpen(true)}>수강생 추가</Button>
                  <Button size="small" color={deleteMode ? 'error' : 'inherit'} startIcon={<DeleteIcon />} onClick={() => setDeleteMode((s) => !s)}>{deleteMode ? '취소' : '삭제'}</Button>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {loadingStudents ? (
                <Typography variant="body2">불러오는 중...</Typography>
              ) : studentsError ? (
                <Typography variant="body2" color="error">{studentsError}</Typography>
              ) : students.length === 0 ? (
                <Typography variant="body2" color="text.secondary">수강생이 없습니다.</Typography>
              ) : (
                <List disablePadding>
                  {students.map((s) => (
                    <ListItemButton
                      key={s.id}
                      onClick={() => {
                        if (deleteMode) {
                          setPendingDelete(s);
                          setConfirmDeleteOpen(true);
                        }
                      }}
                    >
                      {deleteMode && (
                        <Box sx={{ width: 28, mr: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography color="error">-</Typography>
                        </Box>
                      )}
                      <ListItemText primary={s.name || s.email} secondary={s.email} />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setStudentDialogOpen(false); setDeleteMode(false); }}>닫기</Button>
            </DialogActions>
          </Dialog>

          {/* 수강생 추가 다이얼로그 */}
          <Dialog open={addStudentDialogOpen} onClose={() => setAddStudentDialogOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>수강생 추가</DialogTitle>
            <DialogContent>
              <TextField label="학생 이메일" fullWidth margin="dense" value={newStudentEmail} onChange={(e) => setNewStudentEmail(e.target.value)} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAddStudentDialogOpen(false)}>취소</Button>
              <Button variant="contained" onClick={handleAddStudent}>추가</Button>
            </DialogActions>
          </Dialog>

          {/* 계정 없음 오류 팝업 */}
          <Dialog open={addStudentNotFoundOpen} onClose={() => setAddStudentNotFoundOpen(false)}>
            <DialogTitle>오류</DialogTitle>
            <DialogContent>
              <Typography>해당 계정이 없습니다.</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAddStudentNotFoundOpen(false)} autoFocus>확인</Button>
            </DialogActions>
          </Dialog>

          {/* 삭제 확인 다이얼로그 */}
          <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
            <DialogTitle>학생 삭제 확인</DialogTitle>
            <DialogContent>
              <Typography>선택한 학생을 삭제하시겠습니까?</Typography>
              <Typography sx={{ mt: 1, fontWeight: 700 }}>{pendingDelete?.name || pendingDelete?.email}</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmDeleteOpen(false)}>취소</Button>
              <Button
                color="error"
                variant="contained"
                onClick={async () => {
                  if (!course?.id || !pendingDelete) return;
                  try {
                    await deleteCourseStudent(course.id, pendingDelete.id);
                    // refresh
                    try {
                      const res = await getCourseStudents(course.id);
                      setStudents(res?.students || []);
                    } catch (e) {
                      console.error('수강생 갱신 실패:', e);
                    }
                    setConfirmDeleteOpen(false);
                    setPendingDelete(null);
                  } catch (e) {
                    console.error('수강생 삭제 실패:', e);
                    setStudentsError(e.message || '수강생 삭제 중 오류가 발생했습니다.');
                  }
                }}
              >
                삭제
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>새 과제 생성</DialogTitle>
            <DialogContent>
              <TextField label="과제명" fullWidth margin="dense" value={newAssignmentName} onChange={(e) => setNewAssignmentName(e.target.value)} />
              <TextField label="설명" fullWidth margin="dense" multiline minRows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              <TextField label="제출 기한" type="datetime-local" fullWidth margin="dense" InputLabelProps={{ shrink: true }} value={newDueDateLocal} onChange={(e) => setNewDueDateLocal(e.target.value)} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateDialogOpen(false)}>취소</Button>
              <Button variant="contained" onClick={handleCreateAssignment} disabled={creating || !newAssignmentName}>생성</Button>
            </DialogActions>
          </Dialog>

          <Paper elevation={2} sx={{ borderRadius: 2, p: 3, minHeight: 280, backgroundColor: '#fff', mt: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>제출&채점 현황</Typography>

            {loadingAssignments ? (
              <Typography variant="body2">과제 목록을 불러오는 중입니다...</Typography>
            ) : assignments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">등록된 과제가 없습니다.</Typography>
            ) : (
              <List disablePadding>
                {assignments.map((a) => {
                  const submitted = a.report_count ?? a.submission_count ?? (Array.isArray(a.submissions) ? a.submissions.length : 0);
                  // 전체 학생수: API에서 내려오는 값 우선, 없으면 totalStudents state 사용
                  const total = totalStudents ?? a.total_students ?? undefined;

                  // try several possible fields for graded count; fallback to counting submissions with score/graded flag
                  let graded = a.graded_count ?? a.graded_reports ?? a.graded_submissions ?? 0;
                  // Count TA-saved grading records (ta_grade_exists) if submissions are present
                  const taGradedCount = Array.isArray(a.submissions) ? a.submissions.filter((s) => s && s.ta_grade_exists).length : 0;
                  if (!graded && Array.isArray(a.submissions)) {
                    graded = a.submissions.filter((s) => s && (s.graded === true || s.score != null || String(s.status || '').toLowerCase() === 'graded')).length;
                  }

                  const submittedOk = typeof total === 'number' ? submitted >= total : null;
                  // Use taGradedCount to show how many submissions have TA-saved grades; fall back to graded when submissions absent
                  const gradedDisplay = taGradedCount || graded || 0;
                  const gradedOk = typeof submitted === 'number' && submitted > 0 ? gradedDisplay >= submitted : null;

                  return (
                    <ListItemButton key={a.id} onClick={() => handleAssignmentClick(a)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                      <Box sx={{ flex: 1, pr: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>{a.assignment_name || a.name || '제목 없는 과제'}</Typography>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 160, justifyContent: 'flex-end' }}>
                        <Chip
                          label={total ? `제출 ${submitted}/${total}` : `제출 ${submitted}`}
                          size="medium"
                          clickable
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!a?.id) return;
                            navigate(`/ta/course/${courseId}/assignment/${a.id}`, { state: { course, assignment: a } });
                          }}
                          sx={(theme) => ({
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            px: 1.2,
                            py: 0.5,
                            ...(submittedOk === null
                              ? {}
                              : submittedOk
                              ? { backgroundColor: 'rgba(16,185,129,0.12)', color: theme.palette.success.dark }
                              : { backgroundColor: 'rgba(239,68,68,0.08)', color: theme.palette.error.dark }),
                          })}
                        />

                        <Chip
                          label={submitted ? `채점 ${gradedDisplay}/${submitted}` : `채점완료 ${gradedDisplay}`}
                          size="medium"
                          clickable
                          onClick={(e) => {
                            e.stopPropagation();
                            // 과목 단위 Grading으로 이동
                            navigate(`/ta/course/${courseId}/grading`, { state: { course } });
                          }}
                          sx={(theme) => ({
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            px: 1.2,
                            py: 0.5,
                            ...(gradedOk === null
                              ? (graded > 0 ? { backgroundColor: 'rgba(16,185,129,0.08)', color: theme.palette.success.dark } : {})
                              : gradedOk
                              ? { backgroundColor: 'rgba(16,185,129,0.12)', color: theme.palette.success.dark }
                              : { backgroundColor: 'rgba(239,68,68,0.08)', color: theme.palette.error.dark }),
                          })}
                        />
                      </Stack>
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
