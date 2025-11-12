import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { register } from '../services/api.js'; 
// 1. [신규] MUI 컴포넌트 임포트
import {
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Box,
  Link
} from '@mui/material';
// 2. [신규] MUI 아이콘 임포트
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate(); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (!email.endsWith('@snu.ac.kr')) {
      setError('유효한 @snu.ac.kr 이메일이 아닙니다.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await register(email, password);
      setSuccessMessage(data.message + " 3초 후 로그인 페이지로 이동합니다.");
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 3. [수정] 폼을 <Paper> (그림자 있는 종이)로 감쌉니다.
    <Paper 
      elevation={3} 
      sx={{ 
        padding: 4, // 32px
        maxWidth: 420, 
        margin: '2rem auto' 
      }}
    >
      <Typography variant="h4" component="h1" align="center" gutterBottom>
        회원가입
      </Typography>

      {successMessage ? (
        <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success">
          {successMessage}
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* 4. [수정] <Stack>으로 폼 요소들의 간격을 줍니다. */}
          <Stack spacing={2}>
            <TextField
              required
              fullWidth
              id="email"
              label="이메일 (@snu.ac.kr)"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error.includes("이메일")}
              helperText={error.includes("이메일") ? error : ""}
              disabled={isLoading}
            />
            
            <TextField
              required
              fullWidth
              name="password"
              label="비밀번호 (6자 이상)"
              type="password"
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error.includes("비밀번호") && !error.includes("일치")}
              helperText={error.includes("비밀번호") && !error.includes("일치") ? error : ""}
              disabled={isLoading}
            />

            <TextField
              required
              fullWidth
              name="confirmPassword"
              label="비밀번호 확인"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error.includes("일치")}
              helperText={error.includes("일치") ? error : ""}
              disabled={isLoading}
            />
            
            {error && !error.includes("이메일") && !error.includes("비밀번호") && (
              <Alert severity="error">{error}</Alert>
            )}

            <Button 
              type="submit" 
              fullWidth 
              variant="contained" 
              sx={{ mt: 2, mb: 1 }}
              disabled={isLoading}
            >
              {isLoading ? '가입 처리 중...' : '가입하기'}
            </Button>
          </Stack>
        </form>
      )}

      {!successMessage && (
        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
          계정이 이미 있으신가요?{' '}
          <Link component={RouterLink} to="/login" variant="body2">
            로그인
          </Link>
        </Typography>
      )}
    </Paper>
  );
}

export default RegisterPage;