import React, { useState } from 'react';
import { analyzeReport } from '../services/api.js';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  Box,
  Card,
  CardContent,
  InputAdornment,
  LinearProgress,
  Checkbox,
  Divider,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import { 
  UploadFile as UploadFileIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  TextFields as TextFieldsIcon,
  BugReport as BugReportIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(245, 87, 108, 0.05) 100%)',
  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.1)',
  border: '1px solid rgba(102, 126, 234, 0.1)',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.3rem',
  marginBottom: theme.spacing(1),
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}));

const UploadCard = styled(Card)(({ theme, selected }) => ({
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  border: `2px solid ${selected ? '#667eea' : 'rgba(0, 0, 0, 0.1)'}`,
  background: selected ? 'rgba(102, 126, 234, 0.05)' : 'white',
  '&:hover': {
    borderColor: '#667eea',
    boxShadow: '0 8px 16px rgba(102, 126, 234, 0.15)',
    transform: 'translateY(-2px)',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.spacing(1),
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.08)',
    },
    '&.Mui-focused': {
      boxShadow: `0 0 0 3px rgba(102, 126, 234, 0.1)`,
    },
  },
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  '& .MuiOutlinedInput-notchedOutline': {
    borderRadius: theme.spacing(1),
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#667eea',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    boxShadow: `0 0 0 3px rgba(102, 126, 234, 0.1)`,
  },
}));

const UploadButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: theme.spacing(2),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  border: '2px dashed rgba(102, 126, 234, 0.3)',
  color: '#667eea',
  '&:hover': {
    borderColor: '#667eea',
    background: 'rgba(102, 126, 234, 0.05)',
    transform: 'translateY(-2px)',
  },
}));

const StyledSubmitButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1.5),
  fontSize: '1.05rem',
  fontWeight: 700,
  textTransform: 'none',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  transition: 'all 0.3s ease',
  '&:hover:not(:disabled)': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 24px rgba(102, 126, 234, 0.3)',
  },
  '&:disabled': {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    opacity: 0.7,
  },
}));

const FormLabel2 = styled(FormLabel)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '0.95rem',
  marginBottom: theme.spacing(2),
  color: theme.palette.text.primary,
}));

const DevModeBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  background: 'rgba(255, 152, 0, 0.05)',
  border: '1px solid rgba(255, 152, 0, 0.2)',
}));

// 제출물 형식 옵션
const ASSIGNMENT_TYPES = [
  '논설문/에세이',
  '프로젝트 기획서',
  '논문'
];

