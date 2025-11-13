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
  CircularProgress // [신규]
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, VpnKey } from '@mui/icons-material'; // [신규] VpnKey
import { styled } from '@mui/material/styles';
// 1. [신규] OTP 코드 요청 API 임포트
import { requestLoginCode } from '../services/api.js'; 

// (Styled 컴포넌트들은 이전과 동일)
const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
  padding: theme.spacing(2),
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(4),
  maxWidth: 420,
  width: '100%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
  background: 'rgba(255, 255, 255, 0.95)',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1),
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    },
    '&.Mui-focused': {
      boxShadow: `0 0 0 3px rgba(102, 126, 234, 0.1)`,
    },
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1.5),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
  },
}));

// --- (여기부터가 핵심 수정입니다) ---

function LoginPage() {
  // 2. [신규] 'password' 모드와 'otp' 모드
  const [mode, setMode] = useState('password'); // 'password' or 'otp'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState(''); // OTP 코드
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // [신규] OTP 발송 성공 메시지
  const [isLoading, setIsLoading] = useState(false); 
  const [otpSent, setOtpSent] = useState(false); // [신규] OTP 발송 여부

  // 3. [수정] Context에서 두 가지 로그인 함수를 모두 가져옴
  const { login, loginWithOtp } = useAuth(); 

  // --- 4. [수정] 핸들러 분리 ---
  
  // 4A: (비밀번호) 로그인 핸들러
  const handlePasswordSubmit = async (e) => { 
    e.preventDefault(); 
    setError(''); 
    setSuccess('');
    
    if (!email.endsWith('@snu.ac.kr')) {
        setError('유효한 @snu.ac.kr 이메일이 아닙니다.');
        return;
    }
    
    setIsLoading(true);
    try {
      await login(email, password); // 비밀번호 로그인 호출
    } catch (err) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false); 
    }
  };

  // 4B: (OTP) 코드 요청 핸들러
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.endsWith('@snu.ac.kr')) {
        setError('유효한 @snu.ac.kr 이메일이 아닙니다.');
        return;
    }
    
    setIsLoading(true);
    try {
      const data = await requestLoginCode(email); // OTP 코드 요청 API 호출
      setSuccess(data.message); // "인증 코드를 발송했습니다..."
      setOtpSent(true); // "코드 입력창"을 보여주도록 상태 변경
    } catch (err) {
      setError(err.message || '코드 발송 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4C: (OTP) 코드 검증 핸들러
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (code.length < 6) {
      setError('6자리 인증 코드를 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    try {
      await loginWithOtp(email, code); // OTP 로그인(검증) 호출
    } catch (err) {
      setError(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 5. [신규] 모드 변경 함수
  const toggleMode = (newMode) => {
    setMode(newMode);
    // 모드 변경 시 모든 상태 초기화
    setError('');
    setSuccess('');
    setPassword('');
    setCode('');
    setOtpSent(false);
  };

  return (
    <StyledContainer maxWidth={false}>
      <StyledPaper elevation={3}>
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            {mode === 'password' ? '환영합니다 👋' : '이메일로 로그인'}
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
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* --- 6. [핵심 수정] 'mode'에 따라 다른 폼을 렌더링 --- */}

        {/* 6A: 비밀번호 폼 */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <Stack spacing={2}>
              <StyledTextField
                required
                fullWidth
                id="email"
                label="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!error}
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
                error={!!error}
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
                sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
              </StyledButton>
            </Stack>
          </form>
        )}
        
        {/* 6B: OTP 폼 */}
        {mode === 'otp' && (
          <form onSubmit={otpSent ? handleOtpSubmit : handleRequestCode}>
            <Stack spacing={2}>
              <StyledTextField
                required
                fullWidth
                id="email-otp"
                label="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!error && !otpSent} // 코드 입력 중에는 이메일 에러 숨김
                disabled={isLoading || otpSent} // 코드 발송 후 이메일 수정 불가
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: 'text.secondary', mr: 1 }} />
                    </InputAdornment>
                  ),
                }}
              />
              
              {/* OTP 코드가 발송되면 코드 입력창 표시 */}
              {otpSent && (
                <StyledTextField
                  required
                  fullWidth
                  id="code"
                  label="6자리 인증 코드"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  error={!!error && otpSent} // 코드 에러만 표시
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <VpnKey sx={{ color: 'text.secondary', mr: 1 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              )}

              <StyledButton 
                type="submit" 
                fullWidth variant="contained" 
                disabled={isLoading}
                sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 
                 otpSent ? '인증 및 로그인' : '인증 코드 받기'}
              </StyledButton>
            </Stack>
          </form>
        )}

        {/* --- 7. [신규] 모드 전환 링크 --- */}
        <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
          {mode === 'password' ? (
            <Link 
              component="button" 
              onClick={() => toggleMode('otp')} 
              sx={{...linkStyles}}
            >
              비밀번호 없는 이메일 인증(OTP)
            </Link>
          ) : (
            <Link 
              component="button" 
              onClick={() => toggleMode('password')} 
              sx={{...linkStyles}}
            >
              비밀번호로 로그인
            </Link>
          )}
        </Typography>

        <Typography variant="body2" align="center" sx={{ mt: 1, color: 'text.secondary' }}>
          계정이 없으신가요?{' '}
          <Link component={RouterLink} to="/register" sx={{...linkStyles, fontWeight: 600}}>
            회원가입
          </Link>
        </Typography>
      </StyledPaper>
    </StyledContainer>
  );
}

// (링크 스타일 재사용을 위한 헬퍼)
const linkStyles = {
  fontWeight: 500,
  color: '#667eea',
  textDecoration: 'none',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
  fontSize: 'inherit',
  '&:hover': { textDecoration: 'underline' }
};

export default LoginPage;