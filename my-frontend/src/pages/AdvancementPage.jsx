import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Breadcrumbs,
  Link,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Fade,
  Slide,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Autocomplete, // 👈 추가
  TextField,    // 👈 추가
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  Description as DescriptionIcon,
  NavigateNext as NavigateNextIcon,
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
  TipsAndUpdates as TipsIcon,
  Send as SubmitIcon,
  CheckCircle as SuccessIcon,
  PersonSearch as PersonSearchIcon, // 👈 아이콘 추가
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { 
  getReportStatus, 
  requestAdvancementIdeas,
  submitReportToAssignment,
  getStudentCourseAssignments,
  getStudentDashboard,
  getTaCourses,       // 👈 추가: 학생 목록 구하기용
  getCourseStudents,  // 👈 추가: 학생 목록 구하기용
  getAssignmentsByCourse, // 👈 추가: 개발자용 과제 조회용
} from '../services/api';
import { loadDeepAnalysis } from '../services/deepAnalysisStore';

import AdvancementActions from '../components/AdvancementActions';

// ==================== Constants ====================

// 🔥 개발자 이메일 목록 (Header.js와 동일)
const DEV_EMAILS = [
  "dabok2@snu.ac.kr",
  "dev2@snu.ac.kr",
  "dev3@snu.ac.kr",
  "dev@snu.ac.kr"
];

const POLLING_INTERVAL = 3000;
const MAX_POLLING_ATTEMPTS = 60;

// 🎬 [DEMO] 데모용 리포트 ID 및 발전 아이디어
const DEMO_REPORT_ID = '8d3adadf-9af0-4d19-a43e-0a50ae7b1c09';
const DEMO_ADVANCEMENT_IDEAS = [
  {
    "idea": "단순 입시 홍보를 넘어, 고교생이 미리 전공 적성을 확인하고 정보를 얻을 수 있는 '오픈 캠퍼스(전공 체험)'를 운영해보는 건 어떨까요?",
    "evidence": [
      {
        "q": "대학의 진로 프로그램으로 정보 격차 해소가 가능하다면 왜 리포트에선 이를 배제했나요?",
        "a": "현 시스템상 고등학생이 대학 프로그램에 사전 접근하기 어려운 구조적 한계가 있음"
      }
    ]
  },
  {
    "idea": "경직된 전공 체계를 보완하기 위해 복수전공·융합전공 확대와 현장 연계 학습 프로그램 활성화를 통한 다각적 진로 탐색 경로를 설계해보는 건 어떨까요?",
    "evidence": [
      {
        "q": "전공 변경의 어려움 때문에 진로 탐색이 제한된다고 했는데, 다른 방식의 탐색 기회는 없을까요?",
        "a": "복수전공 허용 확대 등으로 유연한 역량 계발 경로가 필요하다"
      },
      {
        "q": "전공 외 분야 탐색 차단을 극복하려면 어떤 정책이 필요한가요?",
        "a": "현장 실습·인턴십 제도화로 실질적인 직업 체험 기회 제공이 요구됨"
      }
    ]
  },
  {
    "idea": "'AI 기반 맞춤형 진로 컨설팅 시스템' 구축을 통해 정보 비대칭성 문제의 기술적 해결책을 탐색해보는 것은 어떨까요?",
    "evidence": [
      {
        "q": "제한된 정보로 전공 선택 오류가 발생한다는 문제의 구체적 해결 방안은?",
        "a": "빅데이터 분석을 통한 개인별 성향·시장 수요 매칭 서비스 개발 필요"
      }
    ]
  }
];

// ==================== Styled Components ====================

const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(6),
}));

const HeaderPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginBottom: theme.spacing(3),
  background: 'white',
  borderRadius: theme.spacing(3),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  background: 'white',
  borderRadius: theme.spacing(3),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
}));

