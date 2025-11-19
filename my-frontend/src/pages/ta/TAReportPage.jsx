// [파일 경로] src/pages/ta/TAReportPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getReportStatus, getAssignmentCriteria, autoGradeReport, submitTaGrade, getAssignmentDetail, getCourseDetail, getAutoGradeResult, getTaGrade } from '../../services/api.js';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Alert, 
  Backdrop,
  Paper,
  Collapse,
  Fade,
  Button,
  Container,
  Stack,
  Avatar,
  Tabs,
  Tab,
  Chip,
  LinearProgress
} from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import { 
  AutoAwesome, 
  Assessment, 
  ChatBubbleOutline,
  TipsAndUpdates,
  Summarize,
  ContentCopy,
  Description,
  Lock,
  CheckCircle,
  ArrowBackIosNew
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import ReportDisplay from '../../components/ReportDisplay.jsx';
import SimilarityAnalysis from '../../components/SimilarityAnalysis.jsx';

const POLLING_INTERVAL = 3000;

// ==================== Styled Components ====================
// ... (스타일 컴포넌트는 ReportPage와 동일) ...
const PageHeader = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  borderRadius: theme.spacing(3),
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.25)}`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    background: `radial-gradient(circle, ${alpha(theme.palette.common.white, 0.1)} 0%, transparent 70%)`,
    borderRadius: '50%',
  },
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  background: alpha(theme.palette.primary.main, 0.05),
  borderRadius: theme.spacing(2),
  padding: theme.spacing(1),
  marginBottom: theme.spacing(4),
  '& .MuiTabs-indicator': {
    height: 4,
    borderRadius: 2,
    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '1.1rem',
  minHeight: 72,
  padding: theme.spacing(2, 4),
  borderRadius: theme.spacing(1.5),
  transition: 'all 0.3s ease',
  '&:hover:not(.Mui-disabled)': {
    background: alpha(theme.palette.primary.main, 0.08),
  },
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    background: alpha(theme.palette.primary.main, 0.12),
  },
  '&.Mui-disabled': {
    opacity: 0.5,
  },
}));

const IconWrapper = styled(Avatar)(({ theme }) => ({
  width: 56,
  height: 56,
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const LoadingTabContent = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(6),
  textAlign: 'center',
  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  borderRadius: theme.spacing(3),
}));

const TabPanel = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index}>
    {value === index && (
      <Fade in timeout={500}>
        <Box>{children}</Box>
      </Fade>
    )}
  </Box>
);

// ==================== Main Component ====================

function TAReportPage() {
  const { courseId, assignmentId, reportId } = useParams();
  const location = useLocation();
  
  const [reportData, setReportData] = useState(null);
  const [courseName, setCourseName] = useState('');
  const [assignmentName, setAssignmentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [status, setStatus] = useState('processing_analysis'); 
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('AI가 리포트를 분석 중입니다...');
  const [activeTab, setActiveTab] = useState(location.state?.openTabIndex ?? 0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [taScores, setTaScores] = useState({});
  const [taComments, setTaComments] = useState('');
  const [autoGradingRunning, setAutoGradingRunning] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [autoGradeResult, setAutoGradeResult] = useState(null);
  const [autoGradeLoading, setAutoGradeLoading] = useState(false);
  const totalTaScore = criteriaRows.reduce((acc, r) => {
    const v = Number(taScores[r.key]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);

  // 각 단계별 완료 상태 (3단계 구조에 맞게 수정)
  const [step1Complete, setStep1Complete] = useState(false); // 분석 완료 (summary)
  const [step2Complete, setStep2Complete] = useState(false); // 유사도 비교 완료 (similarity_details)
  const [step3Complete, setStep3Complete] = useState(false); // QA 생성 완료 (initialQuestions)

  const navigate = useNavigate();

  // AnalysisForm에서 전달받은 제목과 제출물 형식
  const submissionTitle = location.state?.submissionTitle || '제목 없음';
  const courseFromState = location.state?.course || null;
  const assignmentFromState = location.state?.assignment || null;
  const studentFromState = location.state?.student || null;
  const userAssignmentType = location.state?.userAssignmentType;

  useEffect(() => {
    // 불러오기: 자동 채점 결과가 있으면 가져와서 보여줌
    const fetchAutoGradeResult = async () => {
      if (!reportId) return;
      setAutoGradeLoading(true);
      try {
        // 병렬로 자동채점 결과와 TA가 저장한 채점 결과를 가져온다 (있으면 프리필)
        const [autoResp, taResp] = await Promise.allSettled([
          getAutoGradeResult(reportId),
          getTaGrade(reportId),
        ]);

        if (autoResp.status === 'fulfilled') {
          setAutoGradeResult(autoResp.value || null);
        } else {
          console.warn('자동 채점 조회 실패:', autoResp.reason);
          setAutoGradeResult(null);
        }

        if (taResp.status === 'fulfilled') {
          const taData = taResp.value;
          if (taData) {
            // TA 코멘트 프리필
            if (taData.feedback) setTaComments(taData.feedback);

            // TA 점수 프리필 (criteria id -> score 매핑)
            if (taData.score_details) {
              const scoresMap = {};
              const sd = taData.score_details;
              if (Array.isArray(sd.scores)) {
                sd.scores.forEach((s) => {
                  if (s && s.criteria_id != null) scoresMap[String(s.criteria_id)] = s.score;
                });
              } else if (sd.scores && typeof sd.scores === 'object') {
                // 경우에 따라 객체 맵 형태일 수 있음
                Object.entries(sd.scores).forEach(([k, v]) => {
                  scoresMap[String(k)] = v?.score ?? v;
                });
              }

              // only set if local taScores is empty to avoid overwriting user edits
              if (Object.keys(taScores).length === 0) setTaScores(scoresMap);
            }
          }
        } else {
          console.warn('TA 채점 결과 조회 실패:', taResp.reason);
        }
      } catch (e) {
        console.warn('자동 채점 결과 조회 실패:', e);
        setAutoGradeResult(null);
      } finally {
        setAutoGradeLoading(false);
      }
    };

    // fetch when reportId changes, status changes (completed), or after autoGradingRunning stops
    fetchAutoGradeResult();
  }, [reportId, status, autoGradingRunning]);


    useEffect(() => {
    let timerId = null;

    const pollReport = async () => {
      // 🔒 완료 또는 에러 상태면 폴링 중지
      if (status === 'completed' || status === 'error') { 
        return; 
      }

      try {
        console.log(`[Polling] 현재 상태: ${status}`);
        const apiResp = await getReportStatus(reportId);
        console.log('[Polling] 서버 응답(raw):', apiResp);

        // API 응답 형태가 두 가지일 수 있음:
        // 1) { status: 'completed', data: { ...report... } }
        // 2) { status: 'completed', ...reportFields }
        const respStatus = apiResp?.status;
        let reportPayload = apiResp?.data ?? null;
        if (!reportPayload) {
          const { status: _s, ...rest } = apiResp || {};
          reportPayload = Object.keys(rest || {}).length ? rest : null;
        }

        // 🎯 상태 1: processing_analysis (분석 중)
        if (respStatus === 'processing_analysis') {
          setLoadingMessage('AI가 리포트를 분석하고 있습니다... (1/3단계)');
          setStatus('processing_analysis');
          timerId = setTimeout(pollReport, POLLING_INTERVAL);
        }

        // 🎯 상태 2: processing_comparison (유사도 비교 중)
        else if (respStatus === 'processing_comparison') {
          console.log('[Polling] ✅ 1단계 완료! summary 데이터 수신');
          if (reportPayload) setReportData(reportPayload);
          setStep1Complete(true); // 🟢 분석 탭 활성화
          setLoadingMessage('유사 문서를 비교하고 있습니다... (2/3단계)');
          setStatus('processing_comparison');

          if (activeTab === 0 && !step1Complete) {
            setActiveTab(0);
          }

          timerId = setTimeout(pollReport, POLLING_INTERVAL);
        }

        // 🎯 상태 3: processing_questions (QA 생성 중)
        else if (respStatus === 'processing_questions') {
          console.log('[Polling] ✅ 2단계 완료! similarity_details 데이터 수신');
          if (reportPayload) setReportData(reportPayload); // summary + similarity_details
          setStep1Complete(true);
          setStep2Complete(true); // 🟢 유사도 탭 활성화
          setLoadingMessage('AITA가 질문을 생성하고 있습니다... (3/3단계)');
          setStatus('processing_questions');
          timerId = setTimeout(pollReport, POLLING_INTERVAL);
        }

        // 🎯 상태 4: completed (모든 작업 완료)
        else if (respStatus === 'completed') {
          console.log('[Polling] ✅ 3단계 완료! 모든 데이터 수신');
          if (reportPayload) setReportData(reportPayload); // 모든 데이터 포함
          setStep1Complete(true);
          setStep2Complete(true);
          setStep3Complete(true); // 🟢 QA 탭 활성화
          setStatus('completed');
          setLoadingMessage('분석이 완료되었습니다!');

          // reportPayload에서 assignment id를 유연하게 추출
          try {
            const assignmentIdFromReport = reportPayload?.assignment_id ?? reportPayload?.assignment?.id ?? reportPayload?.assignmentId ?? null;
            // 학생명 보강 (report 데이터에서)
            const studentNameFromReport = reportPayload?.student_name ?? reportPayload?.student?.name ?? reportPayload?.studentName ?? null;

            if (assignmentIdFromReport) {
              // 과제/과목 정보 보강
              try {
                const aDetail = await getAssignmentDetail(assignmentIdFromReport);
                const a = aDetail.assignment || aDetail;
                const assignmentNameResolved = a?.assignment_name || a?.name || a?.title || assignmentFromState?.assignment_name || '과제명 없음';
                let courseNameResolved = a?.course_name || a?.course_title || courseFromState?.course_name || null;

                // 만약 assignment에서 course명이 없고 course_id가 있으면 추가로 조회
                if (!courseNameResolved && (a?.course_id || a?.courseId)) {
                  try {
                    const courseIdToFetch = a?.course_id ?? a?.courseId;
                    const courseDetail = await getCourseDetail(courseIdToFetch);
                    // API가 다양하게 반환할 수 있으니 여러 키를 시도
                    courseNameResolved = courseDetail?.course_name || courseDetail?.name || courseDetail?.title || courseFromState?.course_name || null;
                  } catch (errCourse) {
                    console.warn('코스 상세 조회 실패:', errCourse);
                  }
                }

                setAssignmentName(assignmentNameResolved);
                setCourseName(courseNameResolved || '과목명 없음');
              } catch (e) {
                // 실패해도 무시
                setAssignmentName(assignmentFromState?.assignment_name || '과제명 없음');
                setCourseName(courseFromState?.course_name || '과목명 없음');
              }

              setStudentName(studentNameFromReport || studentFromState?.name || '학생명 없음');

              setCriteriaLoading(true);
              const crit = await getAssignmentCriteria(assignmentIdFromReport);
              if (crit && typeof crit === 'object') {
                const rows = Object.entries(crit).map(([k, v]) => ({
                  key: k,
                  name: v?.name || '',
                  max_score: v?.max_score ?? 0,
                }));
                setCriteriaRows(rows);
              }
            } else {
              // assignment id가 없으면 학생명 정도라도 채워본다
              setStudentName(studentNameFromReport || studentFromState?.name || '학생명 없음');
            }
          } catch (e) {
            console.warn('채점 기준 로드 실패:', e);
          } finally {
            setCriteriaLoading(false);
          }
        }
        
        // 🎯 상태 5: error
        else if (response.status === 'error') {
          console.error('[Polling] ❌ 에러 발생:', response.data?.error);
          setError(response.data?.error || '분석 중 알 수 없는 오류가 발생했습니다.');
          setStatus('error');
        }
        
      } catch (err) {
        console.error('[Polling] 네트워크 에러:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    pollReport(); 

    return () => { 
      if (timerId) {
        clearTimeout(timerId);
      }
    };

  }, [reportId, status, activeTab, step1Complete]);

  const handleTabChange = (event, newValue) => {
    if (newValue === 0 && step1Complete) setActiveTab(newValue);
    if (newValue === 1 && step2Complete) setActiveTab(newValue);
    if (newValue === 2 && step3Complete) setActiveTab(newValue);
  };

  // ... (handleShowAdvancement, 에러 상태 UI는 동일) ...
  if (status === 'error') {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">분석 리포트를 불러오는 데 실패했습니다.</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      {/* 페이지 헤더 */}
      <PageHeader>
        <Stack direction="row" spacing={3} alignItems="center">
          <Button
            onClick={() => navigate(-1)}
            variant="text"
            sx={{ color: 'white', minWidth: 40, pl: 0 }}
          >
            <ArrowBackIosNew sx={{ color: 'white' }} />
          </Button>
          <IconWrapper>
            <Assessment sx={{ fontSize: 32, color: 'white' }} />
          </IconWrapper>
          <Box sx={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ color: alpha('#fff', 0.9) }}>
                  {courseName || '과목명 없음'}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
                  {assignmentName || submissionTitle || '과제명 없음'}
                </Typography>
              </Box>
              {userAssignmentType && (
                <Chip
                  label={userAssignmentType}
                  size="small"
                  sx={{
                    background: alpha('#fff', 0.25),
                    color: 'white',
                    fontWeight: 700,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha('#fff', 0.4)}`
                  }}
                />
              )}
            </Box>

            <Typography variant="body2" sx={{ color: alpha('#fff', 0.85), mt: 1 }}>
              AI가 생성한 종합 분석 리포트를 확인하세요
            </Typography>
          </Box>
        </Stack>
        {status !== 'completed' && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress 
              variant="determinate" 
              value={
                step3Complete ? 100 : 
                step2Complete ? 66 : 
                step1Complete ? 33 : 0
              }
              sx={{ 
                height: 8, 
                borderRadius: 4,
                background: alpha('#fff', 0.2),
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #4caf50 0%, #8bc34a 100%)',
                  borderRadius: 4,
                }
              }}
            />
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'white', 
                mt: 1, 
                fontWeight: 600,
                opacity: 0.9
              }}
            >
              {loadingMessage}
            </Typography>
          </Box>
        )}
      </PageHeader>

      {/* 탭 네비게이션 */}
      <StyledTabs 
        value={activeTab} 
        onChange={handleTabChange}
        variant="fullWidth"
        centered
      >
        {/* ... (탭 1, 2, 3 스타일 동일) ... */}
        <StyledTab 
          icon={
            <Stack direction="row" alignItems="center" spacing={1}>
              <Summarize sx={{ fontSize: 28 }} />
              {step1Complete && <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />}
              {!step1Complete && <Lock sx={{ fontSize: 20, opacity: 0.5 }} />}
            </Stack>
          }
          label={
            <Box>
              <Typography variant="body1" fontWeight={700}>분석 요약</Typography>
              {!step1Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중... (1/3)
                </Typography>
              )}
            </Box>
          }
          iconPosition="top"
          disabled={!step1Complete}
        />
        <StyledTab 
          icon={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ContentCopy sx={{ fontSize: 28 }} />
              {step2Complete && <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />}
              {!step2Complete && <Lock sx={{ fontSize: 20, opacity: 0.5 }} />}
            </Stack>
          }
          label={
            <Box>
              <Typography variant="body1" fontWeight={700}>유사 문서 비교</Typography>
              {!step2Complete && step1Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중... (2/3)
                </Typography>
              )}
            </Box>
          }
          iconPosition="top"
          disabled={!step2Complete}
        />
        <StyledTab 
          icon={
            <Stack direction="row" alignItems="center" spacing={1}>
              <ChatBubbleOutline sx={{ fontSize: 28 }} />
              {step3Complete && <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} />}
              {!step3Complete && <Lock sx={{ fontSize: 20, opacity: 0.5 }} />}
            </Stack>
          }
          label={
            <Box>
              <Typography variant="body1" fontWeight={700}>AI&TA 채점</Typography>
              {!step3Complete && step2Complete && (
                <Typography variant="caption" color="text.secondary">
                  처리 중... (3/3)
                </Typography>
              )}
            </Box>
          }
          iconPosition="top"
          disabled={!step3Complete}
        />
      </StyledTabs>

      {/* 🎯 탭 1: 분석 요약 */}
      <TabPanel value={activeTab} index={0}>
        {step1Complete && reportData?.summary ? (
          <ReportDisplay 
            data={reportData} 
            userAssignmentType={userAssignmentType}
            reportId={reportId} // <--- [수정] reportId를 여기에서 전달
          />
        ) : (
          <LoadingTabContent elevation={3}>
            {/* ... (로딩 UI 동일) ... */}
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 🎯 탭 2: 유사 문서 비교 */}
      <TabPanel value={activeTab} index={1}>
        {/* ... (유사도 탭 내용 동일) ... */}
        {step2Complete && reportData?.similarity_details ? (
          <SimilarityAnalysis data={reportData} />
        ) : (
          <LoadingTabContent elevation={3}>
            {/* ... (로딩 UI 동일) ... */}
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 🎯 탭 3: AI&TA 채점 */}
      <TabPanel value={activeTab} index={2}>
        {step3Complete ? (
          <Box>
            <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">제출물 원문</Typography>
                <Button
                  size="medium"
                  variant="outlined"
                  onClick={() => setShowOriginal((s) => !s)}
                >
                  {showOriginal ? '원문 숨기기' : '원문 보기'}
                </Button>
              </Stack>

              <Collapse in={showOriginal}>
                <Box sx={{ mt: 2, maxHeight: 360, overflow: 'auto' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {reportData?.text_snippet || '원문이 없습니다.'}
                  </Typography>
                </Box>
              </Collapse>
            </Paper>

            {/* 경고 문구와 AI 자동 채점 버튼을 같은 행에 배치 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: 'error.main', opacity: 0.85 }}>
                  AI 채점 결과는 참고용이며, 학생 리포트 평가 및 피드백은 TA가 직접 실시해야 합니다.
                </Typography>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={autoGradingRunning || Boolean(reportData?.auto_score_details)}
                  sx={{
                    '&.Mui-disabled': {
                      backgroundColor: 'grey.400',
                      color: 'white',
                      opacity: 1,
                    }
                  }}
                  onClick={async () => {
                    if (!reportId) return;
                    try {
                      setAutoGradingRunning(true);
                      await autoGradeReport(reportId);
                      // 폴링이 결과를 가져올 것이므로 여기서는 추가 액션을 하지 않습니다.
                    } catch (e) {
                      console.error('자동 채점 요청 실패:', e);
                      alert('자동 채점 요청에 실패했습니다: ' + (e.message || e));
                    } finally {
                      setAutoGradingRunning(false);
                    }
                  }}
                >
                  {autoGradingRunning ? '실행 중...' : (reportData?.auto_score_details ? 'AI채점 완료' : 'AI채점 실행')}
                </Button>
              </Box>
            </Box>

            {/* 채점 기준 표 */}
            <TableContainer component={Paper} sx={{ mb: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ textAlign: 'center' }}>채점 항목</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>채점 기준</TableCell>
                    <TableCell sx={{ textAlign: 'center', width: '7%' }}>배점</TableCell>
                    <TableCell sx={{ width: '45%' }}>AI 코멘트</TableCell>
                    <TableCell sx={{ width: '7%', textAlign: 'center' }}>AI 자동채점</TableCell>
                    <TableCell>TA 최종 채점</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {criteriaLoading ? (
                    <TableRow><TableCell colSpan={6}><Typography>불러오는 중...</Typography></TableCell></TableRow>
                  ) : criteriaRows && criteriaRows.length > 0 ? (
                    criteriaRows.map((row) => {
                      // AI 결과 분해: score 와 feedback 분리
                      let aiScore = '';
                      let aiComment = '';
                      const autoDetails = reportData?.auto_score_details;
                      if (autoDetails) {
                        if (Array.isArray(autoDetails.scores)) {
                          const found = autoDetails.scores.find((s) => String(s.criteria_id) === String(row.key));
                          if (found) {
                            aiScore = found.score ?? '';
                            aiComment = found.feedback ?? '';
                          }
                        } else if (autoDetails[row.key]) {
                          const v = autoDetails[row.key];
                          aiScore = v.score ?? v.value ?? '';
                          aiComment = v.feedback ?? '';
                        }
                      }

                      return (
                        <TableRow key={row.key}>
                          <TableCell sx={{ textAlign: 'center' }}>{row.key}</TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>{row.name}</TableCell>
                          <TableCell sx={{ textAlign: 'center', width: '7%' }}>{row.max_score}</TableCell>
                          <TableCell sx={{ width: '45%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {aiComment ? (
                              <Typography component="div" variant="body2">{aiComment}</Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell sx={{ width: '7%', textAlign: 'center', verticalAlign: 'middle' }}>
                            {aiScore !== '' ? (
                              <Typography component="div" sx={{ fontWeight: 800 }}>{String(aiScore)}</Typography>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ min: 0, max: row.max_score }}
                              value={taScores[row.key] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTaScores((prev) => ({ ...prev, [row.key]: v }));
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color="text.secondary">채점 기준이 없습니다.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {/* TA 점수 합계 행 */}
                  <TableRow>
                    <TableCell colSpan={4} sx={{ textAlign: 'right', pr: 2 }}>
                      <Typography fontWeight={700}>TA 채점 합계</Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>-</TableCell>
                    <TableCell>
                      <Typography fontWeight={900}>{totalTaScore}</Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            {/* AI 종합 코멘트 (자동채점 API의 overall_feedback) */}
            {(autoGradeResult?.overall_feedback || reportData?.auto_score_details?.overall_feedback) && (
              <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
                <Typography variant="h6" sx={{ mb: 1 }}>AI 종합 코멘트</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {autoGradeResult?.overall_feedback ?? reportData?.auto_score_details?.overall_feedback}
                </Typography>
              </Paper>
            )}

            {/* TA 코멘트 입력 칸 */}
            <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
              <Typography variant="h6" sx={{ mb: 1 }}>TA 코멘트</Typography>
              <TextField
                placeholder="채점 코멘트(학생에게 전달될 코멘트 또는 내부 메모)를 입력하세요..."
                multiline
                minRows={4}
                maxRows={8}
                fullWidth
                value={taComments}
                onChange={(e) => setTaComments(e.target.value)}
              />
            </Paper>
            {/* 채점 결과 저장 버튼 */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <Button
                size="large"
                variant="contained"
                color="success"
                disabled={savingGrade}
                sx={{ fontWeight: 700 }}
                onClick={async () => {
                  if (!reportId) return;
                  try {
                    setSavingGrade(true);
                    const payload = {
                      feedback: taComments || '',
                      score_details: {
                        scores: criteriaRows.map((r) => ({
                          criteria_id: r.key,
                          score: Number(taScores[r.key]) || 0,
                        })),
                        total: Number(totalTaScore) || 0,
                      },
                    };

                    await submitTaGrade(reportId, payload);
                    alert('채점 결과가 저장되었습니다.');

                    // 새로 저장된 정보를 불러와 화면 갱신
                    try {
                      const refreshed = await getReportStatus(reportId);
                      if (refreshed && refreshed.data) setReportData(refreshed.data);
                    } catch (e) {
                      console.warn('저장 후 리포트 갱신 실패:', e);
                    }
                  } catch (e) {
                    console.error('채점 저장 실패:', e);
                    alert('채점 저장에 실패했습니다: ' + (e.message || e));
                  } finally {
                    setSavingGrade(false);
                  }
                }}
              >
                {savingGrade ? '저장 중...' : '채점 결과 저장'}
              </Button>
            </Box>
            {/* 채점 종합 관리로 이동 버튼 */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
              <Button
                size="medium"
                variant="outlined"
                onClick={() => {
                  // course 정보를 가능한 경우 전달
                  const courseState = courseFromState || (courseId ? { id: courseId, course_name: courseName } : null);
                  navigate(`/ta/course/${courseId}/grading`, { state: { course: courseState } });
                }}
              >
                채점 종합 관리로 이동
              </Button>
            </Box>
          </Box>
        ) : (
          <LoadingTabContent elevation={3}>
            {/* ... (로딩 UI 동일) ... */}
          </LoadingTabContent>
        )}
      </TabPanel>

      {/* 우측 하단 발전 아이디어 버튼 제거됨 */}
    </Container>
  );
}

export default TAReportPage;
