import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// 🎨 메인 컨테이너 - SNU 로고 배경
const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
  padding: theme.spacing(2),
  position: 'relative',
  overflow: 'hidden',
  
  // SNU 로고 배경
  '&::before': {
    content: '""',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '900px',
    height: '900px',
    backgroundImage: 'url(/snu_ui_download.png)',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    opacity: 0.03,
    filter: 'drop-shadow(0 0 80px rgba(0, 0, 0, 0.1))',
    pointerEvents: 'none',
    zIndex: 0,
  },
}));

// 🎨 로그인 카드 - 글래스모피즘 효과
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(4),
  padding: theme.spacing(6, 5),
  maxWidth: 460,
  width: '100%',
  background: 'rgba(255, 255, 255, 0.92)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  boxShadow: '0 12px 48px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  position: 'relative',
  zIndex: 1,
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 16px 56px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
  },
}));

// 🎨 로고 영역
const LogoBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(5),
  '& .logo-text': {
    fontSize: '3.5rem',
    fontWeight: 900,
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '0.08em',
    textShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
}));

// 🎨 텍스트 필드
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(2),
    transition: 'all 0.3s ease',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.04),
      transform: 'translateY(-1px)',
    },
    
    '&.Mui-focused': {
      backgroundColor: alpha(theme.palette.primary.main, 0.05),
      boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}`,
      transform: 'translateY(-1px)',
      '& fieldset': {
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
      },
    },
    
    '& fieldset': {
      borderColor: alpha(theme.palette.primary.main, 0.15),
    },
  },
  
  '& .MuiInputLabel-root.Mui-focused': {
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
}));

// 🎨 로그인 버튼
const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1.75),
  fontSize: '1.05rem',
  fontWeight: 700,
  textTransform: 'none',
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%)',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.45)}`,
    '&::before': {
      opacity: 1,
    },
  },
  
  '&:active': {
    transform: 'translateY(-1px)',
  },
  
  '&:disabled': {
    background: theme.palette.action.disabledBackground,
    transform: 'none',
    boxShadow: 'none',
  },
}));

// 🎨 링크
const StyledLink = styled(Link)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.main,
  textDecoration: 'none',
  transition: 'all 0.2s ease',
  position: 'relative',
  
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -2,
    left: 0,
    width: '0%',
    height: 2,
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    transition: 'width 0.3s ease',
  },
  
  '&:hover': {
    color: theme.palette.secondary.main,
    '&::after': {
      width: '100%',
    },
  },
}));

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.endsWith('@snu.ac.kr')) {
      setError('@snu.ac.kr 이메일 주소를 사용해주세요.');
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
    <StyledContainer maxWidth={false}>
      <StyledPaper elevation={0}>
        {/* 로고 */}
        <LogoBox>
          <Typography className="logo-text">AITA</Typography>
        </LogoBox>

        {/* 헤더 */}
        <Box textAlign="center" mb={4}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              mb: 1.5,
              color: 'text.primary',
              letterSpacing: '-0.02em',
            }}
          >
            환영합니다! 👋
          </Typography>
          <Typography 
            variant="body2" 
            sx={{
              color: 'text.secondary',
              fontSize: '0.95rem',
            }}
          >
            @snu.ac.kr 계정으로 로그인하세요
          </Typography>
        </Box>

        {/* 에러 메시지 */}
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'error.light',
              backgroundColor: alpha('#f44336', 0.08),
              backdropFilter: 'blur(10px)',
            }}
          >
            {error}
          </Alert>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {/* 이메일 */}
            <StyledTextField
              required
              fullWidth
              id="email"
              label="이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* 비밀번호 */}
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
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={isLoading}
                      sx={{
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        },
                      }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* 로그인 버튼 */}
            <StyledButton
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{ mt: 1 }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '로그인'
              )}
            </StyledButton>
          </Stack>
        </form>

        {/* 회원가입 링크 */}
        <Typography
          variant="body2"
          align="center"
          sx={{ 
            mt: 4, 
            color: 'text.secondary',
            fontSize: '0.95rem',
          }}
        >
          계정이 없으신가요?{' '}
          <StyledLink component={RouterLink} to="/register">
            회원가입
          </StyledLink>
        </Typography>

        {/* 푸터 */}
        <Box textAlign="center" mt={4}>
          <Typography 
            variant="caption" 
            sx={{
              color: alpha('#000', 0.4),
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
            }}
          >
            AI 기반 보고서 분석 도구
          </Typography>
        </Box>
      </StyledPaper>
    </StyledContainer>
  );
}

export default LoginPage;