import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  CheckCircleOutline,
  VpnKey,
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

// 🎨 회원가입 카드 - 글래스모피즘 효과
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

// 🎨 버튼
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

// 🎨 비밀번호 강도 표시기
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
              backgroundColor: level <= strength ? getColor() : alpha('#000', 0.1),
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: getColor(), fontWeight: 500 }}>
        {getLabel()}
      </Typography>
    </Box>
  );
};

function RegisterPage() {
  const [step, setStep] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  
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

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (!email.endsWith('@snu.ac.kr')) {
      setError('@snu.ac.kr 이메일 주소를 사용해주세요.');
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
      setSuccessMessage(data.message);
      setStep('verify');
    } catch (err) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

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
      const data = await verifyEmail(email, code);
      setSuccessMessage(data.message + ' 3초 후 로그인 페이지로 이동합니다.');
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
            {step === 'register' ? '회원가입' : '이메일 인증'}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{
              color: 'text.secondary',
              fontSize: '0.95rem',
            }}
          >
            {step === 'register' 
              ? '@snu.ac.kr 계정으로 가입하세요' 
              : `${email}로 발송된 6자리 코드를 입력하세요`}
          </Typography>
        </Box>

        {/* 성공 메시지 */}
        {successMessage && !error ? (
          <Alert
            icon={<CheckCircleOutline fontSize="inherit" />}
            severity="success"
            sx={{
              mb: 3,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'success.light',
              backgroundColor: alpha('#4caf50', 0.08),
              backdropFilter: 'blur(10px)',
            }}
          >
            {successMessage}
          </Alert>
        ) : (
          <>
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

            {/* 회원가입 단계 */}
            {step === 'register' && (
              <form onSubmit={handleRegisterSubmit}>
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
                    placeholder="example@snu.ac.kr"
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
                      autoComplete="new-password"
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
                    {password && <PasswordStrengthIndicator strength={passwordStrength} />}
                  </Box>

                  {/* 비밀번호 확인 */}
                  <StyledTextField
                    required
                    fullWidth
                    name="confirmPassword"
                    label="비밀번호 확인"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                            disabled={isLoading}
                            sx={{
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                transform: 'scale(1.1)',
                              },
                            }}
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  {/* 가입 버튼 */}
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
                      '인증 코드 받기'
                    )}
                  </StyledButton>
                </Stack>
              </form>
            )}

            {/* 인증 단계 */}
            {step === 'verify' && (
              <form onSubmit={handleVerifySubmit}>
                <Stack spacing={3}>
                  {/* 인증 코드 */}
                  <StyledTextField
                    required
                    fullWidth
                    id="code"
                    label="6자리 인증 코드"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={isLoading}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VpnKey sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  {/* 인증 버튼 */}
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
                      '이메일 인증 완료'
                    )}
                  </StyledButton>
                </Stack>
              </form>
            )}
          </>
        )}

        {/* 로그인 링크 */}
        {!successMessage && (
          <Typography
            variant="body2"
            align="center"
            sx={{ 
              mt: 4, 
              color: 'text.secondary',
              fontSize: '0.95rem',
            }}
          >
            이미 계정이 있으신가요?{' '}
            <StyledLink component={RouterLink} to="/login">
              로그인
            </StyledLink>
          </Typography>
        )}

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

export default RegisterPage;