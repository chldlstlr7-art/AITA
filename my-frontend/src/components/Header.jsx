import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
// 1. [신규] MUI 컴포넌트 임포트
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Link
} from '@mui/material';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    // 2. [수정] <AppBar> (헤더)와 <Toolbar> (콘텐츠 영역) 사용
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        {/* 3. 로고/타이틀 (flexGrow: 1로 나머지 요소를 오른쪽으로 밀어냄) */}
        <Typography 
          variant="h6" 
          component={RouterLink} 
          to="/" 
          sx={{ 
            flexGrow: 1, 
            textDecoration: 'none', 
            color: 'inherit' 
          }}
        >
          AITA 리포트 분석기
        </Typography>
        
        {/* 4. 로그인/로그아웃 버튼 */}
        <nav>
          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body1" sx={{ mr: 2 }}>
                {user ? user.email : '환영합니다!'}
              </Typography>
              <Button onClick={logout} variant="outlined" size="small">
                로그아웃
              </Button>
            </Box>
          ) : (
            <Box>
              <Button 
                component={RouterLink} 
                to="/login" 
                color="inherit" 
                variant="outlined" 
                size="small"
                sx={{ mr: 1 }}
              >
                로그인
              </Button>
              <Button 
                component={RouterLink} 
                to="/register" 
                color="primary" 
                variant="contained" 
                size="small"
              >
                회원가입
              </Button>
            </Box>
          )}
        </nav>
      </Toolbar>
    </AppBar>
  );
}

export default Header;