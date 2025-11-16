import axios from 'axios';

const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  'https://aita-5xo5.onrender.com'; // 로컬 개발용 (주석 처리 가능)

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
      // ✅ 여기서 토큰 저장
      localStorage.setItem('accessToken', response.data.access_token);

      // (선택) 유저 정보도 같이 저장하고 싶으면
      // localStorage.setItem('user', JSON.stringify(response.data.user));

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

// 🆕 발전 아이디어 생성 요청 (비동기 방식)
export const requestAdvancementIdeas = async (reportId) => {
  try {
    console.log(`[API] 📡 Requesting advancement ideas generation for report: ${reportId}`);
    
    // POST 요청으로 백그라운드 작업 시작
    const response = await apiClient.post(`/api/student/report/${reportId}/advancement`);

    console.log(`[API] ✅ Response status: ${response.status}`);
    console.log('[API] 📦 Message:', response.data);
    
    return response.data; // { message: "Advancement idea generation started..." }
    
  } catch (error) {
    console.error('[API] ❌ requestAdvancementIdeas 에러:', error);
    
    if (error.response) {
      const errorMessage = error.response.data?.error || `HTTP ${error.response.status}`;
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
    } else {
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


//아래부터 TA용
export const getTaCourses = async () => {
  try {
    // 백엔드에서 TA 본인이 담당하는 과목 목록을 돌려준다고 가정
    const res = await apiClient.get('/api/ta/my-courses');
    // 예상 응답: { courses: [ { id, course_code, course_name, student_count, ... }, ... ] }
    return res.data;
  } catch (error) {
    console.error('TA 과목 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 목록을 불러오지 못했습니다.');
  }
};

// TA 과목 생성
// POST /api/ta/courses
export const createCourse = async ({ course_code, course_name }) => {
  try {
    const res = await apiClient.post('/api/ta/courses', {
      course_code,
      course_name,
    });
    return res.data;
  } catch (error) {
    console.error('TA 과목 생성 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 생성에 실패했습니다.');
  }
};

// TA 과목 정보 수정
// PUT /api/ta/courses/<course_id>
export const updateCourse = async (courseId, { course_code, course_name }) => {
  try {
    const res = await apiClient.put(`/api/ta/courses/${courseId}`, {
      course_code,
      course_name,
    });
    return res.data;
  } catch (error) {
    console.error('TA 과목 수정 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 수정에 실패했습니다.');
  }
};

// TA 과목 삭제
// ⚠️ 백엔드 명세서에는 과목 삭제가 없어서,
//    DELETE /api/ta/courses/<course_id> 엔드포인트가 있다고 가정합니다.
export const deleteCourse = async (courseId) => {
  try {
    const res = await apiClient.delete(`/api/ta/courses/${courseId}`);
    return res.data;
  } catch (error) {
    console.error('TA 과목 삭제 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 삭제에 실패했습니다.');
  }
};

// 과목 상세 정보 조회 (백엔드에 구현되어 있다면 사용, 없으면 에러 → 프론트에서 fallback)
export const getCourseDetail = async (courseId) => {
  try {
    const res = await apiClient.get(`/api/ta/courses/${courseId}`);
    // 예상: { course: { ... } } 또는 { id, course_code, ... }
    return res.data;
  } catch (error) {
    console.error('TA 과목 상세 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 정보를 불러오지 못했습니다.');
  }
};

// 특정 과목의 과제 리스트 조회
// (백엔드에 /api/ta/courses/<course_id>/assignments 가 있다고 가정, 없으면 DUMMY 사용)
export const getAssignmentsByCourse = async (courseId) => {
  try {
    const res = await apiClient.get(`/api/ta/courses/${courseId}/assignments`);
    // 예상: { assignments: [ {id, assignment_name, due_date, ...}, ... ] }
    return res.data;
  } catch (error) {
    console.error('과제 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과제 목록을 불러오지 못했습니다.');
  }
};

// 특정 과제 상세 조회 (TA용)
export const getAssignmentDetail = async (assignmentId) => {
  try {
    const res = await apiClient.get(`/api/ta/assignments/${assignmentId}`);
    // 예상 응답: { id, assignment_name, description, due_date, criteria?, submissions? }
    return res.data;
  } catch (error) {
    console.error('과제 상세 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과제 상세를 불러오지 못했습니다.');
  }
};

// 과제의 제출물 목록 조회
export const getAssignmentSubmissions = async (assignmentId) => {
  try {
    const res = await apiClient.get(`/api/ta/assignments/${assignmentId}/submissions`);
    return res.data;
  } catch (error) {
    console.error('제출물 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '제출물 목록을 불러오지 못했습니다.');
  }
};

// 과제 채점 기준 등록/수정
export const putAssignmentCriteria = async (assignmentId, criteriaPayload) => {
  try {
    const res = await apiClient.put(`/api/ta/assignments/${assignmentId}/criteria`, criteriaPayload);
    return res.data;
  } catch (error) {
    console.error('채점 기준 저장 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '채점 기준 저장에 실패했습니다.');
  }
};
