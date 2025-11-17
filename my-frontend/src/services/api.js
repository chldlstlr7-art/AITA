import axios from 'axios';

const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || 
  'https://aita-5xo5.onrender.com';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== 인증 관련 ====================

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
      localStorage.setItem('accessToken', response.data.access_token);
      return response.data; 
    } else {
      throw new Error('로그인 응답이 올바르지 않습니다.');
    }
  } catch (error) {
    console.error('로그인 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '로그인에 실패했습니다.');
  }
};

// ==================== 학생용 리포트 분석 ====================

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

// ==================== QA 관련 ====================

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

// 🔥 [수정] Deep-dive API - 202 Accepted 처리
export const requestDeepDiveQuestion = async (reportId, parentQuestionId) => {
  try {
    console.log(`[API] 📡 심화 질문 생성 요청: reportId=${reportId}, parentId=${parentQuestionId}`);
    
    const response = await apiClient.post(`/api/student/report/${reportId}/question/deep-dive`, {
      parent_question_id: parentQuestionId,
    });

    console.log(`[API] ✅ 응답 상태: ${response.status}`);
    
    // 202 Accepted - 백그라운드 작업 시작
    if (response.status === 202) {
      console.log('[API] 💡 심화 질문 생성이 시작되었습니다. 폴링으로 확인하세요.');
      return { 
        status: 'processing',
        message: response.data.message 
      };
    }
    
    return response.data;
    
  } catch (error) {
    console.error('[API] ❌ requestDeepDiveQuestion 에러:', error);
    
    if (error.response) {
      const errorMessage = error.response.data?.error || `HTTP ${error.response.status}`;
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('서버에 연결할 수 없습니다.');
    } else {
      throw new Error(error.message || '요청 중 오류가 발생했습니다.');
    }
  }
};

// 🔥 [DEPRECATED] 기존 동기 방식 (하위 호환용)
export const getDeepDiveQuestion = async (reportId, parentQuestionId) => {
  console.warn('[API] getDeepDiveQuestion은 deprecated되었습니다. requestDeepDiveQuestion을 사용하세요.');
  return requestDeepDiveQuestion(reportId, parentQuestionId);
};

// ==================== 발전 아이디어 ====================

// 🔥 [수정] GET → POST로 변경 (비동기 처리)
export const requestAdvancementIdeas = async (reportId) => {
  try {
    console.log(`[API] 📡 발전 아이디어 생성 요청: reportId=${reportId}`);
    
    const response = await apiClient.post(`/api/student/report/${reportId}/advancement`);

    console.log(`[API] ✅ 응답 상태: ${response.status}`);
    
    // 200 OK - 이미 생성된 데이터 반환
    if (response.status === 200) {
      console.log('[API] 💡 발전 아이디어 데이터 수신 (캐시)');
      return { 
        status: 'completed',
        data: response.data 
      };
    }
    
    // 202 Accepted - 백그라운드 작업 시작
    if (response.status === 202) {
      console.log('[API] 💡 발전 아이디어 생성 시작. 폴링으로 확인하세요.');
      return { 
        status: 'processing',
        message: response.data.message 
      };
    }
    
    return response.data;
    
  } catch (error) {
    console.error('[API] ❌ requestAdvancementIdeas 에러:', error);
    
    if (error.response) {
      const errorMessage = error.response.data?.error || `HTTP ${error.response.status}`;
      throw new Error(errorMessage);
    } else if (error.request) {
      throw new Error('서버에 연결할 수 없습니다.');
    } else {
      throw new Error(error.message || '요청 중 오류가 발생했습니다.');
    }
  }
};

// 🔥 [DEPRECATED] 기존 GET 방식 (하위 호환용)
export const getAdvancementIdeas = async (reportId) => {
  console.warn('[API] getAdvancementIdeas(GET)는 deprecated되었습니다. requestAdvancementIdeas(POST)를 사용하세요.');
  return requestAdvancementIdeas(reportId);
};

// ==================== 학생 대시보드 ====================

