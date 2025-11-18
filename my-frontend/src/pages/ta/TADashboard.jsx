// src/pages/ta/TADashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import {
  getTaCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../../services/api.js';
import { getAssignmentsByCourse } from '../../services/api.js';

// 🧪 백엔드에 아직 과목이 없을 때 사용할 DUMMY 데이터
const DUMMY_COURSES = [
  {
    id: 'dummy-1',
    course_code: 'DUMMY-001',
    course_name: 'dummy',
    semester_label: '2026-1학기',
    isDummy: true,
  },
];

// 상단 컬러 영역
const CardTopBar = styled('div')(({ theme }) => ({
  height: 64,
  backgroundColor: theme.palette.primary.main,
}));

// 과목 카드 (고정 높이/폭)
const CourseCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.25s ease',
  height: 180, // ❗ 고정 높이
  width: 220,
  display: 'flex',
  flexDirection: 'column',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.18)',
  },
}));

function TADashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuCourseId, setMenuCourseId] = useState(null);
  const [navLoading, setNavLoading] = useState(false);

  // 과목 추가 다이얼로그 상태
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');

  // 과목 수정 다이얼로그 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editingCourse, setEditingCourse] = useState(null);

  // 과목 삭제 확인 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState(null);

  // 과목 목록 조회 (재사용 가능하도록 분리)
  const fetchCourses = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getTaCourses();
      const list = data?.courses || [];

      if (list.length === 0) {
        setCourses(DUMMY_COURSES);
      } else {
        setCourses(list);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || '과목 목록을 불러오는 중 문제가 발생했습니다.');
      setCourses(DUMMY_COURSES); // 에러여도 예시 카드 1개는 보여줌
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCardClick = (course) => {
    if (!course.id || course.isDummy) return;
    navigate(`/ta/course/${course.id}`, { state: { course } });
  };

  const handleMenuOpen = (event, courseId) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setMenuCourseId(courseId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuCourseId(null);
  };

  // =========================
  // 1) 과목 추가 다이얼로그
  // =========================
  const handleAddCourseClick = () => {
    setNewCourseName('');
    setNewCourseCode('');
    setAddDialogOpen(true);
  };

  const handleAddCourseCancel = () => {
    setAddDialogOpen(false);
  };

  const handleAddCourseSubmit = async () => {
    if (!newCourseName.trim() || !newCourseCode.trim()) {
      setErrorMsg('과목 이름과 과목 코드를 모두 입력해주세요.');
      return;
    }

    try {
      setErrorMsg('');
      await createCourse({
        course_code: newCourseCode.trim(),
        course_name: newCourseName.trim(),
      });

      // 성공 시 목록 갱신
      await fetchCourses();
      setAddDialogOpen(false);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || '과목 생성 중 오류가 발생했습니다.');
    }
  };

  // =========================
  // 2) 과목 이름/코드 수정 다이얼로그
  // =========================
  const handleEditCourseMenuClick = () => {
    if (!menuCourseId) return;
    const course = courses.find((c) => c.id === menuCourseId);
    if (!course || course.isDummy) {
      handleMenuClose();
      return;
    }
    setEditingCourse(course);
    setEditCourseName(course.course_name || '');
    setEditCourseCode(course.course_code || '');
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleEditCourseCancel = () => {
    setEditDialogOpen(false);
    setEditingCourse(null);
  };

  const handleEditCourseSubmit = async () => {
    if (!editingCourse) return;
    if (!editCourseName.trim() || !editCourseCode.trim()) {
      setErrorMsg('과목 이름과 과목 코드를 모두 입력해주세요.');
      return;
    }

    try {
      setErrorMsg('');
      await updateCourse(editingCourse.id, {
        course_name: editCourseName.trim(),
        course_code: editCourseCode.trim(),
      });

      await fetchCourses();
      setEditDialogOpen(false);
      setEditingCourse(null);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || '과목 수정 중 오류가 발생했습니다.');
    }
  };

  // =========================
  // 3) 과목 삭제 확인 다이얼로그
  // =========================
  const handleDeleteCourseMenuClick = () => {
    if (!menuCourseId) return;
    const course = courses.find((c) => c.id === menuCourseId);
    if (!course || course.isDummy) {
      handleMenuClose();
      return;
    }
    setDeletingCourse(course);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteCourseCancel = () => {
    setDeleteDialogOpen(false);
    setDeletingCourse(null);
  };

  const handleDeleteCourseConfirm = async () => {
    if (!deletingCourse) return;

    try {
      setErrorMsg('');
      await deleteCourse(deletingCourse.id);

      await fetchCourses();
      setDeleteDialogOpen(false);
      setDeletingCourse(null);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || '과목 삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      {/* 헤더 영역 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            대시보드
          </Typography>

          <Button
            variant="outlined"
            color="primary"
            onClick={async () => {
              if (!courses || courses.length === 0) {
                alert('담당 과목이 없습니다.');
                return;
              }
              const first = courses[0];
              if (!first || first.isDummy) {
                alert('유효한 과목이 없습니다.');
                return;
              }
              try {
                setNavLoading(true);
                // 과목 단위 Grading으로 바로 이동
                navigate(`/ta/course/${first.id}/grading`, { state: { course: first } });
              } catch (e) {
                console.error('이동 실패:', e);
                navigate(`/ta/course/${first.id}`, { state: { course: first } });
              } finally {
                setNavLoading(false);
              }
            }}
            disabled={navLoading}
            sx={{
              height: 36,
              backgroundColor: '#ffffff',
              color: 'primary.main',
              border: '1px solid',
              borderColor: 'primary.main',
              '&:hover': {
                backgroundColor: '#f7fbff',
                // keep border and text color on hover
                borderColor: 'primary.main',
              },
            }}
          >
            {navLoading ? '이동 중...' : '채점 종합 관리 바로가기'}
          </Button>
        </Box>

        {/* 우측 상단 작은 과목 추가 버튼 */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddCourseClick}
          sx={{
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          과목 추가
        </Button>
      </Box>

      {/* 에러 메시지 (있으면) */}
      {errorMsg && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Typography>
      )}

      {/* 카드 그리드 */}
      <Grid container spacing={3}>
        {loading ? (
          <Typography sx={{ ml: 1, mt: 2 }}>과목 목록을 불러오는 중입니다...</Typography>
        ) : (
          <>
            {courses.map((course) => {
              const isDummy = course.isDummy;
              const title = course.course_name || '과목 이름 미정';
              const courseCode = `[${course.course_code}]`;
              const studentCount = course.student_count || 0;

              return (
                <Grid item xs={12} sm={6} md={3} key={course.id || title}>
                  <CourseCard onClick={() => handleCardClick(course)}>
                    <CardTopBar />
                    <CardContent
                      sx={{
                        position: 'relative',
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      {!isDummy && (
                        <IconButton
                          size="small"
                          sx={{ position: 'absolute', top: 8, right: 8 }}
                          onClick={(e) => handleMenuOpen(e, course.id)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}

                      <Stack spacing={0.5}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {title}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {courseCode}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 0.5 }}
                        >
                          학생: {studentCount}명
                        </Typography>
                      </Stack>
                    </CardContent>
                  </CourseCard>
                </Grid>
              );
            })}
          </>
        )}
      </Grid>

      {/* 하단의 별도 빠른 이동 버튼은 헤더에 옮겨져서 제거됨 */}

      {/* 과목 카드 메뉴 (이름 수정, 삭제 등) */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditCourseMenuClick}>과목 이름 수정</MenuItem>
        <MenuItem onClick={handleDeleteCourseMenuClick}>과목 삭제</MenuItem>
      </Menu>

      {/* 1) 과목 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onClose={handleAddCourseCancel} fullWidth maxWidth="xs">
        <DialogTitle>새 과목 추가</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="과목 이름"
            fullWidth
            margin="dense"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
          />
          <TextField
            label="과목 코드"
            fullWidth
            margin="dense"
            value={newCourseCode}
            onChange={(e) => setNewCourseCode(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddCourseCancel}>취소</Button>
          <Button variant="contained" onClick={handleAddCourseSubmit}>
            추가
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2) 과목 이름/코드 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onClose={handleEditCourseCancel} fullWidth maxWidth="xs">
        <DialogTitle>과목 정보 수정</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            label="과목 이름"
            fullWidth
            margin="dense"
            value={editCourseName}
            onChange={(e) => setEditCourseName(e.target.value)}
          />
          <TextField
            label="과목 코드"
            fullWidth
            margin="dense"
            value={editCourseCode}
            onChange={(e) => setEditCourseCode(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditCourseCancel}>취소</Button>
          <Button variant="contained" onClick={handleEditCourseSubmit}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* 3) 과목 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCourseCancel} fullWidth maxWidth="xs">
        <DialogTitle>과목 삭제</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2">
            정말{' '}
            <strong>
              {deletingCourse?.course_name} [{deletingCourse?.course_code}]
            </strong>{' '}
            과목을 삭제하시겠습니까?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCourseCancel}>취소</Button>
          <Button color="error" variant="contained" onClick={handleDeleteCourseConfirm}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TADashboard;
