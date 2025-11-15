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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import { getTaCourses } from '../../services/api.js';

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

  useEffect(() => {
    const fetchCourses = async () => {
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

    fetchCourses();
  }, []);

  const handleCardClick = (course) => {
    if (!course.id) return;
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

  const handleAddCourseClick = () => {
    // TODO: 나중에 과목 생성 다이얼로그로 연결
    console.log('과목 추가 버튼 클릭');
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
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          대시보드
        </Typography>

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

      {/* 과목 카드 메뉴 (이름 수정, 삭제 등) */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>과목 이름 수정</MenuItem>
        <MenuItem onClick={handleMenuClose}>과목 삭제</MenuItem>
      </Menu>
    </Box>
  );
}

export default TADashboard;
