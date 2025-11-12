import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './components/Header.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

// 1. [신규] MUI의 <Container> 컴포넌트 임포트
import Container from '@mui/material/Container';

function App() {
  return (
    <AuthProvider>
      <Header />
      {/* 2. [신규] 페이지 콘텐츠를 <Container>로 감싸서
             적절한 최대 가로폭과 좌우 여백을 줍니다. */}
      <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Outlet /> {/* HomePage, LoginPage 등이 여기에 옴 */}
      </Container>
    </AuthProvider>
  );
}

export default App;