const StyledAccordion = styled(Accordion)(({ theme }) => ({
  borderRadius: `${theme.spacing(2)} !important`,
  overflow: 'hidden',
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  marginBottom: theme.spacing(2),
  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.06)}`,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:before': { display: 'none' },
  '&:hover': {
    boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
    transform: 'translateY(-2px)',
  },
  '&.Mui-expanded': {
    margin: `${theme.spacing(2)} 0`,
    boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
}));

const LoadingBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8),
  gap: theme.spacing(3),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
  borderRadius: theme.spacing(3),
  border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
}));

const IdeaChip = styled(Chip)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  color: 'white',
  fontWeight: 700,
  minWidth: 36,
  height: 36,
  fontSize: '0.875rem',
  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const EvidenceBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
  borderRadius: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '4px',
    height: '100%',
    background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  },
}));

const PageTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 800,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginBottom: theme.spacing(1),
}));

const integrityTypeKoMap = {
  Ambiguity: '모호한 표현',
  Overgeneralization: '성급한 일반화',
  Logical_Leap: '논리적 비약',
  'Logical Leap': '논리적 비약',
  Lack_of_Evidence: '구체적 증거 부재',
  'Lack of Evidence': '구체적 증거 부재'
};

// ==================== Main Component ====================

function AdvancementPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  
  const [reportData, setReportData] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  // 🔥 과제 제출 다이얼로그 관련 상태
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // 🔥 개발자용 학생 선택 상태
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [studentList, setStudentList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null); // 개발자가 선택한 학생
  const [loadingStudentList, setLoadingStudentList] = useState(false);

  const pollingTimerRef = useRef(null);
  const [deepAnalysis, setDeepAnalysis] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState(null);
  // 로컬 스토어에 심화분석이 있는지 여부
  const [storeHasDeepAnalysis, setStoreHasDeepAnalysis] = useState(false);

  // 현재 사용자 이메일 확인
  const getCurrentUserEmail = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return '';
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email || '';
    } catch {
        return '';
    }
  };

  // 현재 사용자 ID 가져오기
  const getUserId = () => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    let userId = userData.user_id || userData.id;
    if (!userId) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.sub || payload.user_id || payload.id;
        } catch (e) { }
      }
    }
    return userId;
  };
  
  const currentStudentId = getUserId();

  // 초기 로드 및 권한 확인
  useEffect(() => {
    const email = getCurrentUserEmail();
    if (DEV_EMAILS.includes(email)) {
      setIsDeveloper(true);
    }

    const fetchReportData = async () => {
      try {
        setLoading(true);
        const response = await getReportStatus(reportId);
        
        if (response.status === 'completed' || response.status === 'processing_questions') {
          setReportData(response.data);
          
          // 🎬 [DEMO] 데모 리포트일 경우 하드코딩된 발전 아이디어 사용
          if (reportId === DEMO_REPORT_ID) {
            setIdeas(DEMO_ADVANCEMENT_IDEAS);
          } else if (response.data?.advancement_ideas) {
            const parsed = typeof response.data.advancement_ideas === 'string'
              ? JSON.parse(response.data.advancement_ideas)
              : response.data.advancement_ideas;
            setIdeas(parsed);
          } else {
            handleGenerateIdeas();
          }
        } else {
          setError('리포트 분석이 아직 완료되지 않았습니다.');
        }
      } catch (err) {
        console.error('[AdvancementPage] 리포트 조회 실패:', err);
        setError(err.message || '리포트를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      fetchReportData();
    }

    return () => {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, [reportId]);

  // ... (폴링 및 아이디어 생성 로직은 기존과 동일)
  // --- 심화 분석: 로컬 캐시(한 번만 읽기) ---
  const fetchDeepAnalysis = async (isRetry = false) => {
    if (!reportId) return;
    try {
      setDeepLoading(true);
      setDeepError(null);

      // 1) 우선 로컬스토리지 캐시 확인
      const cached = loadDeepAnalysis(reportId);
      if (cached) {
        setDeepAnalysis(cached);
        setStoreHasDeepAnalysis(true);
        setDeepLoading(false);
        return;
      }

      // 2) reportData 내부에 이미 포함된 경우 사용
      const existing = reportData?.neuron_map || reportData?.deep_analysis || reportData?.deep_analysis_result || reportData?.logic_analysis || null;
      if (existing) {
        // reportData에 포함된 결과는 있더라도, 로컬 스토어에 값이 없으면
        // 사용자의 요청에 따라 요약 전체를 숨기기 위해 store flag는 false로 둠
        setDeepAnalysis(existing);
        setStoreHasDeepAnalysis(false);
        setDeepLoading(false);
        return;
      }

      // 3) 캐시/리포트 모두 없으면 사용자에게 안내
      setDeepAnalysis(null);
      setStoreHasDeepAnalysis(false);
      setDeepError('심화 분석 데이터가 로컬에 없습니다. LogicNeuron 페이지에서 분석을 실행한 후 다시 시도하세요.');
      setDeepLoading(false);
    } catch (err) {
      setDeepError(err.message || '심화 분석 조회 중 오류가 발생했습니다.');
      setDeepLoading(false);
    }
  };

  useEffect(() => {
    if (!reportId) return;
    // 항상 로컬 스토어 우선 확인 (store 유무에 따라 요약 표시 여부 결정)
    fetchDeepAnalysis();
  }, [reportId, reportData]);
  const pollForIdeas = async () => {
    try {
      const response = await getReportStatus(reportId);
      const advancementIdeas = response.data?.advancement_ideas;
      if (advancementIdeas) {
        const parsed = typeof advancementIdeas === 'string' ? JSON.parse(advancementIdeas) : advancementIdeas;
        setIdeas(parsed);
        setIsGenerating(false);
        clearTimeout(pollingTimerRef.current);
      } else {
        setPollingAttempts(prev => prev + 1);
        if (pollingAttempts + 1 >= MAX_POLLING_ATTEMPTS) {
          setError('아이디어 생성 시간이 초과되었습니다.');
          setIsGenerating(false);
        } else {
          pollingTimerRef.current = setTimeout(pollForIdeas, POLLING_INTERVAL);
        }
      }
    } catch (err) {
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const handleGenerateIdeas = async () => {
    try {
      setIsGenerating(true);
      setError('');
      setPollingAttempts(0);
      const response = await requestAdvancementIdeas(reportId);
      if (response.status === 'processing') {
        pollingTimerRef.current = setTimeout(pollForIdeas, POLLING_INTERVAL);
      } else if (response.status === 'completed' && response.data) {
        setIdeas(response.data);
        setIsGenerating(false);
      } else if (Array.isArray(response)) {
        setIdeas(response);
        setIsGenerating(false);
      }
    } catch (err) {
      setError(err.message || '아이디어 생성에 실패했습니다.');
      setIsGenerating(false);
    }
  };

  const handleBack = () => navigate(`/report/${reportId}`);
  const handleNewReport = () => navigate('/');
  const handleViewDashboard = () => {
    if (currentStudentId) navigate(`/dashboard/${currentStudentId}`);
    else setSnackbar({ open: true, message: '로그인 정보를 찾을 수 없습니다.', severity: 'error' });
  };

  // 🔥 [개발자용] 모든 학생 목록 불러오기 (Header.js 전략 재사용)
  const fetchAllStudents = async () => {
    try {
      setLoadingStudentList(true);
      const coursesData = await getTaCourses();
      const courses = Array.isArray(coursesData) ? coursesData : (coursesData.courses || []);
      
      if (courses.length === 0) {
        setStudentList([]);
        return;
      }

      const studentPromises = courses.map(course => 
        getCourseStudents(course.course_id || course.id)
          .then(res => ({ students: Array.isArray(res) ? res : (res.students || []) }))
          .catch(() => ({ students: [] }))
      );

      const results = await Promise.all(studentPromises);
      const allStudents = results.flatMap(r => r.students);

      // 중복 제거
      const uniqueStudentsMap = new Map();
      allStudents.forEach(student => {
        if (student && student.id) uniqueStudentsMap.set(student.id, student);
      });

      setStudentList(Array.from(uniqueStudentsMap.values()));
    } catch (err) {
      console.error('학생 목록 로드 실패:', err);
      setSnackbar({ open: true, message: '학생 목록을 불러오지 못했습니다.', severity: 'error' });
    } finally {
      setLoadingStudentList(false);
    }
  };

  // 🔥 과제 제출 다이얼로그 열기 (로직 수정됨)
  const handleOpenSubmitDialog = async () => {
    setSubmitDialogOpen(true);
    setCourses([]);
    setSelectedCourseId('');
    setAssignments([]);
    setSelectedAssignmentId('');
    setSelectedStudent(null);

    // 개발자라면 학생 목록을 먼저 불러옴
    if (isDeveloper) {
      await fetchAllStudents();
    } else {
      // 일반 학생은 본인의 과목 로드
      await loadCoursesForStudent(currentStudentId);
    }
  };

  // 🔥 특정 학생의 수강 과목 로드
  const loadCoursesForStudent = async (studentId) => {
    if (!studentId) return;
    try {
      setLoadingCourses(true);
      const dashboardData = await getStudentDashboard(studentId);
      
      // dashboardData.courses는 [{course_id:..., course_name:...}, ...] 형태
      const coursesData = dashboardData.courses || [];
      setCourses(coursesData);
      
    } catch (err) {
      console.error('과목 로드 실패:', err);
      setSnackbar({ open: true, message: '해당 학생의 과목 정보를 불러오지 못했습니다.', severity: 'error' });
    } finally {
      setLoadingCourses(false);
    }
  };

  // 🔥 [개발자용] 학생 선택 핸들러
  const handleStudentSelect = async (student) => {
    setSelectedStudent(student);
    setSelectedCourseId('');
    setAssignments([]);
    setSelectedAssignmentId('');
    
    if (student) {
      await loadCoursesForStudent(student.id);
    } else {
      setCourses([]);
    }
  };

  // 🔥 과목 선택 핸들러
  const handleCourseSelect = async (courseId) => {
    try {
      setSelectedCourseId(courseId);
      setSelectedAssignmentId('');
      setAssignments([]);
      
      if (!courseId) return;
      
      setLoadingAssignments(true);
      
      let response = [];
      if (isDeveloper) {
         // 개발자는 TA API로 모든 과제 조회 (수강생 체크 우회)
         const res = await getAssignmentsByCourse(courseId);
         response = Array.isArray(res) ? res : (res.assignments || []);
      } else {
         // 학생은 본인 수강 과목의 과제만 조회
         response = await getStudentCourseAssignments(courseId);
      }
      
      setAssignments(response || []);
      
    } catch (err) {
      console.error('과제 목록 조회 실패:', err);
      setSnackbar({ open: true, message: '과제 목록을 불러오지 못했습니다.', severity: 'error' });
    } finally {
      setLoadingAssignments(false);
    }
  };

  // 🔥 과제 제출 핸들러
  const handleSubmitToAssignment = async () => {
    if (!selectedAssignmentId) return;
    
    try {
      setSubmitting(true);
      // submitReportToAssignment API는 현재 로그인한 사용자의 토큰을 사용함.
      // 개발자(Admin)가 제출할 때는 백엔드에서 권한이 열려있어야 함 (이전 수정사항 적용됨).
      // 만약 report 소유자와 제출자가 다를 경우 백엔드에서 처리됨.
      await submitReportToAssignment(reportId, selectedAssignmentId);
      
      setSnackbar({ open: true, message: '과제가 성공적으로 제출되었습니다!', severity: 'success' });
      setSubmitDialogOpen(false);
      
      // 제출 후 해당 학생의 대시보드로 이동 (선택)
      setTimeout(() => {
        const targetId = selectedStudent ? selectedStudent.id : currentStudentId;
        navigate(`/dashboard/${targetId}`);
      }, 1500);
      
    } catch (err) {
      console.error('제출 실패:', err);
      setSnackbar({ open: true, message: err.message || '과제 제출에 실패했습니다.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // 렌더링 헬퍼들 생략 (renderEvidence, Loading, Error 등 기존 유지)
  const renderEvidence = (evidence) => {
    if (!evidence) return '근거 정보가 없습니다.';
    if (typeof evidence === 'string') return evidence;
    if (typeof evidence === 'object') {
      if (Array.isArray(evidence)) {
        return evidence.map((item) => {
          if (typeof item === 'string') return item;
          if (item.q && item.a) return `Q: ${item.q}\nA: ${item.a}`;
          return JSON.stringify(item);
        }).join('\n\n');
      }
      if (evidence.q && evidence.a) return `Q: ${evidence.q}\nA: ${evidence.a}`;
      return JSON.stringify(evidence, null, 2);
    }
    return String(evidence);
  };

  // --- 심화 분석(Logic Neuron) 데이터 추출 헬퍼 ---
  const getDeepAnalysis = () => {
    // 다양한 키를 시도해 deep analysis 결과를 찾아 반환
    // 우선 state에서 가져오고, 없으면 reportData 내부 키를 확인
    if (deepAnalysis) return deepAnalysis;
    return (
      reportData?.neuron_map ||
      reportData?.deep_analysis ||
      reportData?.deep_analysis_result ||
      reportData?.logic_analysis ||
      null
    );
  };

  const renderEdgeIssuesSummary = (deep) => {
    const map = deep?.neuron_map || deep;
    if (!map) {
      return (<Typography variant="body2" color="text.secondary">연결 이슈/제안 데이터가 없습니다.</Typography>);
    }

    const nodeLabel = {};
    (map.nodes || []).forEach(n => { nodeLabel[n.id] = n.label || n.id; });

    const issues = [];
    
    // 1) edges 배열 처리 (questionable, check, forced 타입)
    if (Array.isArray(map.edges)) {
      map.edges.forEach(e => {
        const isSpark = e.type === 'questionable';
        const isCheck = e.type === 'check' || e.type === 'forced';
        if (!isSpark && !isCheck) return;
        
        const source = nodeLabel[e.source] || e.source;
        const target = nodeLabel[e.target] || e.target;
        
        // creative_feedbacks에서 해당 edge의 피드백 찾기
        let feedback = null;
        if (isSpark && Array.isArray(map.creative_feedbacks)) {
          feedback = map.creative_feedbacks.find(cf => 
            cf.concepts && 
            cf.concepts.length === 2 &&
            cf.concepts.includes(e.source) && 
            cf.concepts.includes(e.target)
          );
        }
        
        const isCreative = feedback?.judgment === 'Creative';
        const reason = feedback?.reason || e.reason || e.description || '';
        const feedbackText = feedback?.feedback || '';
        
        issues.push({ 
          id: `edge-${e.source}-${e.target}`, 
          source, 
          target, 
          reason,
          feedback: feedbackText,
          type: isSpark ? (isCreative ? '창의적 사고' : '비약 의심') : '비약 의심',
          edgeType: e.type,
          isCreative,
          details: e.details || e.content || ''
        });
      });
    }
    
    // 2) suggestions 배열 처리 (개념 연결 제안)
    if (Array.isArray(map.suggestions)) {
      map.suggestions.forEach((s, idx) => {
        const source = nodeLabel[s.target_node] || s.target_node || '?';
        const target = nodeLabel[s.partner_node] || s.partner_node || '?';
        const suggestionText = typeof s.suggestion === 'string' 
          ? s.suggestion 
          : (s.suggestion?.socratic_guide || s.suggestion?.question || s.suggestion?.description || '');
        
        issues.push({
          id: `suggestion-${idx}`,
          source,
          target,
          reason: '',
          feedback: suggestionText,
          type: '개념 연결 제안',
          edgeType: 'suggestion',
          isCreative: false,
          details: ''
        });
      });
    }

    if (issues.length === 0) {
      return (<Typography variant="body2" color="text.secondary">특이 연결이 감지되지 않았습니다.</Typography>);
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {issues.map(it => (
          <Paper 
            key={it.id} 
            elevation={0} 
            sx={{ 
              p: 2, 
              borderRadius: 1.5, 
              bgcolor: 'background.paper', 
              borderLeft: `4px solid ${
                it.isCreative ? '#9c27b0' : 
                it.edgeType === 'suggestion' ? '#2196f3' : 
                '#ff9800'
              }` 
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Chip 
                label={it.type} 
                size="small" 
                sx={{ 
                  height: 20, 
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  bgcolor: it.isCreative ? alpha('#9c27b0', 0.1) : 
                           it.edgeType === 'suggestion' ? alpha('#2196f3', 0.1) :
                           alpha('#ff9800', 0.1),
                  color: it.isCreative ? '#9c27b0' : 
                         it.edgeType === 'suggestion' ? '#2196f3' :
                         '#ff9800'
                }} 
              />
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {it.source} → {it.target}
            </Typography>
            {it.reason && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                <strong>이유:</strong> {it.reason}
              </Typography>
            )}
            {it.feedback && (
              <Typography variant="body2" color="text.primary" sx={{ mb: 0.5, fontWeight: 500 }}>
                💡 {it.feedback}
              </Typography>
            )}
            {it.details && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {it.details}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    );
  };

  const renderIntegritySummary = (deep) => {
    const issues = deep?.integrity_issues || deep?.integrity || null;
    if (!issues) return (<Typography variant="body2" color="text.secondary">문장 정합성 검사 결과가 없습니다.</Typography>);
    if (!Array.isArray(issues) || issues.length === 0) return (<Typography variant="body2" color="text.secondary">문장 정합성 문제는 발견되지 않았습니다.</Typography>);

    return (
        <Stack spacing={1}>
          {issues.map((it, i) => {
            const displayType = integrityTypeKoMap[it.type] || it.type || '';
            return (
              <Paper key={i} elevation={0} sx={{ p:1.25, borderRadius:1.5, bgcolor: (theme) => theme.palette.background.paper, borderLeft: `4px solid ${(theme) => theme.palette.primary.main}` }}>
                {it.quote && <Typography variant="body2" sx={{ fontStyle:'italic', color: (theme) => theme.palette.primary.main, fontWeight:700 }}>&quot;{it.quote}&quot;</Typography>}
                <Typography variant="caption" color="text.secondary">{(displayType || it.reason) ? `${displayType}${it.reason ? ' - ' + it.reason : ''}` : '세부 정보 없음'}</Typography>
              </Paper>
            );
          })}
        </Stack>
    );
  };

  const renderFlowSummary = (deep) => {
    const flows = deep?.flow_disconnects || deep?.flows || null;
    if (!flows) return (<Typography variant="body2" color="text.secondary">논리 흐름 검사 결과가 없습니다.</Typography>);
    if (!Array.isArray(flows) || flows.length === 0) return (<Typography variant="body2" color="text.secondary">논리 흐름에 문제는 없습니다.</Typography>);

    return (
      <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
        {flows.map((f, idx) => (
          <Paper key={idx} elevation={0} sx={{ p:1.25, borderRadius:1.5, bgcolor: (theme) => theme.palette.background.paper, borderLeft: `4px solid ${ (theme) => theme.palette.secondary.main }` }}>
            <Typography variant="subtitle2" sx={{ fontWeight:700 }}>{(f.parent_id || f.from || '?')} → {(f.child_id || f.to || '?')}</Typography>
            {f.quote && <Typography variant="body2" color="text.secondary" sx={{ fontStyle:'italic' }}>"{f.quote}"</Typography>}
            {f.reason && <Typography variant="caption" color="text.secondary">{f.reason}</Typography>}
          </Paper>
        ))}
      </Box>
    );
  };

  if (loading) {
    return (
      <PageContainer>
        <Container maxWidth="lg">
          <LoadingBox sx={{ mt: 4, minHeight: '60vh' }}>
            <CircularProgress size={60} sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>리포트 데이터를 불러오는 중...</Typography>
          </LoadingBox>
        </Container>
      </PageContainer>
    );
  }

  if (error && !isGenerating) {
    return (
      <PageContainer>
        <Container maxWidth="lg">
          <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>
          <Box mt={2} textAlign="center">
            <Button variant="contained" onClick={handleBack}>리포트로 돌아가기</Button>
          </Box>
        </Container>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Container maxWidth="lg">
        {/* 헤더 영역 (기존과 동일) */}
        <Fade in timeout={600}>
          <HeaderPaper elevation={0}>
            <Box display="flex" alignItems="center" gap={2}>
              <IconButton onClick={handleBack} sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) }}>
                <ArrowBackIcon />
              </IconButton>
              <Box flex={1}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1.5 }}>
                  <Link underline="hover" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'text.secondary' }} onClick={() => navigate('/')}>
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />대시보드
                  </Link>
                  <Link underline="hover" sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'text.secondary' }} onClick={handleBack}>
                    <DescriptionIcon sx={{ mr: 0.5 }} fontSize="small" />리포트
                  </Link>
                  <Typography color="primary" sx={{ fontWeight: 600 }}>발전 아이디어</Typography>
                </Breadcrumbs>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ width: 56, height: 56, borderRadius: 2, background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TipsIcon sx={{ fontSize: 32, color: 'white' }} />
                  </Box>
                  <Box>
                    <PageTitle variant="h4">발전 아이디어</PageTitle>
                    {reportData?.report_title && <Typography variant="body2" color="text.secondary">{reportData.report_title}</Typography>}
                  </Box>
                </Box>
              </Box>
            </Box>
          </HeaderPaper>
        </Fade>

        {/* 콘텐츠 영역 (기존과 동일) */}
        <Slide direction="up" in timeout={800}>
          <ContentPaper elevation={0}>
            {isGenerating && (
              <LoadingBox>
                <CircularProgress size={60} sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>AI가 발전 아이디어를 생성하고 있습니다</Typography>
                <Typography variant="body2" color="text.secondary">리포트 내용과 대화 기록을 분석 중입니다</Typography>
              </LoadingBox>
            )}

            {ideas && !isGenerating && (
              <Box>
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>AI 발전 아이디어</Typography>
                  <Typography variant="body2" color="text.secondary">총 {ideas.length}개의 아이디어가 생성되었습니다</Typography>
                </Box>
                <Stack spacing={2.5}>
                  {ideas.map((item, index) => (
                    <Fade in key={index} timeout={600 + index * 100}>
                      <StyledAccordion elevation={0}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1.5 }}>
                          <IdeaChip label={index + 1} />
                          <Box flex={1} ml={2}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <LightbulbIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>{item.idea || '아이디어'}</Typography>
                            </Stack>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 3, pb: 3 }}>
                          <EvidenceBox>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>근거</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>{renderEvidence(item.evidence)}</Typography>
                          </EvidenceBox>
                        </AccordionDetails>
                      </StyledAccordion>
                    </Fade>
                  ))}
                </Stack>
              </Box>
            )}
            {/* --- 심화 분석 요약 (연결 이슈 / 문장 정합성 / 논리 흐름) --- */}
            {ideas && !isGenerating && storeHasDeepAnalysis && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>심화 분석 요약</Typography>

                {/* 상태 표시 + 재조회 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {deepLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">심화 분석 불러오는 중...</Typography>
                    </Box>
                  ) : deepError ? (
                    <Alert severity="warning" sx={{ py: 0.5 }}>{deepError}</Alert>
                  ) : (
                    <Typography variant="body2" color="text.secondary">심화 분석 결과를 표시합니다.</Typography>
                  )}

                  <Box sx={{ flex: 1 }} />
                  <Button size="small" onClick={() => { setDeepError(null); fetchDeepAnalysis(true); }} disabled={deepLoading}>
                    재조회
                  </Button>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                  <Paper sx={{ p:2, borderRadius:2 }} elevation={0}>
                    <Typography variant="subtitle1" sx={{ fontWeight:700, color: 'primary.main', mb: 1 }}>연결 이슈/제안</Typography>
                    {renderEdgeIssuesSummary(getDeepAnalysis())}
                  </Paper>

                  <Paper sx={{ p:2, borderRadius:2 }} elevation={0}>
                    <Typography variant="subtitle1" sx={{ fontWeight:700, color: 'primary.main', mb: 1 }}>문장 정합성 검사</Typography>
                    {renderIntegritySummary(getDeepAnalysis())}
                  </Paper>

                  <Paper sx={{ p:2, borderRadius:2 }} elevation={0}>
                    <Typography variant="subtitle1" sx={{ fontWeight:700, color: 'primary.main', mb: 1 }}>논리 흐름 검사</Typography>
                    {renderFlowSummary(getDeepAnalysis())}
                  </Paper>
                </Box>
              </Box>
            )}
          </ContentPaper>
        </Slide>

        {/* 하단 액션 버튼 */}
        {ideas && !isGenerating && (
          <AdvancementActions
            onNewReport={handleNewReport}
            onViewDashboard={handleViewDashboard}
            onSubmit={handleOpenSubmitDialog}
            studentId={currentStudentId} 
            reportId={reportId}
          />
        )}
      </Container>

      {/* 🔥 과제 제출 다이얼로그 (수정됨) */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => !submitting && setSubmitDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'visible' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.5rem' }}>
          <Box display="flex" alignItems="center" gap={1}>
             {isDeveloper ? <PersonSearchIcon color="primary" /> : <SubmitIcon color="primary" />}
             {isDeveloper ? '학생 대리 제출' : '과제 제출'}
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2, minHeight: '300px' }}>
          <Box sx={{ mt: 1 }}>
            {/* 🚀 [개발자용] 학생 선택 섹션 */}
            {isDeveloper && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: bold => 700 }}>
                  1. 학생 선택 (개발자 전용)
                </Typography>
                <Autocomplete
                  options={studentList}
                  loading={loadingStudentList}
                  getOptionLabel={(option) => `${option.name || '이름없음'} (${option.email})`}
                  value={selectedStudent}
                  onChange={(event, newValue) => handleStudentSelect(newValue)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="학생 검색 (이름/이메일)" 
                      variant="outlined" 
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <React.Fragment>
                            {loadingStudentList ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </React.Fragment>
                        ),
                      }}
                    />
                  )}
                  noOptionsText="학생을 찾을 수 없습니다."
                />
                {!selectedStudent && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                    * 먼저 학생을 선택해야 과목 목록이 로드됩니다.
                  </Typography>
                )}
              </Box>
            )}

            {/* 과목 선택 */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="course-select-label">과목 선택</InputLabel>
              <Select
                labelId="course-select-label"
                value={selectedCourseId}
                onChange={(e) => handleCourseSelect(e.target.value)}
                label="과목 선택"
                disabled={loadingCourses || submitting || (isDeveloper && !selectedStudent)}
              >
                {loadingCourses ? (
                  <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} />로딩 중...</MenuItem>
                ) : courses.length === 0 ? (
                  <MenuItem disabled>수강 중인 과목이 없습니다</MenuItem>
                ) : (
                  courses.map((course) => (
                    <MenuItem key={course.course_id || course.id} value={course.course_id || course.id}>
                      {course.course_code} - {course.course_name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* 과제 선택 */}
            {selectedCourseId && (
              <FormControl fullWidth>
                <InputLabel id="assignment-select-label">과제 선택</InputLabel>
                <Select
                  labelId="assignment-select-label"
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  label="과제 선택"
                  disabled={loadingAssignments || submitting}
                >
                  {loadingAssignments ? (
                    <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }} />로딩 중...</MenuItem>
                  ) : assignments.length === 0 ? (
                    <MenuItem disabled>등록된 과제가 없습니다</MenuItem>
                  ) : (
                    assignments.map((assignment) => (
                      <MenuItem key={assignment.id} value={assignment.id}>
                        {assignment.assignment_name}
                        {assignment.due_date && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            (마감: {new Date(assignment.due_date).toLocaleDateString()})
                          </Typography>
                        )}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}

            {/* 제출 확인 메시지 */}
            {selectedCourseId && selectedAssignmentId && (
              <Alert severity="info" icon={<SuccessIcon />} sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>제출 준비 완료</Typography>
                <Typography variant="caption" color="text.secondary">
                  {isDeveloper && selectedStudent 
                    ? <strong>[{selectedStudent.name}]</strong> 
                    : "선택한"} 학생의 과제에 리포트를 제출합니다.
                </Typography>
              </Alert>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setSubmitDialogOpen(false)} disabled={submitting} sx={{ fontWeight: 600 }}>취소</Button>
          <Button 
            onClick={handleSubmitToAssignment}
            variant="contained"
            disabled={!selectedAssignmentId || submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : <SubmitIcon />}
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2, fontWeight: 600 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}

export default AdvancementPage;