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
            // 🔥 [수정] 토큰 저장을 AuthContext로 위임하기 위해 제거
            // localStorage.setItem('accessToken', response.data.access_token); 
            return response.data; // { access_token, user } 반환
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

/**
 * 논리 흐름도 PNG 이미지 조회
 * @param {string} reportId - 리포트 ID
 * @returns {Promise<Blob>} PNG 이미지 Blob 객체
 */
export const getFlowGraphImage = async (reportId) => {
    try {
        const response = await apiClient.get(
            `/api/student/report/${reportId}/flow-graph`,
            {
                // 응답을 Blob(바이너리)으로 받도록 설정
                responseType: 'blob', 
            }
        );
        return response.data;

    } catch (error) {
        console.error('흐름도 이미지 API 에러:', error.response || error);
        
        if (error.response && error.response.data instanceof Blob) {
            try {
                // Blob을 텍스트로 읽고 JSON으로 파싱하여 에러 메시지 추출
                const errorText = await error.response.data.text();
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || errorJson.error || '그래프 로딩 실패');
            } catch (parseError) {
                throw new Error(error.response?.statusText || '그래프를 불러오지 못했습니다.');
            }
        }
        
        throw new Error(error.response?.data?.error || error.response?.data?.message || '그래프를 불러오지 못했습니다.');
    }
};
// ==================== 심층 분석 (Deep Analysis) ====================

/**
 * 심층 분석 요청 (POST)
 * 백그라운드 작업을 시작하고 202 Accepted를 반환받음
 */
export const requestDeepAnalysis = async (reportId) => {
    try {
        // 백엔드 라우트: /reports/<report_id>/deep-analysis
        const response = await apiClient.post(`/api/student/reports/${reportId}/deep-analysis`);
        
        // 202 Accepted or 200 OK
        return response.data;
    } catch (error) {
        console.error('심층 분석 요청 API 에러:', error.response || error);
        const errorMessage = error.response?.data?.message || '심층 분석 요청에 실패했습니다.';
        throw new Error(errorMessage);
    }
};

/**
 * 심층 분석 결과 조회 (GET)
 * 분석 완료 시 데이터 반환, 미완료(404) 시 pending 상태 반환
 */