function AnalysisForm() {
  const [uploadType, setUploadType] = useState('file');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [assignmentType, setAssignmentType] = useState('');
  const [isTest, setIsTest] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(''); 
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (uploadType === 'file' && !file) {
      setError('분석할 파일을 선택해 주세요.');
      return;
    }
    if (uploadType === 'text' && text.length < 50) {
      setError('분석할 텍스트를 50자 이상 입력해 주세요.');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    let submissionTitle = '';
    
    if (uploadType === 'file') {
      formData.append('file', file);
      submissionTitle = file.name;
    } else {
      formData.append('text', text);
      // 🎯 텍스트 입력 시: 첫 문장을 제목으로 (최대 100자)
      submissionTitle = text.split('\n')[0].substring(0, 100);
      formData.append('title', submissionTitle);
    }
    
    formData.append('docType', 'report');
    formData.append('is_test', isTest.toString());
    
    if (assignmentType) {
      formData.append('assignment_type', assignmentType);
    }

    try {
      const data = await analyzeReport(formData);
      
      setIsLoading(false);
      console.log('분석 요청 성공, Report ID:', data.reportId);
      
      // 제목과 제출물 형식을 state로 전달
      navigate(`/report/${data.reportId}`, {
        state: { 
          submissionTitle: submissionTitle,
          userAssignmentType: assignmentType || null 
        }
      });

    } catch (err) {
      setIsLoading(false);
      setError(err.message || '분석 요청 중 오류가 발생했습니다.');
    }
  };

  const textLength = text.length;
  const textProgress = Math.min((textLength / 50) * 100, 100);

  return (
    <StyledPaper elevation={0}>
      <Box mb={3}>
        <SectionTitle variant="h5" component="h2">
          ✨ 새 분석 시작하기
        </SectionTitle>
        <Typography variant="body2" color="text.secondary">
          파일을 업로드하거나 텍스트를 입력해 AI 기반 분석을 시작하세요
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          {/* 분석 방식 선택 */}
          <Box>
            <FormLabel2 component="legend">분석 방식 선택</FormLabel2>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <UploadCard 
                selected={uploadType === 'file'}
                onClick={() => setUploadType('file')}
                sx={{ flex: 1 }}
              >
                <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                  <Box sx={{ mb: 1.5, color: uploadType === 'file' ? '#667eea' : 'text.secondary' }}>
                    <DescriptionIcon sx={{ fontSize: 32 }} />
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    파일 업로드
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    PDF, DOCX, TXT 등
                  </Typography>
                </CardContent>
              </UploadCard>

              <UploadCard 
                selected={uploadType === 'text'}
                onClick={() => setUploadType('text')}
                sx={{ flex: 1 }}
              >
                <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                  <Box sx={{ mb: 1.5, color: uploadType === 'text' ? '#667eea' : 'text.secondary' }}>
                    <TextFieldsIcon sx={{ fontSize: 32 }} />
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    텍스트 입력
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    직접 입력 또는 붙여넣기
                  </Typography>
                </CardContent>
              </UploadCard>
            </Stack>
          </Box>

          {/* 제출물 형식 선택 */}
          <Box>
            <FormControl fullWidth>
              <InputLabel id="assignment-type-label">
                제출물 형식 (선택사항)
              </InputLabel>
              <StyledSelect
                labelId="assignment-type-label"
                id="assignment-type"
                value={assignmentType}
                label="제출물 형식 (선택사항)"
                onChange={(e) => setAssignmentType(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <CategoryIcon sx={{ color: '#667eea', ml: 1 }} />
                  </InputAdornment>
                }
              >
                <MenuItem value="">
                  <em>선택 안 함 (AI가 자동 판단)</em>
                </MenuItem>
                {ASSIGNMENT_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </StyledSelect>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              💡 형식을 지정하지 않으면 AI가 자동으로 판단합니다
            </Typography>
          </Box>

          {/* 파일 업로드 또는 텍스트 입력 */}
          {uploadType === 'file' ? (
            <Box>
              <UploadButton
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<UploadFileIcon />}
              >
                {file ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon sx={{ color: '#4caf50' }} />
                    {file.name}
                  </Box>
                ) : (
                  '클릭해서 파일 선택 또는 드래그 & 드롭'
                )}
                <input
                  type="file"
                  hidden
                  onChange={handleFileChange}
                  accept=".txt,.pdf,.docx,.doc,.pptx"
                />
              </UploadButton>
              {file && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  📄 파일: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </Typography>
              )}
            </Box>
          ) : (
            <Box>
              <StyledTextField
                id="text-input"
                label="분석할 텍스트를 입력하세요"
                multiline
                rows={8}
                value={text}
                onChange={(e) => setText(e.target.value)}
                variant="outlined"
                fullWidth
                placeholder="리포트의 내용을 붙여넣거나 입력해주세요..."
                inputProps={{ maxLength: 10000 }}
                sx={{ width: '100%' }}
              />
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    최소 입력: 50자 • 💡 첫 문장이 제목으로 사용됩니다
                  </Typography>
                  <Typography variant="caption" color={textLength >= 50 ? '#4caf50' : 'text.secondary'}>
                    {textLength}/10000
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={textProgress}
                  sx={{
                    borderRadius: 1,
                    height: 6,
                    background: 'rgba(102, 126, 234, 0.1)',
                    '& .MuiLinearProgress-bar': {
                      background: textLength >= 50 ? '#4caf50' : '#667eea',
                      borderRadius: 1,
                    },
                  }}
                />
              </Box>
            </Box>
          )}

          {/* 개발자 옵션 */}
          <Divider />
          <DevModeBox>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BugReportIcon sx={{ color: '#ff9800', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#ff9800' }}>
                개발자 옵션
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                  sx={{
                    color: '#ff9800',
                    '&.Mui-checked': {
                      color: '#ff9800',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    테스트 모드
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    활성화 시 문서가 저장되지 않아 표절 검사에 포함되지 않습니다
                  </Typography>
                </Box>
              }
            />
          </DevModeBox>

          {/* 에러 메시지 */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ borderRadius: 1.5, background: 'rgba(244, 67, 54, 0.05)' }}
            >
              {error}
            </Alert>
          )}

          {/* 제출 버튼 */}
          <StyledSubmitButton 
            type="submit" 
            fullWidth 
            variant="contained" 
            size="large"
            disabled={isLoading}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                분석 요청 중...
              </Box>
            ) : (
              '분석 시작하기'
            )}
          </StyledSubmitButton>

          {/* 안내 텍스트 */}
          <Typography variant="caption" color="text.secondary" align="center" sx={{ pt: 1 }}>
            분석은 최대 2-3분 정도 소요됩니다.
            {!isTest && ' ⚠️ 테스트 모드가 꺼져있어 문서가 저장됩니다.'}
          </Typography>
        </Stack>
      </form>
    </StyledPaper>
  );
}

export default AnalysisForm;