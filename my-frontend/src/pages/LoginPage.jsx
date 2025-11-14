import React, { useState } from 'react';
// 1. [수정] 'login' 외 'loginWithToken'도 가져옴
import { useAuth } from '../context/AuthContext.jsx'; 
import { Link as RouterLink } from 'react-router-dom';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Link,
  Container,
  Box,
  InputAdornment,
  IconButton,
  CircularProgress,
  Avatar,
  // 2. [신규] Accordion (숨김 메뉴) 컴포넌트 임포트
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Email, 
  Lock, 
  AutoAwesome as AiIcon,
  ExpandMore as ExpandMoreIcon, // [신규]
  VpnKey // [신규]
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
// (api.js 임포트는 더 이상 필요 없음)

// --- (스타일 컴포넌트들은 이전과 100% 동일) ---
const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, #f093fb 0%, #f5576c 100%)`, 
  padding: theme.spacing(2),
}));
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(4),
  maxWidth: 420,
  width: '100%',
  background: 'rgba(255, 255, 255, 0.95)',
}));
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1),
    '&.Mui-focused': {
      boxShadow: `0 0 0 3px rgba(245, 87, 108, 0.1)`, 
    },
  },
}));
const StyledLink = styled(Link)(({ theme }) => ({
  fontWeight: 600,
  color: '#f5576c', 
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' }
}));
const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1.5),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  /* ... */
}));

// --- [컴포넌트] ---

function LoginPage() {
  // (기존 상태 변수들)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); 

  // 3. [신규] 개발자 토큰 입력용 상태
  const [devToken, setDevToken] = useState('');
  
  // 4. [수정] 'loginWithToken' 임포트
  const { login, loginWithToken } = useAuth(); 

  // (기존 handleSubmit 함수 - 100% 동일)
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    setError(''); 
    if (!email.endsWith('@snu.ac.kr')) { /* ... */ }
    setIsLoading(true);
    try {
      await login(email, password); 
    } catch (err) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false); 
    }
  };
  
  // 5. [신규] 개발자 토큰 제출 핸들러
  const handleDevTokenSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (devToken.trim() === '') {
      setError('개발자용 토큰을 입력해 주세요.');
      return;
    }
    
    setIsLoading(true);
    try {
      // 6. Context의 새 함수 호출
      await loginWithToken(devToken);
      // (성공하면 Context가 알아서 '/'로 리다이렉트)
    } catch (err) {
      // (예: 토큰 디코딩 실패)
      setError(err.message || '개발자용 토큰이 유효하지 않습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  

  return (
    <StyledContainer maxWidth={false}>
      <StyledPaper elevation={3}>
        <Box textAlign="center" mb={3}>
          {/* ... (헤더 UI 동일) ... */}
          <Avatar sx={{ bgcolor: 'primary.main', margin: '0 auto 16px' }}>
            <AiIcon />
          </Avatar>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            환영합니다 👋
          </Typography>
          <Typography variant="body2" color="text.secondary">
            @snu.ac.kr 이메일로 로그인하세요
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* --- 1. (기존) 비밀번호 폼 (100% 동일) --- */}
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <StyledTextField
              required
              fullWidth
              id="email"
              label="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: 'text.secondary', mr: 1 }} />
                  </InputAdornment>
                ),
              }}
            />
            <StyledTextField
              required
              fullWidth
              name="password"
              label="비밀번호"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: 'text.secondary', mr: 1 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <StyledButton 
              type="submit" 
              fullWidth variant="contained" 
              disabled={isLoading}
              sx={{ 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
                color: 'white',
                mt: 1 
              }}
            >
              {isLoading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
            </StyledButton>
          </Stack>
        </form>
        
        {/* --- 2. (기존) 하단 링크들 (100% 동일) --- */}
        <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
          계정이 없으신가요?{' '}
          <StyledLink component={RouterLink} to="/register">
            회원가입
          </StyledLink>
        </Typography>

        {/* --- 3. [신규!] 개발자용 토큰 주입 Accordion --- */}
        <Accordion sx={{ mt: 3, bgcolor: '#fafafa', boxShadow: 'none' }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="dev-panel-content"
            id="dev-panel-header"
          >
            <Typography variant="body2" color="text.secondary">
              개발자용 로그인
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <form onSubmit={handleDevTokenSubmit}>
              <Stack spacing={2}>
                <StyledTextField
                  fullWidth
                  id="dev-token"
                  label="개발자용 Access Token"
                  value={devToken}
                  onChange={(e) => setDevToken(e.target.value)}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <VpnKey sx={{ color: 'text.secondary', mr: 1 }} />
                      </InputAdornment>
                    ),
                  }}
                  placeholder="eyJhbGciOi..."
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={24} /> : '토큰으로 로그인'}
                </Button>
              </Stack>
            </form>
          </AccordionDetails>
        </Accordion>
        
      </StyledPaper>
    </StyledContainer>
  );
}

export default LoginPage;