export const getDeepAnalysisResult = async (reportId) => {
    try {
        const response = await apiClient.get(`/api/student/reports/${reportId}/deep-analysis`);
        return response.data; // { status: "success", data: {...} }
    } catch (error) {
        // 404는 아직 분석 결과가 생성되지 않음을 의미 (Pending)
        if (error.response && error.response.status === 404) {
            return { status: 'pending', data: null };
        }
        
        console.error('심층 분석 결과 조회 API 에러:', error.response || error);
        throw error;
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

// Deep-dive API - 202 Accepted 처리
export const requestDeepDiveQuestion = async (reportId, parentQuestionId) => {
    try {
        const response = await apiClient.post(`/api/student/report/${reportId}/question/deep-dive`, {
            parent_question_id: parentQuestionId,
        });

        // 202 Accepted - 백그라운드 작업 시작
        if (response.status === 202) {
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

// [DEPRECATED] 기존 동기 방식
export const getDeepDiveQuestion = async (reportId, parentQuestionId) => {
    console.warn('[API] getDeepDiveQuestion은 deprecated되었습니다. requestDeepDiveQuestion을 사용하세요.');
    return requestDeepDiveQuestion(reportId, parentQuestionId);
};

// ==================== 발전 아이디어 ====================

// POST로 변경 (비동기 처리)
export const requestAdvancementIdeas = async (reportId) => {
    try {
        const response = await apiClient.post(`/api/student/report/${reportId}/advancement`);

        // 200 OK - 이미 생성된 데이터 반환
        if (response.status === 200) {
            return { 
                status: 'completed',
                data: response.data 
            };
        }
        
        // 202 Accepted - 백그라운드 작업 시작
        if (response.status === 202) {
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

// [DEPRECATED] 기존 GET 방식
export const getAdvancementIdeas = async (reportId) => {
    console.warn('[API] getAdvancementIdeas(GET)는 deprecated되었습니다. requestAdvancementIdeas(POST)를 사용하세요.');
    return requestAdvancementIdeas(reportId);
};

// ==================== 학생 대시보드 ====================

/**
 * 학생 대시보드 데이터 조회
 * @param {number} studentId - 학생 ID
 * @returns {Promise<Object>} 대시보드 데이터
 */
export const getStudentDashboard = async (studentId) => {
    try {
        
        // AuthContext에서 토큰이 관리되므로, 여기서 로컬 스토리지를 직접 검사하는 것은 
        // Interceptor에 의존하는 것이 더 안전함.
        // if (!token) throw new Error('로그인 정보가 없습니다.'); // Interceptor가 처리

        const response = await apiClient.get(`/api/student/dashboard/${studentId}`);
        
        if (!response.data) {
            throw new Error('서버 응답이 비어있습니다.');
        }
        
        return response.data;
        
    } catch (error) {
        console.error('[API] ❌ 학생 대시보드 조회 실패:', error.response?.data || error.message);
        
        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data;
            
            if (status === 500) {
                throw new Error(`서버 오류: ${errorData?.error || '내부 서버 오류'}`);
            } else if (status === 404) {
                throw new Error('학생 정보를 찾을 수 없습니다.');
            } else if (status === 401) {
                throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
            } else if (status === 403) {
                throw new Error('접근 권한이 없습니다.');
            } else {
                throw new Error(errorData?.error || `HTTP ${status} 오류`);
            }
        } else if (error.request) {
            throw new Error('서버에 연결할 수 없습니다.');
        } else {
            throw error;
        }
    }
};

/**
 * 리포트를 과제에 연결 (제출)
 * @param {string} reportId - 리포트 ID
 * @param {string|number} assignmentId - 과제 ID
 * @returns {Promise<Object>}
 */
export const submitReportToAssignment = async (reportId, assignmentId) => {
    try {
        const response = await apiClient.post(
            `/api/student/report/${reportId}/submit`,
            {
                assignment_id: assignmentId, 
            }
        );
        return response.data;
    } catch (error) {
        console.error('[API] ❌ 리포트 제출 실패:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error || '리포트 제출에 실패했습니다.');
    }
};

// 학생용 과제 목록 조회
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


// 과제 정보 수정
export const updateAssignment = async (assignmentId, { assignment_name, description, due_date }) => {
    try {
        const res = await apiClient.put(`/api/ta/assignments/${assignmentId}`, {
            assignment_name,
            description,
            due_date,
        });
        return res.data;
    } catch (error) {
        console.error('과제 수정 API 에러:', error.response || error);
        throw new Error(error.response?.data?.error || '과제 수정에 실패했습니다.');
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

// GET assignment criteria helper
export const getAssignmentCriteria = async (assignmentId) => {
    try {
        const res = await apiClient.get(`/api/ta/assignments/${assignmentId}/criteria`);
        return res.data;
    } catch (error) {
        console.error('채점 기준 조회 API 에러:', error.response || error);
        if (error.response) {
            throw new Error(error.response.data?.error || `HTTP ${error.response.status}`);
        }
        if (error.request) {
            throw new Error('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
        }
        throw new Error(error.message || '채점 기준을 불러오지 못했습니다.');
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

// ==================== 과제 통계 조회 ====================
export const getAssignmentStats = async (assignmentId) => {
    try {
        const res = await apiClient.get(`/assignments/${assignmentId}/stats`);
        const data = res.data;

        // Normalize possible response shapes.
        // Expected shape (per docs): flat object with keys like total_students, submission_count, ...
        // But some backends may return { assignment: {...}, stats: {...} } or similar.
        let stats = null;
        if (!data) {
            stats = null;
        } else if (data.assignment && data.assignment.stats) {
            stats = data.assignment.stats;
        } else if (data.stats) {
            stats = data.stats;
        } else if (data.assignment && typeof data.assignment === 'object') {
            // sometimes assignment contains fields
            stats = {
                assignment_id: data.assignment.id || data.assignment.assignment_id || assignmentId,
                assignment_name: data.assignment.assignment_name || data.assignment.name || null,
                total_students: data.assignment.total_students ?? data.total_students ?? null,
                submission_count: data.assignment.submission_count ?? data.submission_count ?? null,
                submission_rate: data.assignment.submission_rate ?? data.submission_rate ?? null,
                graded_count: data.assignment.graded_count ?? data.graded_count ?? null,
                average_score: data.assignment.average_score ?? data.average_score ?? null,
                max_score: data.assignment.max_score ?? data.max_score ?? null,
                min_score: data.assignment.min_score ?? data.min_score ?? null,
                stddev_score: data.assignment.stddev_score ?? data.stddev_score ?? null,
                q1: data.assignment.q1 ?? data.q1 ?? null,
                q2: data.assignment.q2 ?? data.q2 ?? null,
                q3: data.assignment.q3 ?? data.q3 ?? null,
            };
        } else if (typeof data === 'object') {
            stats = data;
        } else {
            stats = null;
        }

        // Debug log when total_students missing to help troubleshooting
        if (stats && (stats.total_students === null || stats.total_students === undefined)) {
            console.debug(`[getAssignmentStats] assignment ${assignmentId} returned without total_students`, stats);
        }

        return stats;
    } catch (error) {
        console.error('과제 통계 조회 API 에러:', error.response || error);
        if (error.response) {
            if (error.response.status === 404) return null;
            throw new Error(error.response.data?.error || `HTTP ${error.response.status}`);
        }
        throw new Error(error.message || '과제 통계를 불러오지 못했습니다.');
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

// ==================== TA 리포트 자동 채점 ====================
export const autoGradeReport = async (reportId) => {
    try {
        const res = await apiClient.post(`/api/ta/reports/${reportId}/auto-grade`);
        // 202 Accepted -> background task started
        if (res.status === 202) {
            return { status: 'processing', message: res.data?.message };
        }
        return res.data;
    } catch (error) {
        console.error('리포트 자동 채점 API 에러:', error.response || error);
        if (error.response) {
            throw new Error(error.response.data?.error || `HTTP ${error.response.status}`);
        }
        throw new Error(error.message || '자동 채점 요청에 실패했습니다.');
    }
};

// GET AI 자동 채점 결과
export const getAutoGradeResult = async (reportId) => {
    try {
        const res = await apiClient.get(`/api/ta/reports/${reportId}/auto-grade-result`);
        return res.data;
    } catch (error) {
        console.error('AI 자동 채점 결과 조회 API 에러:', error.response || error);
        if (error.response) {
            // 404 또는 기타 응답은 결과 없음으로 처리하기 위해 null 반환 권장
            if (error.response.status === 404) return null;
            throw new Error(error.response.data?.error || `HTTP ${error.response.status}`);
        }
        throw new Error(error.message || 'AI 자동 채점 결과를 불러오지 못했습니다.');
    }
};

// GET TA가 직접 채점한 결과
export const getTaGrade = async (reportId) => {
    try {
        const res = await apiClient.get(`/api/ta/reports/${reportId}/ta-grade`);
        return res.data;
    } catch (error) {
        console.error('TA 채점 결과 조회 API 에러:', error.response || error);
        if (error.response) {
            // 404 -> 결과 없음
            if (error.response.status === 404) return null;
            throw new Error(error.response.data?.error || `HTTP ${error.response.status}`);
        }
        throw new Error(error.message || 'TA 채점 결과를 불러오지 못했습니다.');
    }
};

// ==================== TA 수동 채점 저장 ====================
export const submitTaGrade = async (reportId, body) => {
    try {
        const res = await apiClient.post(`/api/ta/reports/${reportId}/grade`, body);
        return res.data;
    } catch (error) {
        console.error('TA 채점 저장 API 에러:', error.response || error);
        if (error.response) {
            throw new Error(error.response.data?.error || `HTTP ${error.response.status}`);
        }
        throw new Error(error.message || 'TA 채점 저장에 실패했습니다.');
    }
};

// 과제 삭제
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
export const getCourseStudents = async (courseId) => {
    try {
        const res = await apiClient.get(`/api/ta/courses/${courseId}/students`);
        return res.data;
    } catch (error) {
        console.error('수강생 목록 API 에러:', error.response || error);
        throw new Error(error.response?.data?.error || '수강생 목록을 불러오지 못했습니다.');
    }
};

export const addCourseStudent = async (courseId, { email }) => {
    try {
        const res = await apiClient.post(`/api/ta/courses/${courseId}/students`, { email });
        return res.data;
    } catch (error) {
        console.error('수강생 추가 API 에러:', error.response || error);
        throw new Error(error.response?.data?.error || '수강생 추가에 실패했습니다.');
    }
};

export const deleteCourseStudent = async (courseId, studentId) => {
    try {
        const res = await apiClient.delete(`/api/ta/courses/${courseId}/students/${studentId}`);
        return res.data;
    } catch (error) {
        console.error('수강생 삭제 API 에러:', error.response || error);
        throw new Error(error.response?.data?.error || '수강생 삭제에 실패했습니다.');
    }
};


// ==================== Axios Interceptor ====================

apiClient.interceptors.request.use((config) => {
    // 요청 시마다 로컬 스토리지에서 토큰을 가져와 헤더에 추가
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export { apiClient };