// src/pages/ta/TACourseDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { getCourseDetail, getAssignmentsByCourse, getTaCourses } from '../../services/api.js';

// 과제 리스트 DUMMY
const DUMMY_ASSIGNMENTS = [
  {
    id: 'dummy-a1',
    assignment_name: '과제 1: 알고리즘 시대의 선택 자율성 분석',
    due_date: '2025-03-31T23:59:00',
    submission_count: 12,
    total_students: 20,
  },
  {
    id: 'dummy-a2',
    assignment_name: '과제 2: 비판적 사고 확장 에세이',
    due_date: '2025-04-15T23:59:00',
    submission_count: 5,
    total_students: 20,
  },
];

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

function TACourseDetail() {
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

  useEffect(() => {
    const fetchCourse = async () => {
      // If we already have course and it matches the current route param, skip fetching.
      if (course && String(course.id) === String(courseId)) return;
      try {
        const data = await getCourseDetail(courseId);
        setCourse(data.course || data);
      } catch (e) {
        console.error(e);
        setCourseError(e.message || '과목 정보를 불러오는 중 문제가 발생했습니다.');
      }
    };
    fetchCourse();
  }, [course, courseId]);

  // Update course state when navigation provides course in location.state
  useEffect(() => {
    const fromState = location.state?.course;
    if (fromState && String(fromState.id) === String(courseId)) {
      setCourse(fromState);
    }
  }, [location.state, courseId]);

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

  useEffect(() => {
    const fetchAssignments = async () => {
      setLoadingAssignments(true);
      try {
        const data = await getAssignmentsByCourse(courseId);
        const list = data?.assignments || [];
        if (list.length === 0) setAssignments(DUMMY_ASSIGNMENTS);
        else setAssignments(list);
      } catch (e) {
        console.error(e);
        setAssignmentError(e.message || '과제 목록을 불러오는 중 문제가 발생했습니다.');
        setAssignments(DUMMY_ASSIGNMENTS);
      } finally {
        setLoadingAssignments(false);
      }
    };
    fetchAssignments();
  }, [courseId]);

  const handleEditCourse = () => {
    console.log('과목 정보 수정 버튼 클릭');
  };

  const handleAssignmentClick = (assignment) => {
    if (!assignment.id) return;
    navigate(`/ta/course/${courseId}/assignment/${assignment.id}`, { state: { course, assignment } });
  };

  const courseTitle = course?.course_name || course?.course_code || `과목 ID: ${courseId}`;
  const courseCode = course?.course_code;
  const semester = course?.semester_label || course?.semester_text || course?.semester;

  const handleCourseSelect = (c) => {
    if (!c?.id) return;
    navigate(`/ta/course/${c.id}`, { state: { course: c } });
  };

  const SIDEBAR_WIDTH = { xs: '180px', sm: '220px', md: '260px' };
  const MAIN_LEFT_MARGIN = { xs: '150px', sm: '200px', md: '220px' };

  return (
    <Box sx={{ mt: 4, px: { xs: 1, md: 1 }, boxSizing: 'border-box' }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
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
                    onClick={() => handleCourseSelect(c)}
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
                            fontWeight: c.id === course?.id ? 700 : 400,
                            textDecoration: c.id === course?.id ? 'underline' : 'none',
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

        <Box sx={{ flex: 1, mx: 'auto', maxWidth: '1100px', ml: MAIN_LEFT_MARGIN }}>
          <HeaderPaper elevation={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{courseTitle}</Typography>
                {courseCode && <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 0.5 }}>과목 코드: {courseCode}</Typography>}
                {semester && <Typography variant="body2" color="text.secondary">학기: {semester}</Typography>}
                {courseError && <Typography variant="body2" color="error" sx={{ mt: 1 }}>{courseError}</Typography>}
              </Box>

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={handleEditCourse}>과목 정보 수정</Button>
              </Stack>
            </Stack>
          </HeaderPaper>

          <AssignmentListPaper elevation={2} sx={{ width: '100%', backgroundColor: '#fff', mt: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AssignmentIcon fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>과제 리스트</Typography>
              </Stack>
              <Chip label={`${assignments.length}개`} size="small" color="primary" variant="outlined" />
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {assignmentError && <Typography variant="body2" color="error" sx={{ mb: 1 }}>{assignmentError}</Typography>}

            {loadingAssignments ? (
              <Typography variant="body2">과제 목록을 불러오는 중입니다...</Typography>
            ) : assignments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">등록된 과제가 없습니다.</Typography>
            ) : (
              <List disablePadding>
                {assignments.map((a) => {
                  const dueText = formatKoreanDateTime(a.due_date);
                  // backend may return report_count per spec
                  const submitted = a.report_count ?? a.submission_count ?? a.submissions ?? 0;
                  const total = a.total_students ?? undefined;
                  const submissionLabel = total ? `${submitted}/${total}명 제출` : `${submitted}명 제출`;

                  return (
                    <AssignmentRow key={a.id} onClick={() => handleAssignmentClick(a)}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Box sx={{ flex: 1, pr: 2 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>{a.assignment_name || a.name || '제목 없는 과제'}</Typography>
                          {a.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {a.description}
                            </Typography>
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

          <Paper elevation={2} sx={{ borderRadius: 2, p: 3, minHeight: 280, backgroundColor: '#fff', mt: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>채점 관리</Typography>
            <Typography variant="body2" color="text.secondary">채점 관련 기능 배치 예정</Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

export default TACourseDetail;
