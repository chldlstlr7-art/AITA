import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { register } from '../services/api.js'; 
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
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock, Person, CheckCircleOutline } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

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

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    <StyledContainer maxWidth={false}>
      <StyledPaper elevation={3}>
        <Box textAlign="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            회원가입 📝
          </Typography>
          <Typography variant="body2" color="text.secondary">
            @snu.ac.kr 이메일로 가입하세요
          </Typography>
        </Box>

        {successMessage ? (
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

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <StyledTextField
                  required
                  sx={{ width: '100%' }}
                  id="email"
                  label="이메일"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error.includes("이메일")}
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
                    sx={{ width: '100%' }}
                    name="password"
                    label="비밀번호"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={handlePasswordChange}
                    error={error.includes("비밀번호") && !error.includes("일치")}
                    disabled={isLoading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: 'text.secondary', mr: 1 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            disabled={isLoading}
                          >
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
                  sx={{ width: '100%' }}
                  name="confirmPassword"
                  label="비밀번호 확인"
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={error.includes("일치")}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: 'text.secondary', mr: 1 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                          size="small"
                          disabled={isLoading}
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>

              <StyledButton 
                type="submit" 
                sx={{ 
                  width: '100%',
                  mt: 3, 
                  mb: 2,
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                }}
                variant="contained"
                disabled={isLoading}
              >
                {isLoading ? '가입 처리 중...' : '가입하기'}
              </StyledButton>
            </form>
          </>
        )}

        {!successMessage && (
          <Typography variant="body2" align="center" sx={{ mt: 3, color: 'text.secondary' }}>
            이미 계정이 있으신가요?{' '}
            <Link 
              component={RouterLink} 
              to="/login" 
              sx={{
                fontWeight: 600,
                color: '#f5576c',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              로그인
            </Link>
          </Typography>
        )}
      </StyledPaper>
    </StyledContainer>
  );
}

export default RegisterPage;