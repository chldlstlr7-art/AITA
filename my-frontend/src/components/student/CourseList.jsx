import React from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import {
  School as SchoolIcon,
  Description as DescriptionIcon,
  ChevronRight as ChevronRightIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// ==================== Styled Components ====================

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.1rem',
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const CourseListItem = styled(ListItemButton)(({ theme, selected }) => ({
  borderRadius: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  padding: theme.spacing(1.5),
  border: `1px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
  backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
  transition: 'all 0.2s',
  
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    borderColor: theme.palette.primary.main,
  },
}));

const UnsubmittedButton = styled(Button)(({ theme }) => ({
  width: '100%',
  marginTop: theme.spacing(2),
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1.5),
  textTransform: 'none',
  fontWeight: 600,
  border: `2px dashed ${theme.palette.primary.main}`,
  color: theme.palette.primary.main,
  
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    borderColor: theme.palette.primary.dark,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4, 2),
  color: theme.palette.text.secondary,
}));

// ==================== Main Component ====================

function CourseList({ courses, selectedCourse, onCourseSelect, onUnsubmittedClick }) {
  // 🔥 course_code 순서대로 정렬
  const sortedCourses = React.useMemo(() => {
    if (!courses || courses.length === 0) return [];
    
    return [...courses].sort((a, b) => {
      const codeA = String(a.course_code || '');
      const codeB = String(b.course_code || '');
      
      // 숫자로 변환 가능하면 숫자로 비교
      const numA = parseInt(codeA);
      const numB = parseInt(codeB);
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      
      // 문자열로 비교
      return codeA.localeCompare(codeB);
    });
  }, [courses]);

  return (
    <Box>
      <SectionTitle>
        <SchoolIcon color="primary" />
        수강 중인 과목
      </SectionTitle>

      {!sortedCourses || sortedCourses.length === 0 ? (
        <EmptyState>
          <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            수강 중인 과목이 없습니다
          </Typography>
        </EmptyState>
      ) : (
        <List disablePadding>
          {sortedCourses.map((course) => {
            const assignmentCount = course.assignments?.length || 0;
            
            return (
              <CourseListItem
                key={course.course_id || course.id}
                selected={selectedCourse?.course_id === course.course_id}
                onClick={() => onCourseSelect(course)}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* 🔥 과목명만 표시 (코드 제거) */}
                      <Typography 
                        variant="subtitle2" 
                        sx={{ fontWeight: 600 }} 
                        noWrap
                      >
                        {course.course_name}
                      </Typography>
                      {assignmentCount > 0 && (
                        <Chip
                          label={`${assignmentCount}`}
                          size="small"
                          color="primary"
                          sx={{ height: 20, fontSize: '0.7rem', ml: 'auto' }}
                        />
                      )}
                    </Box>
                  }
                  // 🔥 secondary 제거 (중복 방지)
                />
                {selectedCourse?.course_id === course.course_id && (
                  <ChevronRightIcon color="primary" />
                )}
              </CourseListItem>
            );
          })}
        </List>
      )}

      <Divider sx={{ my: 2 }} />

      <UnsubmittedButton
        startIcon={<DescriptionIcon />}
        onClick={onUnsubmittedClick}
      >
        제출하지 않은 리포트 보기
      </UnsubmittedButton>
    </Box>
  );
}

export default CourseList;