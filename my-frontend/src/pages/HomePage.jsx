import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
// 1. [신규] MUI 컴포넌트 임포트
import { Box, Typography, Link } from '@mui/material';

function HomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    // 2. [수정] Mantine 대신 MUI <Box>와 <Typography> 사용
    <Box sx={{ textAlign: 'center' }}>
      {isAuthenticated ? (
        <div>
          <Typography variant="h4">환영합니다, {user?.email}!</Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            이곳에서 리포트 분석을 시작할 수 있습니다.
          </Typography>
          {/* (Phase 5: 여기에 파일 업로드 폼이 들어올 것입니다) */}
        </div>
      ) : (
        <div>
          <Typography variant="h4">AITA 리포트 분석기에 오신 것을 환영합니다.</Typography>
          <Typography variant="body1" sx={{ mt: 2 }}>
            서비스를 이용하려면{' '}
            {/* 3. [수정] react-router-dom의 Link와 MUI의 Link를 결합 */}
            <Link component={RouterLink} to="/login">
              로그인
            </Link>{' '}
            하거나{' '}
            <Link component={RouterLink} to="/register">
              회원가입
            </Link>
            이 필요합니다.
          </Typography>
        </div>
      )}
    </Box>
  );
}

export default HomePage;