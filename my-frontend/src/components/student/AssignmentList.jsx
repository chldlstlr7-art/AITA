import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  Chip,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Assignment as AssignmentIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// ==================== Styled Components ====================

const WhiteContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'white',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(3),
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  minHeight: 'calc(100vh - 120px)',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.3rem',
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(0.5),
}));

// [수정 1] 스타일(CSS) 수정: mb(marginBttom)을 여기서 제거합니다.
const AssignmentListItem = styled(ListItemButton)(({ theme, selected }) => ({
  borderRadius: theme.spacing(1.5),
  // marginBottom: theme.spacing(1.5), // <-- 이 줄 삭제
  padding: theme.spacing(2),
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : 'white',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    borderColor: theme.palette.primary.main,
    transform: 'translateX(4px)',
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(8, 2),
  color: theme.palette.text.secondary,
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  fontWeight: 600,
  borderRadius: theme.spacing(1),
}));

// ==================== Main Component ====================

function AssignmentList({ course, submissions, selectedAssignment, onAssignmentSelect }) {
  // ... (콘솔 로그는 그대로 두셔도 됩니다) ...

  if (!course) {
    return (
      <WhiteContainer>
        <EmptyState>
          <Typography variant="h6" color="error">
            과목 정보를 불러올 수 없습니다
          </Typography>
        </EmptyState>
      </WhiteContainer>
    );
  }

  const assignments = course.assignments || [];
  
  // 🔥 과제별 제출 여부 체크 (수정된 매칭 로직)
  const getSubmissionStatus = (assignment) => {
    // 과제의 ID (assignment_id 또는 id 사용)
    const assignmentId = assignment.assignment_id || assignment.id;
    
    // 🔥 제출 내역에서 assignment_id로 매칭
    const submission = submissions?.find((sub) => {
      
      // [수정 2] 논리(JS) 수정: ID 타입을 문자열로 통일하여 비교합니다.
      const match = String(sub.assignment_id) === String(assignmentId);
      
      // (디버깅용 콘솔)
      if (match) {
        console.log(`[AssignmentList] ✅ 매칭 성공!`, {
          subId: sub.assignment_id,
          assignId: assignmentId
        });
      }
      
      return match;
    });
    
    const status = {
      submitted: !!submission,
      submission: submission || null,
    };
    
    return status;
  };

  return (
    <WhiteContainer>
      {/* 헤더 */}
      <Box sx={{ mb: 3 }}>
        <SectionTitle>
          {course.course_name}
        </SectionTitle>
        <Typography variant="body2" color="text.secondary">
          총 {assignments.length}개의 과제
        </Typography>
      </Box>

      {/* 과제 목록 */}
      {assignments.length === 0 ? (
        <EmptyState>
          <AssignmentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            등록된 과제가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            과제가 등록되면 여기에 표시됩니다
          </Typography>
        </EmptyState>
      ) : (
        <List disablePadding>
          {assignments.map((assignment, index) => {
            const assignmentId = assignment.assignment_id || assignment.id;
            const { submitted, submission } = getSubmissionStatus(assignment);
            const selectedId = selectedAssignment?.assignment_id || selectedAssignment?.id;
            const isSelected = assignmentId === selectedId;

            return (
              <ListItem 
                key={assignmentId || `assignment-${index}`} 
                disablePadding
                // [수정 1] 스타일(CSS) 수정: 여백(mb)을 <ListItem> (<li>)에 적용합니다.
                sx={{ mb: 1.5 }} 
              >
                <AssignmentListItem
                  selected={isSelected}
                  onClick={() => {
                    console.log('[AssignmentList] 🖱️ 과제 클릭:', assignment);
                    onAssignmentSelect(assignment);
                  }}
                >
                  {/* 과제 정보 */}
                  <Box sx={{ flex: 1, minWidth: 0, mr: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ fontWeight: 600, color: 'text.primary' }}
                        noWrap
                      >
                        {assignment.assignment_name || '제목 없음'}
                      </Typography>
                      <StatusChip
                        label={submitted ? '제출 완료' : '미제출'}
                        color={submitted ? 'success' : 'default'}
                        size="small"
                        icon={submitted ? <CheckCircleIcon /> : <CancelIcon />}
                      />
                    </Stack>

                    <Typography variant="caption" color="text.secondary">
                      마감일: {assignment.due_date 
                        ? new Date(assignment.due_date).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : '없음'}
                    </Typography>

                    {submitted && submission && (
                      <Typography 
                        variant="caption" 
                        color="success.main" 
                        sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}
                      >
                        ✓ {new Date(submission.created_at).toLocaleDateString('ko-KR')} 제출
                      </Typography>
                    )}
                  </Box>

                  {/* 선택 표시 */}
                  {isSelected && (
                    <ChevronRightIcon color="primary" sx={{ fontSize: 28 }} />
                  )}
                </AssignmentListItem>
              </ListItem>
            );
          })}
        </List>
      )}
    </WhiteContainer>
  );
}

export default AssignmentList;