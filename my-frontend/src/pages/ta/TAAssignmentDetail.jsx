import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

function TAAssignmentDetail() {
  const { courseId, assignmentId } = useParams();

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
        과제 상세 화면
      </Typography>
      <Typography variant="body1">
        과목 ID: {courseId}
      </Typography>
      <Typography variant="body1" sx={{ mb: 1 }}>
        과제 ID: {assignmentId}
      </Typography>
      <Typography variant="body2">
        이 페이지에서 해당 과제의 분석 기능을 제공할 예정입니다.
      </Typography>
    </Box>
  );
}

export default TAAssignmentDetail;
