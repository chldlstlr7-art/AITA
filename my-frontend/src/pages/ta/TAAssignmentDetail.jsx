// src/pages/ta/TAAssignmentDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
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
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';

import {
  getAssignmentDetail,
  getAssignmentSubmissions,
  putAssignmentCriteria,
  updateAssignment,
  getAssignmentCriteria,
  deleteAssignment,
  getTaCourses,
} from '../../services/api';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const SIDEBAR_WIDTH = { xs: '180px', sm: '220px', md: '260px' };
const MAIN_LEFT_MARGIN = { xs: '150px', sm: '200px', md: '220px' };

// 상단 헤더 카드
const HeaderPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.spacing(2),
  backgroundColor: '#fff',
}));

// 제출된 리포트 리스트 카드
const AssignmentListPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  minHeight: 280,
  backgroundColor: '#fff',
}));

function TAAssignmentDetail() {
  const { courseId, assignmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const courseFromState = location.state?.course || null;
  const assignmentFromState = location.state?.assignment || null;

  // 사이드바의 TA 과목 목록
  const [taCourses, setTaCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  // 메인 과제/제출 데이터
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [criteria, setCriteria] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // 채점 기준 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false);
  const [criteriaText, setCriteriaText] = useState('');
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [criteriaLoading, setCriteriaLoading] = useState(false);

  // 과제 삭제
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 과제 정보 수정 다이얼로그
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState(''); // datetime-local value
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // ===== 공통 유틸 =====
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

  const isoToLocalInput = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    } catch (e) {
      return '';
    }
  };

  const submittedCount = submissions?.length ?? 0;
  const gradedCount = (submissions || []).filter((s) => {
    const status = String(s?.status || s?.state || '').toLowerCase();
    return (
      s &&
      (s.graded === true ||
        s.score != null ||
        status === 'graded' ||
        status === 'completed')
    );
  }).length;

  const courseName =
    courseFromState?.course_name ||
    courseFromState?.name ||
    courseFromState?.course_code ||
    assignmentFromState?.course_name ||
    assignment?.course_name ||
    '과목명 없음';

  // ===== 초기 데이터 로딩: 과제 상세 + 제출 목록 =====
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

    if (assignmentId) {
      fetchData();
    }
  }, [assignmentId]);

  // ===== TA 과목 목록 로딩 (사이드바) =====
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

  // ===== 채점 기준 보기/수정 다이얼로그 =====
  const handleOpenCriteriaDialog = () => {
    (async () => {
      if (!assignmentId) {
        alert('과제 정보가 없습니다.');
        return;
      }
      setCriteriaLoading(true);
      try {
        // 우선 신규 엔드포인트에서 기준을 조회
        let criteriaData = null;
        try {
          criteriaData = await getAssignmentCriteria(assignmentId);
        } catch (err) {
          // 폴백: assignment 상세에서 criteria를 찾아본다
          console.warn('GET /criteria 실패, 폴백 시도:', err);
          const data = await getAssignmentDetail(assignmentId);
          const a = data.assignment || data;
          criteriaData = a.criteria || data.criteria || null;
        }

        setCriteria(criteriaData);
        setCriteriaText(criteriaData ? JSON.stringify(criteriaData, null, 2) : '');

        if (criteriaData) {
          // 백엔드: { "A": { name: "논리성", max_score: 30 }, ... }
          // UI 매핑: '채점 항목' -> key (A), '채점 기준 설명' -> value.name, '배점' -> value.max_score
          if (Array.isArray(criteriaData)) {
            setCriteriaRows(
              criteriaData.map((v, i) => ({
                key: v.key || `criteria_${i + 1}`,
                name: v.key || v.name || `criteria_${i + 1}`,
                description: v.name || v.title || v.description || '',
                max_score: v.max_score ?? v.maxScore ?? v.score ?? 0,
              }))
            );
          } else if (typeof criteriaData === 'object') {
            setCriteriaRows(
              Object.entries(criteriaData).map(([k, v], i) => ({
                key: k,
                // '채점 항목' 표시에는 key(A/B/C)을 보여줍니다.
                name: k,
                // 실제 설명은 서버의 value.name 필드입니다.
                description: (v && (v.name || v.title)) || '',
                max_score: (v && (v.max_score ?? v.maxScore ?? v.score)) ?? 0,
              }))
            );
          } else {
            setCriteriaRows([]);
          }
        } else {
          setCriteriaRows([]);
        }
      } catch (e) {
        console.error('채점 기준 로드 실패:', e);
        alert('채점 기준을 불러오지 못했습니다.');
        setCriteriaText(criteria ? JSON.stringify(criteria, null, 2) : '');
      } finally {
        setCriteriaLoading(false);
        setDialogOpen(true);
      }
    })();
  };

  const handleAddRow = () => {
    setCriteriaRows((prev) => [
      ...prev,
      { name: '', description: '', max_score: 0 },
    ]);
  };

  const handleRemoveRow = (index) => {
    setCriteriaRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeRow = (index, field, value) => {
    setCriteriaRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveCriteria = async () => {
    try {
      if (!assignmentId) return;

      // 아무 항목도 없으면 기준 삭제
      if (!criteriaRows || criteriaRows.length === 0) {
        await putAssignmentCriteria(assignmentId, null);
        setCriteria(null);
        setCriteriaText('');
        setCriteriaRows([]);
        setDialogOpen(false);
        return;
      }

      const payload = {};
      criteriaRows.forEach((r, i) => {
        const key = r.key || `criteria_${i + 1}`;
        const maxScore = Number(r.max_score) || 0;
        // 서버 명세: value should contain 'name' (설명) and 'max_score'
        payload[key] = {
          name: r.description || '',
          max_score: maxScore,
        };
      });

      await putAssignmentCriteria(assignmentId, payload);

      // 최신 기준 다시 조회
      const criteriaData = await (async () => {
        try {
          return await getAssignmentCriteria(assignmentId);
        } catch (e) {
          const data = await getAssignmentDetail(assignmentId);
          const a = data.assignment || data;
          return a.criteria || data.criteria || payload || null;
        }
      })();

      setCriteria(criteriaData);
      setCriteriaText(
        criteriaData ? JSON.stringify(criteriaData, null, 2) : ''
      );

      if (criteriaData) {
        if (Array.isArray(criteriaData)) {
          setCriteriaRows(
            criteriaData.map((v, i) => ({
              key: v.key || `criteria_${i + 1}`,
              name: v.key || v.name || `criteria_${i + 1}`,
              description: v.name || v.title || v.description || '',
              max_score: v.max_score ?? v.maxScore ?? v.score ?? 0,
            }))
          );
        } else if (typeof criteriaData === 'object') {
          setCriteriaRows(
            Object.entries(criteriaData).map(([k, v], i) => ({
              key: k,
              name: k,
              description: v?.name || v?.title || '',
              max_score: v?.max_score ?? v?.maxScore ?? v?.score ?? 0,
            }))
          );
        }
      }

      setDialogOpen(false);
    } catch (err) {
      alert('채점 기준 저장 중 오류: ' + (err.message || err));
    }
  };

  // ===== 과제 정보 수정 다이얼로그 =====
  const handleOpenEditDialog = () => {
    (async () => {
      setEditError('');
      try {
        let a = assignment;

        // 현재 state에 과제 정보가 없으면 먼저 한번 가져오기
        if (!a || !a.id) {
          const data = await getAssignmentDetail(assignmentId);
          a = data.assignment || data;
          setAssignment(a);
        } else {
          // 그래도 최신 정보로 한 번 더 시도
          try {
            const data = await getAssignmentDetail(assignmentId);
            a = data.assignment || data;
            setAssignment(a);
          } catch (e) {
            // 실패해도 기존 assignment 사용
          }
        }

        setEditName(a?.assignment_name || a?.name || '');
        setEditDescription(a?.description || '');
        setEditDueDate(isoToLocalInput(a?.due_date));
        setEditDialogOpen(true);
      } catch (e) {
        console.error('과제 정보를 불러오지 못해 수정창을 열 수 없습니다.', e);
        setEditError(
          '과제 정보를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.'
        );
      }
    })();
  };

  const handleCloseEditDialog = () => {
    if (editSaving) return;
    setEditDialogOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!assignmentId) return;
    setEditSaving(true);
    setEditError('');
    try {
      const payload = {
        assignment_name: editName,
        description: editDescription,
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
      };

      await updateAssignment(assignmentId, payload);

      // 저장 후 최신 과제 상세 재조회
      const data = await getAssignmentDetail(assignmentId);
      const a = data.assignment || data;
      setAssignment(a);
      setEditDialogOpen(false);
    } catch (e) {
      console.error('과제 수정 실패:', e);
      setEditError(e.message || '과제 수정에 실패했습니다.');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 4, px: { xs: 1, md: 1 }, boxSizing: 'border-box' }}>
      {/* Sidebar: TA courses */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          position: 'fixed',
          left: 0,
          top: '64px',
          height: `calc(100vh - 64px)`,
          p: 2,
          boxSizing: 'border-box',
          zIndex: 1200,
        }}
      >
        <Paper
          sx={{
            p: 2,
            borderRadius: 1.5,
            backgroundColor: '#fff',
            height: '100%',
            overflowY: 'auto',
          }}
          elevation={1}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              mb: 1,
              cursor: 'pointer',
              '&:hover': { color: 'primary.main' },
            }}
            onClick={() => navigate('/ta')}
          >
            내 과목
          </Typography>
          {loadingCourses ? (
            <Typography variant="body2">불러오는 중...</Typography>
          ) : coursesError ? (
            <Typography variant="body2" color="error">
              {coursesError}
            </Typography>
          ) : taCourses.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              담당 과목이 없습니다.
            </Typography>
          ) : (
            <List
              disablePadding
              sx={{ overflowY: 'auto', maxHeight: 'calc(100% - 32px)' }}
            >
              {taCourses.map((c) => {
                const isCurrentCourse =
                  String(c.id) === String(courseFromState?.id) ||
                  String(c.id) === String(assignment?.course_id);
                return (
                  <ListItemButton
                    key={c.id}
                    onClick={() =>
                      navigate(`/ta/course/${c.id}`, { state: { course: c } })
                    }
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
                            fontWeight: isCurrentCourse ? 700 : 400,
                            textDecoration: isCurrentCourse
                              ? 'underline'
                              : 'none',
                            color: 'text.primary',
                          }}
                        >
                          {c.course_name || c.course_code || '무명'}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.semester_label ||
                            c.semester_text ||
                            c.semester}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Paper>
      </Box>

      {/* 상단 과목 / 과제 정보 */}
      <HeaderPaper
        elevation={2}
        sx={{ mx: 'auto', maxWidth: '1100px', ml: MAIN_LEFT_MARGIN }}
      >
        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 400,
                  mb: 1,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'text.secondary',
                }}
                onClick={() => navigate(-1)}
              >
                <Box
                  component="span"
                  sx={{ fontWeight: 400, color: 'text.disabled', mr: 0.5 }}
                >
                  {'<'}
                </Box>
                {courseName}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon sx={{ color: '#274472' }} />}
                onClick={handleOpenEditDialog}
                sx={{
                  color: '#274472',
                  borderColor: 'rgba(39,68,114,0.12)',
                }}
              >
                수정
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DeleteIcon sx={{ color: '#6b7280' }} />}
                onClick={() => setConfirmDeleteOpen(true)}
                sx={{
                  color: '#6b7280',
                  borderColor: 'rgba(107,114,128,0.12)',
                }}
              >
                삭제
              </Button>
            </Stack>
          </Box>

          <Box sx={{ mb: 0 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.5rem', md: '1.6rem' },
              }}
            >
              {assignment?.assignment_name ||
                assignment?.name ||
                assignment?.title ||
                '과제명 없음'}
            </Typography>
            <Typography variant="body1" sx={{ mt: 1, color: '#000' }}>
              제출기한:{' '}
              {assignment?.due_date
                ? formatDateString(assignment.due_date)
                : '미정'}
            </Typography>
            {assignment?.description && (
              <Typography
                variant="body2"
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

      {/* 아래: 좌 3 / 우 1 */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'flex-start',
          mx: 'auto',
          maxWidth: '1100px',
          ml: MAIN_LEFT_MARGIN,
        }}
      >
        {/* 왼쪽: 제출된 리포트 */}
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
                  <React.Fragment
                    key={s.id || s.report_id || idx}
                  >
                    <ListItem
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <ListItemText
                        primary={
                          s.student_name ||
                          s.student_email ||
                          `제출자 ${idx + 1}`
                        }
                        secondary={`리포트 ID: ${
                          s.id || s.report_id || '-'
                        }`}
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

                      <Box sx={{ ml: 2 }}>
                        {String(
                          s.status || s.state || ''
                        ).toLowerCase() === 'completed' ? (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() =>
                              navigate(
                                `/ta/course/${courseId}/assignment/${assignmentId}/report/${
                                  s.id || s.report_id
                                }/analysis`,
                                {
                                  state: {
                                    course: courseFromState,
                                    assignment: assignment || assignmentFromState,
                                    student: s,
                                  },
                                }
                              )
                            }
                          >
                            분석 결과
                          </Button>
                        ) : (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() =>
                              navigate(
                                `/ta/course/${courseId}/assignment/${assignmentId}/report/${
                                  s.id || s.report_id
                                }/aita`,
                                {
                                  state: {
                                    course: courseFromState,
                                    assignment: assignment || assignmentFromState,
                                    student: s,
                                  },
                                }
                              )
                            }
                          >
                            AITA분석
                          </Button>
                        )}
                      </Box>
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

        {/* 오른쪽: 채점 기준 + 채점 관리 */}
        <Box sx={{ flex: 1, minWidth: 260 }}>
          {/* 채점 기준 카드 */}
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }} elevation={1}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
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
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              제출된 리포트에 대한 점수 입력 및 채점 현황을 관리하는
              영역입니다.
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                • 총 제출 수: {submittedCount}개
              </Typography>
              <Typography variant="body2">
                • 채점 완료 수: {gradedCount}개
              </Typography>
            </Stack>
            <Box sx={{ mt: 2, textAlign: 'right' }}>
              <Button
                variant="contained"
                size="small"
                onClick={() =>
                  navigate(
                    `/ta/course/${courseId}/grading`,
                    { state: { course: courseFromState || { id: courseId } } }
                  )
                }
                sx={(theme) => ({
                  backgroundColor: theme.palette.primary.main,
                  color: '#fff',
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                })}
              >
                채점 페이지로 이동
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* 채점 기준 다이얼로그 */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>채점 기준 보기/수정</DialogTitle>
          <DialogContent>
            {criteriaLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  p: 4,
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
                {(!criteriaRows || criteriaRows.length === 0) && (
                  <Typography color="text.secondary">
                    채점 항목이 없습니다. 새 항목을 추가하세요.
                  </Typography>
                )}

                <Box sx={{ pt: 2 }}>
                  {criteriaRows.map((row, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'stretch',
                        mb: 1,
                      }}
                    >
                      <TextField
                        label="채점 항목"
                        value={row.name}
                        onChange={(e) =>
                          handleChangeRow(idx, 'name', e.target.value)
                        }
                        variant="outlined"
                        fullWidth
                        sx={{
                          flex: 1,
                          '& .MuiInputBase-root': { minHeight: 56 },
                        }}
                      />
                      <TextField
                        label="채점 기준 설명"
                        value={row.description}
                        onChange={(e) =>
                          handleChangeRow(idx, 'description', e.target.value)
                        }
                        variant="outlined"
                        multiline
                        fullWidth
                        sx={{
                          flex: 2,
                          '& .MuiInputBase-root': {
                            minHeight: 56,
                            alignItems: 'flex-start',
                            paddingTop: '10px',
                          },
                        }}
                      />
                      <TextField
                        label="배점"
                        value={row.max_score}
                        onChange={(e) =>
                          handleChangeRow(idx, 'max_score', e.target.value)
                        }
                        variant="outlined"
                        type="number"
                        sx={{
                          width: 110,
                          '& .MuiInputBase-root': {
                            minHeight: 56,
                            justifyContent: 'center',
                          },
                          '& input': { textAlign: 'center' },
                        }}
                      />
                      <IconButton
                        onClick={() => handleRemoveRow(idx)}
                        aria-label="삭제"
                        sx={{ alignSelf: 'center' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))}
                </Box>

                <Box>
                  <Button
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddRow}
                  >
                    항목 추가
                  </Button>
                </Box>
              </Stack>
            )}
          </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>닫기</Button>
          <Button variant="contained" onClick={handleSaveCriteria}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* 과제 정보 수정 다이얼로그 */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>과제 정보 수정</DialogTitle>
        <DialogContent>
          {editError && (
            <Typography color="error" sx={{ mb: 1 }}>
              {editError}
            </Typography>
          )}
          <TextField
            label="과제 이름"
            fullWidth
            margin="dense"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <TextField
            label="설명"
            fullWidth
            margin="dense"
            multiline
            minRows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <TextField
            label="마감일"
            type="datetime-local"
            fullWidth
            margin="dense"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} disabled={editSaving}>
            취소
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={editSaving}
          >
            {editSaving ? '저장중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 과제 삭제 확인 다이얼로그 */}
      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <DialogTitle>과제 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            정말 이 과제를 삭제하시겠습니까? 삭제하면 복구할 수 없습니다.
          </Typography>
          <Typography sx={{ mt: 1, fontWeight: 700 }}>
            {assignment?.assignment_name ||
              assignment?.name ||
              '과제명'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>취소</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              if (!assignmentId) return;
              setDeleting(true);
              try {
                await deleteAssignment(assignmentId);
                navigate(`/ta/course/${courseId}`);
              } catch (e) {
                console.error('과제 삭제 실패:', e);
                alert(
                  '과제 삭제에 실패했습니다: ' + (e?.message || e)
                );
              } finally {
                setDeleting(false);
                setConfirmDeleteOpen(false);
              }
            }}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TAAssignmentDetail;
