import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './components/Header.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

function App() {
  const [noticeOpen, setNoticeOpen] = useState(true);

  // Show the notice on first mount. If you prefer to show only once per browser session,
  // we could persist a flag in sessionStorage/localStorage.
  useEffect(() => {
    setNoticeOpen(true);
  }, []);

  return (
    <AuthProvider>
      <Header />
      <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Outlet /> {/* HomePage, LoginPage 등이 여기에 옴 */}
      </Container>

      <Dialog open={noticeOpen} onClose={() => setNoticeOpen(false)} aria-labelledby="service-down-title">
        <DialogTitle id="service-down-title">[서비스 중단]</DialogTitle>
        <DialogContent>
          <Typography>
            11월 30일자로 Render 서버 결제 중단(개발지원비 정산)으로 인해 서비스 이용이 불가합니다.
          </Typography>
          <Typography>
            문의 메일: albert0213@snu.ac.kr
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoticeOpen(false)} autoFocus>확인</Button>
        </DialogActions>
      </Dialog>
    </AuthProvider>
  );
}

export default App;