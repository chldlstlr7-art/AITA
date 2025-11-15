import axios from 'axios';

// 뭔지 몰라서 주석 - 인식 const API_URL = 'https://cautious-doodle-q75wx75gv596hx57r-5000.app.github.dev';
const API_BASE_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = () => {
  return apiClient.get('/');
};

export const register = async (email, password, role = 'student') => {
  try {
    const response = await apiClient.post('/api/auth/register', {
      email,
      password,
      role,
    });
    return response.data;
  } catch (error) {
    console.error('회원가입 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '회원가입에 실패했습니다.');
  }
};

export const verifyEmail = async (email, code) => {
  try {
    const response = await apiClient.post('/api/auth/verify-email', {
      email,
      code,
    });
    return response.data;
  } catch (error) {
    console.error('이메일 인증 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '인증 코드가 잘못되었습니다.');
  }
};

export const login = async (email, password) => {
  try {
    const response = await apiClient.post('/api/auth/login', {
      email,
      password,
    });
    
    if (response.data && response.data.access_token) {
      return response.data; 
    } else {
      throw new Error('로그인 응답이 올바르지 않습니다.');
    }
  } catch (error) {
    console.error('로그인 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '로그인에 실패했습니다.');
  }
};

export const analyzeReport = async (formData) => {
  try {
    const response = await apiClient.post('/api/student/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    console.error('분석 요청 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '분석 요청에 실패했습니다.');
  }
};

export const getReportStatus = async (reportId) => {
  try {
    const response = await apiClient.get(`/api/student/report/${reportId}`);
    return response.data;
  } catch (error) {
    console.error('리포트 조회 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '리포트 조회에 실패했습니다.');
  }
};

export const submitAnswer = async (reportId, questionId, userAnswer) => {
  try {
    const response = await apiClient.post(`/api/student/report/${reportId}/answer`, {
      question_id: questionId,
      user_answer: userAnswer,
    });
    return response.data;
  } catch (error) {
    console.error('답변 제출 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '답변 제출에 실패했습니다.');
  }
};

export const getNextQuestion = async (reportId) => {
  try {
    const response = await apiClient.post(`/api/student/report/${reportId}/question/next`);
    return response.data;
  } catch (error) {
    console.error('다음 질문 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '다음 질문 로딩에 실패했습니다.');
  }
};

export const getDeepDiveQuestion = async (reportId, parentQuestionId) => {
  try {
    const response = await apiClient.post(`/api/student/report/${reportId}/question/deep-dive`, {
      parent_question_id: parentQuestionId,
    });
    return response.data;
  } catch (error) {
    console.error('심화 질문 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '심화 질문 로딩에 실패했습니다.');
  }
};

// 🆕 발전 아이디어 조회 API (수정 - axios 사용으로 통일)
export const getAdvancementIdeas = async (reportId) => {
  try {
    console.log(`[API] Requesting advancement ideas for report: ${reportId}`);
    
    // ✅ axios의 apiClient 사용 (자동으로 interceptor에서 토큰 추가)
    const response = await apiClient.get(`/api/student/report/${reportId}/advancement`);

    console.log(`[API] Response status: ${response.status}`);
    console.log('[API] Advancement ideas received:', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('[API] getAdvancementIdeas 에러:', error);
    
    // axios 에러 구조 처리
    if (error.response) {
      // 서버가 응답했지만 에러 상태 코드
      const errorMessage = error.response.data?.error || `HTTP ${error.response.status}`;
      throw new Error(errorMessage);
    } else if (error.request) {
      // 요청은 보냈지만 응답이 없음 (네트워크 에러)
      throw new Error('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
    } else {
      // 요청 설정 중 에러 발생
      throw new Error(error.message || '요청 중 알 수 없는 오류가 발생했습니다.');
    }
  }
};

// --- API 요청 시 자동으로 토큰 추가 (활성화됨) ---
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});
