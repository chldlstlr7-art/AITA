import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import StudentDashboardContent from '../components/student/StudentDashboardContent.jsx';

const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

const HeaderPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  color: 'white',
}));

function StudentDashboard() {
  return (
    <StyledContainer maxWidth="lg">
      <HeaderPaper elevation={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          📊 학생 대시보드
        </Typography>
        <Typography variant="body1" sx={{ mt: 1, opacity: 0.9 }}>
          나의 수강 과목과 제출한 리포트를 확인하세요
        </Typography>
      </HeaderPaper>

      {/* 🔥 API 통신이 필요한 모든 로직은 StudentDashboardContent에 위임 */}
      <StudentDashboardContent />
    </StyledContainer>
  );
}

export default StudentDashboard;