// 🔥 [수정] 경로 수정: /api/student/dashboard/<student_id>
export const getStudentDashboard = async (studentId) => {
  try {
    const response = await apiClient.get(`/api/student/dashboard/${studentId}`);
    return response.data;
  } catch (error) {
    console.error('학생 대시보드 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '대시보드를 불러오지 못했습니다.');
  }
};

// 🔥 [신규] 리포트를 과제에 제출
export const submitReportToAssignment = async (reportId, assignmentId) => {
  try {
    const response = await apiClient.post(`/api/student/report/${reportId}/submit`, {
      assignment_id: assignmentId,
    });
    return response.data;
  } catch (error) {
    console.error('리포트 제출 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '리포트 제출에 실패했습니다.');
  }
};

// 🔥 [신규] 학생용 과제 목록 조회
export const getStudentCourseAssignments = async (courseId) => {
  try {
    const response = await apiClient.get(`/api/student/courses/${courseId}/assignments`);
    return response.data.assignments || [];
  } catch (error) {
    console.error('과제 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과제 목록을 불러오지 못했습니다.');
  }
};

// ==================== TA용 API ====================

export const getTaCourses = async () => {
  try {
    const res = await apiClient.get('/api/ta/my-courses');
    return res.data;
  } catch (error) {
    console.error('TA 과목 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 목록을 불러오지 못했습니다.');
  }
};

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

export const deleteCourse = async (courseId) => {
  try {
    const res = await apiClient.delete(`/api/ta/courses/${courseId}`);
    return res.data;
  } catch (error) {
    console.error('TA 과목 삭제 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 삭제에 실패했습니다.');
  }
};

export const getCourseDetail = async (courseId) => {
  try {
    const res = await apiClient.get(`/api/ta/courses/${courseId}`);
    return res.data;
  } catch (error) {
    console.error('TA 과목 상세 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과목 정보를 불러오지 못했습니다.');
  }
};

export const getAssignmentsByCourse = async (courseId) => {
  try {
    const res = await apiClient.get(`/api/ta/courses/${courseId}/assignments`);
    return res.data;
  } catch (error) {
    console.error('과제 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과제 목록을 불러오지 못했습니다.');
  }
};

// TA 과제 생성
// POST /api/ta/courses/<course_id>/assignments
export const createAssignment = async (courseId, { assignment_name, description, due_date }) => {
  try {
    const res = await apiClient.post(`/api/ta/courses/${courseId}/assignments`, {
      assignment_name,
      description,
      due_date,
    });
    return res.data;
  } catch (error) {
    console.error('과제 생성 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과제 생성에 실패했습니다.');
  }
};

// 특정 과제 상세 조회 (TA용)
export const getAssignmentDetail = async (assignmentId) => {
  try {
    const res = await apiClient.get(`/api/ta/assignments/${assignmentId}`);
    return res.data;
  } catch (error) {
    console.error('과제 상세 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과제 상세를 불러오지 못했습니다.');
  }
};

// GET assignment criteria helper (reads from assignment detail)
export const getAssignmentCriteria = async (assignmentId) => {
  try {
    const res = await apiClient.get(`/api/ta/assignments/${assignmentId}`);
    const data = res.data || {};
    // assignment may be nested or criteria may be top-level
    return (data.assignment && data.assignment.criteria) || data.criteria || null;
  } catch (error) {
    console.error('채점 기준 조회 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '채점 기준을 불러오지 못했습니다.');
  }
};


export const getAssignmentSubmissions = async (assignmentId) => {
  try {
    const res = await apiClient.get(`/api/ta/assignments/${assignmentId}/submissions`);
    return res.data;
  } catch (error) {
    console.error('제출물 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '제출물 목록을 불러오지 못했습니다.');
  }
};

export const putAssignmentCriteria = async (assignmentId, criteriaPayload) => {
  try {
    const res = await apiClient.put(`/api/ta/assignments/${assignmentId}/criteria`, criteriaPayload);
    return res.data;
  } catch (error) {
    console.error('채점 기준 저장 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '채점 기준 저장에 실패했습니다.');
  }
};

// ==================== Axios Interceptor ====================

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export { apiClient };
// DELETE /api/ta/assignments/<assignment_id>
export const deleteAssignment = async (assignmentId) => {
  try {
    const res = await apiClient.delete(`/api/ta/assignments/${assignmentId}`);
    return res.data;
  } catch (error) {
    console.error('과제 삭제 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '과제 삭제에 실패했습니다.');
  }
};

// === 수강생 관리 API ===
// GET /api/ta/courses/<course_id>/students
export const getCourseStudents = async (courseId) => {
  try {
    const res = await apiClient.get(`/api/ta/courses/${courseId}/students`);
    // 예상: { students: [ { id, email, name, ... } ] }
    return res.data;
  } catch (error) {
    console.error('수강생 목록 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '수강생 목록을 불러오지 못했습니다.');
  }
};

// POST /api/ta/courses/<course_id>/students
export const addCourseStudent = async (courseId, { email }) => {
  try {
    const res = await apiClient.post(`/api/ta/courses/${courseId}/students`, { email });
    return res.data;
  } catch (error) {
    console.error('수강생 추가 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '수강생 추가에 실패했습니다.');
  }
};

// DELETE /api/ta/courses/<course_id>/students/<student_id>
export const deleteCourseStudent = async (courseId, studentId) => {
  try {
    const res = await apiClient.delete(`/api/ta/courses/${courseId}/students/${studentId}`);
    return res.data;
  } catch (error) {
    console.error('수강생 삭제 API 에러:', error.response || error);
    throw new Error(error.response?.data?.error || '수강생 삭제에 실패했습니다.');
  }
};
