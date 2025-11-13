import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Box,
  Typography,
  Link,
  Container,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Upload,
  TextFields,
  TrendingUp,
  Security,
  Speed,
  CheckCircle,
} from '@mui/icons-material';
import AnalysisForm from '../components/AnalysisForm.jsx';

const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(4),
}));

const HeroSection = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)`,
  borderRadius: theme.spacing(2),
  padding: theme.spacing(6),
  color: 'white',
  marginBottom: theme.spacing(6),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: theme.spacing(2),
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.3s ease',
  border: '1px solid rgba(0, 0, 0, 0.05)',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1.5, 3),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
  },
}));

const features = [
  {
    icon: <Upload sx={{ fontSize: 40 }} />,
    title: '파일 업로드',
    description: 'PDF, DOCX 등 다양한 형식의 리포트를 쉽게 업로드하세요.',
  },
  {
    icon: <TextFields sx={{ fontSize: 40 }} />,
    title: '텍스트 입력',
    description: '직접 텍스트를 입력해 실시간으로 분석할 수 있습니다.',
  },
  {
    icon: <TrendingUp sx={{ fontSize: 40 }} />,
    title: '상세 분석',
    description: 'AI 기반의 정교한 분석으로 인사이트를 얻으세요.',
  },
  {
    icon: <Security sx={{ fontSize: 40 }} />,
    title: '보안',
    description: '@snu.ac.kr 이메일로만 접근 가능한 안전한 서비스입니다.',
  },
  {
    icon: <Speed sx={{ fontSize: 40 }} />,
    title: '빠른 처리',
    description: '고성능 AI 엔진으로 빠르게 결과를 제공합니다.',
  },
  {
    icon: <CheckCircle sx={{ fontSize: 40 }} />,
    title: '신뢰성',
    description: '서울대학교에서 개발한 신뢰할 수 있는 분석 도구입니다.',
  },
];

function HomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <StyledContainer maxWidth="lg">
      {isAuthenticated ? (
        <Box>
          {/* 사용자 환영 섹션 */}
          <HeroSection sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ position: 'relative', zIndex: 2 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  mb: 1,
                  fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' },
                }}
              >
                환영합니다! 👋
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 500,
                  mb: 2,
                  opacity: 0.95,
                  fontSize: { xs: '0.95rem', sm: '1.1rem' },
                }}
              >
                {user?.email}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  opacity: 0.9,
                  maxWidth: '600px',
                  lineHeight: 1.7,
                }}
              >
                분석할 리포트를 업로드하거나 텍스트를 입력해 주세요. AI 기반의
                정교한 분석으로 인사이트를 얻을 수 있습니다.
              </Typography>
            </Box>
          </HeroSection>

          {/* 분석 폼 */}
          <Box sx={{ mb: 6 }}>
            <AnalysisForm />
          </Box>
        </Box>
      ) : (
        <Box>
          {/* 메인 히어로 섹션 */}
          <HeroSection sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <Box sx={{ position: 'relative', zIndex: 2 }}>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 800,
                  mb: 2,
                  fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                  letterSpacing: '-0.5px',
                }}
              >
                AITA 리포트 분석기
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 400,
                  mb: 4,
                  opacity: 0.95,
                  fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.25rem' },
                  maxWidth: '600px',
                  margin: '0 auto 2rem',
                  lineHeight: 1.8,
                }}
              >
                서울대학교에서 개발한 AI 기반 리포트 분석 플랫폼입니다.
                <br />
                당신의 리포트를 한 단계 업그레이드하세요.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                <StyledButton
                  component={RouterLink}
                  to="/login"
                  variant="contained"
                  size="large"
                  sx={{
                    background: 'white',
                    color: '#667eea',
                    fontWeight: 700,
                    '&:hover': {
                      background: '#f5f5f5',
                    },
                  }}
                >
                  로그인
                </StyledButton>
                <StyledButton
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  sx={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '2px solid white',
                    fontWeight: 700,
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.3)',
                    },
                  }}
                >
                  무료 회원가입
                </StyledButton>
              </Stack>
            </Box>
          </HeroSection>

          {/* 기능 소개 섹션 */}
          <Box sx={{ mb: 8 }}>
            <Typography
              variant="h4"
              component="h2"
              sx={{
                fontWeight: 700,
                textAlign: 'center',
                mb: 2,
              }}
            >
              주요 기능 ✨
            </Typography>
            <Typography
              variant="body1"
              sx={{
                textAlign: 'center',
                color: 'text.secondary',
                mb: 4,
                maxWidth: '600px',
                margin: '0 auto 3rem',
              }}
            >
              AITA는 당신의 리포트 작성 과정을 완벽하게 지원합니다.
            </Typography>

            <Grid container spacing={3}>
              {features.map((feature, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <FeatureCard>
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                      <Box
                        sx={{
                          color: '#667eea',
                          mb: 2,
                          display: 'flex',
                          justifyContent: 'center',
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.6 }}
                      >
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </FeatureCard>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* 서울대학교 배너 */}
          <Card
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              textAlign: 'center',
              py: 4,
              borderRadius: 2,
              mb: 4,
            }}
          >
            <CardContent>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                }}
              >
                🎓 서울대학교 공식 서비스
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mb: 3 }}>
                @snu.ac.kr 이메일로만 가입할 수 있습니다.
              </Typography>
              <StyledButton
                component={RouterLink}
                to="/register"
                variant="contained"
                sx={{
                  background: 'white',
                  color: '#667eea',
                  fontWeight: 700,
                }}
              >
                지금 시작하기
              </StyledButton>
            </CardContent>
          </Card>

          {/* 푸터 섹션 */}
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              AITA © 2025. 서울대학교 학부생팀 '알파타'에서 개발했습니다.
            </Typography>
          </Box>
        </Box>
      )}
    </StyledContainer>
  );
}

export default HomePage;