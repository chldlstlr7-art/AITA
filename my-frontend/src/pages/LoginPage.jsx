import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx'; 
import { Link as RouterLink } from 'react-router-dom';
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

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); 

  const { login } = useAuth(); 

  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    setError(''); 
    
    if (!email.endsWith('@snu.ac.kr')) {
        setError('유효한 @snu.ac.kr 이메일이 아닙니다.');
        return;
    }
    
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false); 
    }
  };

  return (
    // 2. [수정] 폼을 <Paper> (그림자 있는 종이)로 감쌉니다.
    <Paper 
      elevation={3} 
      sx={{ 
        padding: 4, // 32px
        maxWidth: 420, 
        margin: '2rem auto' 
      }}
    >
      <Typography variant="h4" component="h1" align="center" gutterBottom>
        로그인
      </Typography>
      
      <form onSubmit={handleSubmit}>
        {/* 3. [수정] <Stack>으로 폼 요소들의 간격을 줍니다. */}
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
            error={!!error}
            disabled={isLoading}
          />
          
          <TextField
            required
            fullWidth
            name="password"
            label="비밀번호"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!error}
            disabled={isLoading}
          />
          
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          <Button 
            type="submit" 
            fullWidth 
            variant="contained" 
            sx={{ mt: 2, mb: 1 }}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </Button>
        </Stack>
      </form>

      <Typography variant="body2" align="center" sx={{ mt: 2 }}>
        계정이 없으신가요?{' '}
        <Link component={RouterLink} to="/register" variant="body2">
          회원가입
        </Link>
      </Typography>
    </Paper>
  );
}

export default LoginPage;