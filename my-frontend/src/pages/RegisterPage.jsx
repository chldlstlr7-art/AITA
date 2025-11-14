import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
// 1. [수정] 'register' 외 'verifyEmail' API 임포트
import { register, verifyEmail } from '../services/api.js'; 
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
// 2. [수정] 'VpnKey' (OTP 아이콘) 임포트
import { Visibility, VisibilityOff, Email, Lock, CheckCircleOutline, VpnKey } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// --- (스타일 컴포넌트들은 보내주신 코드와 100% 동일) ---
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
      boxShadow: `0 0 0 3px rgba(245, 87, 108, 0.1)`,
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
const StyledLink = styled(Link)(({ theme }) => ({
  fontWeight: 600,
  color: '#f5576c',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' }
}));

// [수정] 헬퍼 함수를 '사용하는' 컴포넌트보다 "먼저" 정의합니다.
const PasswordStrengthIndicator = ({ strength }) => {
  const getColor = () => {
    if (strength < 2) return '#f44336';
    if (strength < 3) return '#ff9800';
    if (strength < 4) return '#ffc107';
    return '#4caf50';
  };
  const getLabel = () => {
    if (strength < 2) return '약함';
    if (strength < 3) return '보통';
    if (strength < 4) return '좋음';
    return '매우 강함';
  };
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
        {[1, 2, 3, 4].map((level) => (
          <Box
            key={level}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: level <= strength ? getColor() : '#e0e0e0',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: getColor() }}>
        {getLabel()}
      </Typography>
    </Box>
  );
};

// --- [컴포넌트] ---
function RegisterPage() {
  // 3. [신규] 'step' (단계) 상태와 'code' (OTP) 상태 추가
  const [step, setStep] = useState('register'); // 'register' or 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState(''); // OTP 코드
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate(); 
  
  const calculatePasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[!@#$%^&*]/.test(pwd)) strength++;
    return strength;
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  // 4. [수정] 1단계: 회원가입 "요청" (OTP 발송) 핸들러
  const handleRegisterSubmit = async (e) => {
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
      // 5. (v4) /register API 호출
      const data = await register(email, password);
      // (성공 시: " ... 인증 코드를 발송했습니다 ... ")
      setSuccessMessage(data.message);
      
      // 6. [신규] UI를 "인증 코드" 입력 단계로 변경
      setStep('verify'); 
      
    } catch (err) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 7. [신규] 2단계: 이메일 "인증" 핸들러
  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (code.length < 6) {
      setError('6자리 인증 코드를 입력해 주세요.');
      return;
    }
    
    setIsLoading(true);
    try {
      // 8. (v4) /verify-email API 호출
      const data = await verifyEmail(email, code);
      // (성공 시: " ... 인증에 성공했습니다 ... ")
      setSuccessMessage(data.message + " 3초 후 로그인 페이지로 이동합니다.");
      
      // 9. 인증 성공! 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        navigate('/login');
      }, 3000);
      
    } catch (err) {
      setError(err.message || '인증 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <StyledContainer maxWidth={false}>
      <StyledPaper elevation={3}>
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            {/* 10. [수정] 단계에 따라 제목 변경 */}
            {step === 'register' ? '회원가입 📝' : '이메일 인증'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {step === 'register' ? 
              '@snu.ac.kr 이메일로 가입하세요' : 
              `${email}로 발송된 6자리 코드를 입력하세요.`}
          </Typography>
        </Box>

        {/* --- 11. "가입 완료/인증 완료" 메시지 표시 --- */}
        {successMessage && !error ? ( // [수정] 성공 시에만 표시
          <Alert icon={<CheckCircleOutline fontSize="inherit" />} severity="success">
            {successMessage}
          </Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {/* --- 12. "단계"에 따라 다른 폼 렌더링 --- */}
            
            {/* 12A: "1단계" (가입 폼) */}
            {step === 'register' && (
              <form onSubmit={handleRegisterSubmit}>
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
                    placeholder="example@snu.ac.kr"
                  />
                  <Box>
                    <StyledTextField
                      required
                      fullWidth
                      name="password"
                      label="비밀번호"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={handlePasswordChange}
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
                    {password && <PasswordStrengthIndicator strength={passwordStrength} />}
                  </Box>
                  <StyledTextField
                    required
                    fullWidth
                    name="confirmPassword"
                    label="비밀번호 확인"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: 'text.secondary', mr: 1 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Stack>
                <StyledButton 
                  type="submit" 
                  disabled={isLoading}
                  variant="contained"
                  sx={{ 
                    width: '100%',
                    mt: 3, 
                    mb: 2,
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                  }}
                >
                  {isLoading ? <CircularProgress size={24} color="inherit" /> : '인증 코드 받기'}
                </StyledButton>
              </form>
            )}
            
            {/* 12B: "2단계" (인증 폼) */}
            {step === 'verify' && (
              <form onSubmit={handleVerifySubmit}>
                <Stack spacing={2}>
                  <StyledTextField
                    required
                    fullWidth
                    id="code"
                    label="6자리 인증 코드"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VpnKey sx={{ color: 'text.secondary', mr: 1 }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Stack>
                <StyledButton 
                  type="submit" 
                  disabled={isLoading}
                  variant="contained"
                  sx={{ 
                    width: '100%',
                    mt: 3, 
                    mb: 2,
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                  }}
                >
                  {isLoading ? '인증 확인 중...' : '이메일 인증 완료'}
                </StyledButton>
              </form>
            )}
          </>
        )}

        {/* 하단 "로그인" 링크 (동일) */}
        {!successMessage && (
          <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
            이미 계정이 있으신가요?{' '}
            <StyledLink component={RouterLink} to="/login">
              로그인
            </StyledLink>
          </Typography>
        )}
      </StyledPaper>
    </StyledContainer>
  );
}

export default RegisterPage;