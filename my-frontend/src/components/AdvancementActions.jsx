import React, { useState } from 'react';
import { Box, Typography, Stack, Divider, Fade, Paper, Button, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, FormControl, InputLabel, CircularProgress } from '@mui/material';
import {
  AddCircleOutline as NewReportIcon,
  Dashboard as DashboardIcon,
  Send as SubmitIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// [수정] api.js에서 함수 임포트
import { 
  getStudentDashboard, 
  getStudentCourseAssignments,
  submitReportToAssignment 
} from '../services/api'; // (경로가 맞는지 확인하세요)

// ==================== Styled Components ====================
// (스타일 코드는 동일)
const ActionsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(3),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
}));

const ActionButton = styled(Button)(({ theme, variant: buttonVariant }) => {
  const isPrimary = buttonVariant === 'primary';
  const isSecondary = buttonVariant === 'secondary';
  
  return {
    padding: theme.spacing(2, 4),
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: theme.spacing(2),
    textTransform: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: 56,
    
    ...(isPrimary && {
      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
      color: 'white',
      boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
      
      '&:hover': {
        background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 28px ${alpha(theme.palette.primary.main, 0.5)}`,
      },
    }),
    
    ...(isSecondary && {
      background: alpha(theme.palette.primary.main, 0.08),
      color: theme.palette.primary.main,
      border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
      
      '&:hover': {
        background: alpha(theme.palette.primary.main, 0.15),
        borderColor: alpha(theme.palette.primary.main, 0.3),
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
      },
    }),
    
    ...(!isPrimary && !isSecondary && {
      background: 'white',
      color: theme.palette.text.primary,
      border: `2px solid ${theme.palette.divider}`,
      
      '&:hover': {
        background: alpha(theme.palette.primary.main, 0.05),
        borderColor: theme.palette.primary.main,
        transform: 'translateY(-3px)',
        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
      },
    }),
  };
});
// =========================================================

function AdvancementActions({ onNewReport, onViewDashboard, onSubmit, studentId, reportId }) {
  // 과제 제출 Dialog 상태
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  
  // --- 👇 [수정] 이 줄이 누락되었습니다 ---
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  // --- 👆 [수정] ---
  
  const [submitting, setSubmitting] = useState(false);

  // Dialog 닫기 함수 추가
  const handleClose = () => {
    setOpen(false);
  };

  // Dialog 열기 시 학생 대시보드에서 과목 조회
  const handleOpen = async () => {
    setOpen(true);
    setSelectedCourse('');
    setSelectedAssignment('');
    setAssignments([]);
    setCourses([]);
    setLoadingCourses(true);

    try {
      const data = await getStudentDashboard(studentId);
      
      // --- 👇 [수정] ---
      // API 응답 로그에 'courses' 키로 데이터가 왔으므로 'courses'를 사용합니다.
      const courseData = data.courses?.map(c => ({
        course_id: c.course_id,
        course_name: `${c.course_code} - ${c.course_name}` 
      })) || [];
      // --- 👆 [수정] ---
      
      setCourses(courseData);
      
    } catch (e) {
      console.error("대시보드 로딩 실패:", e);
      setCourses([]);
      alert(e.message || '과목 정보를 불러오는데 실패했습니다.');
    }
    setLoadingCourses(false);
  };

  // 과목 선택 시 해당 과목의 과제 목록 API 호출
  const handleCourseChange = async (e) => {
    const courseId = e.target.value;
    setSelectedCourse(courseId);
    setSelectedAssignment('');
    
    if (!courseId) {
      setAssignments([]);
      return;
    }

    try {
      setLoadingAssignments(true);
      const assignmentData = await getStudentCourseAssignments(courseId);
      setAssignments(assignmentData || []);
    } catch (e) {
      console.error("과제 목록 로딩 실패:", e);
      alert(e.message || '과제 목록을 불러오는데 실패했습니다.');
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  // 과제 선택
  const handleAssignmentChange = (e) => {
    setSelectedAssignment(e.target.value);
  };

  // 제출 요청
  const handleSubmit = async () => {
    if (!selectedAssignment) return;
    setSubmitting(true);
    try {
      // [수정] api.js의 submitReportToAssignment 함수 사용
      const json = await submitReportToAssignment(reportId, selectedAssignment);
      
      handleClose();
      // 부모(AdvancementPage)의 onSubmit (스낵바 표시/이동) 호출
      if (onSubmit) { 
        onSubmit(json);
      }
      
    } catch (e) {
      alert(e.message || '서버 오류로 제출에 실패했습니다.');
    }
    setSubmitting(false);
  };

  return (
    <Fade in timeout={1000}>
      <ActionsContainer elevation={0}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            ✨ 마무리
          </Typography>
          <Typography variant="body2" color="text.secondary">
            발전 아이디어를 확인했다면 다음 단계를 진행하세요
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          spacing={2}
          sx={{ width: '100%' }}
        >
          {/* (버튼 1: 새로운 보고서) */}
          <ActionButton
            variant="secondary"
            fullWidth
            startIcon={<NewReportIcon />}
            onClick={onNewReport}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                새로운 보고서 분석하기
              </Typography>
              <Typography variant="caption" color="text.secondary">
                다른 과제의 보고서를 분석합니다
              </Typography>
            </Box>
          </ActionButton>

          {/* (버튼 2: 대시보드) */}
          <ActionButton
            fullWidth
            startIcon={<DashboardIcon />}
            onClick={onViewDashboard}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                학생 대시보드 보기
              </Typography>
              <Typography variant="caption" color="text.secondary">
                제출 현황과 피드백을 확인합니다
              </Typography>
            </Box>
          </ActionButton>

          {/* (버튼 3: 과제 제출) */}
          <ActionButton
            variant="primary"
            fullWidth
            startIcon={<SubmitIcon />}
            onClick={handleOpen}
            disabled={submitting}
          >
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                해당 과제 제출하기
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                최종 보고서를 제출합니다
              </Typography>
            </Box>
          </ActionButton>
        </Stack>

        {/* 제출 Dialog */}
        <Dialog 
          open={open} 
          onClose={handleClose} 
          maxWidth="xs" 
          fullWidth
          // --- 👇 [수정] 접근성 경고(aria-hidden) 해결 ---
          PaperProps={{
            tabIndex: -1,
          }}
          // --- 👆 [수정] ---
        >
          <DialogTitle>과제 제출</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>수강 중인 과목</InputLabel>
                <Select
                  value={selectedCourse}
                  label="수강 중인 과목"
                  onChange={handleCourseChange}
                  disabled={loadingCourses}
                >
                  {loadingCourses && <MenuItem value=""><CircularProgress size={20} /></MenuItem>}
                  {courses.length > 0 ? (
                    courses.map(course => (
                      <MenuItem key={course.course_id} value={course.course_id}>
                        {course.course_name}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>수강 중인 과목이 없습니다</MenuItem>
                  )}
                </Select>
              </FormControl>
              
              <FormControl fullWidth disabled={!selectedCourse || loadingAssignments}>
                <InputLabel>과제 선택</InputLabel>
                <Select
                  value={selectedAssignment}
                  label="과제 선택"
                  onChange={handleAssignmentChange}
                >
                  {loadingAssignments && <MenuItem value=""><CircularProgress size={20} /></MenuItem>}
                  {assignments.length > 0 ? (
                    assignments.map(assn => (
                      <MenuItem key={assn.id} value={assn.id}>
                        {assn.assignment_name}
                      </MenuItem>
                    ))
                  ) : (
                     <MenuItem disabled>
                      {selectedCourse ? "선택 가능한 과제가 없습니다" : "과목을 먼저 선택하세요"}
                     </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>취소</Button>
            <Button 
              variant="contained" 
              onClick={handleSubmit} 
              disabled={!selectedAssignment || submitting}
            >
              {submitting ? <CircularProgress size={20} /> : '제출'}
            </Button>
          </DialogActions>
        </Dialog>
      </ActionsContainer>
    </Fade>
  );
}

export default AdvancementActions;