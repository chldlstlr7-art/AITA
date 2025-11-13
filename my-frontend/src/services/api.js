import axios from 'axios';
const API_URL = 'https://cautious-doodle-q75wx75gv596hx57r-5000.app.github.dev';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = () => {
  return apiClient.get('/');
};

// --- 회원가입 API 함수 ---
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

// --- 로그인 API 함수 ---
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

export const requestLoginCode = async (email) => {
  try {
    // POST /api/auth/request-login-code
    const response = await apiClient.post('/api/auth/request-login-code', { email });
    return response.data; // (성공 시 { message: "..." } 반환)
  } catch (error) {
    console.error('OTP 코드 요청 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '인증 코드 요청에 실패했습니다.');
  }
};

// --- [신규!] (Phase 7) OTP: 인증 코드 검증 ---
export const verifyLoginCode = async (email, code) => {
  try {
    // POST /api/auth/verify-login-code
    const response = await apiClient.post('/api/auth/verify-login-code', {
      email,
      code,
    });
    
    // (성공 시, 'login'과 동일한 { access_token, user } 객체 반환)
    if (response.data && response.data.access_token) {
      return response.data;
    } else {
      throw new Error('OTP 로그인 응답이 올바르지 않습니다.');
    }
  } catch (error) {
    console.error('OTP 검증 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '인증 코드가 잘못되었거나 만료되었습니다.');
  }
};

// --- [신규!] 리포트 분석 요청 API (Phase 5) ---
export const analyzeReport = async (formData) => {
  try {
    const response = await apiClient.post('/api/student/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data; // (성공 시 { reportId: "..." } 반환)
  } catch (error) {
    console.error('분석 요청 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '분석 요청에 실패했습니다.');
  }
};

// --- [신규!] 리포트 상태/결과 조회 API (Phase 6) ---
export const getReportStatus = async (reportId) => {
  try {
    // GET /api/student/report/{reportId}
    const response = await apiClient.get(`/api/student/report/${reportId}`);
    return response.data; // (성공 시 { status: "...", data: {...} } 반환)
  } catch (error) {
    console.error('리포트 조회 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '리포트 조회에 실패했습니다.');
  }
};

// --- [신규!] (Phase 7) Q&A API: 답변 제출 ---
export const submitAnswer = async (reportId, questionId, userAnswer) => {
  try {
    // POST /api/student/report/{id}/answer
    const response = await apiClient.post(`/api/student/report/${reportId}/answer`, {
      question_id: questionId,
      user_answer: userAnswer,
    });
    return response.data; // (성공 시 { status: "success" } 반환)
  } catch (error) {
    console.error('답변 제출 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '답변 제출에 실패했습니다.');
  }
};

// --- [신규!] (Phase 7) Q&A API: 다음 질문 받기 ---
export const getNextQuestion = async (reportId) => {
  try {
    // POST /api/student/report/{id}/question/next
    const response = await apiClient.post(`/api/student/report/${reportId}/question/next`);
    return response.data; // (성공 시 { question_id: "...", question: "..." } 반환)
  } catch (error) {
    console.error('다음 질문 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '다음 질문 로딩에 실패했습니다.');
  }
};

// --- [신규!] (Phase 7) Q&A API: 심화 질문 받기 ---
export const getDeepDiveQuestion = async (reportId, parentQuestionId) => {
  try {
    // POST /api/student/report/{id}/question/deep-dive
    const response = await apiClient.post(`/api/student/report/${reportId}/question/deep-dive`, {
      parent_question_id: parentQuestionId,
    });
    return response.data; // (성공 시 { question_id: "...", question: "..." } 반환)
  } catch (error) {
    console.error('심화 질문 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '심화 질문 로딩에 실패했습니다.');
  }
};

// --- [핵심 수정!] API 요청 시 자동으로 토큰 추가 ---
// (주석을 해제하여 모든 요청에 토큰을 담아 보냅니다)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});