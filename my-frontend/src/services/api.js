import axios from 'axios';

const API_URL = 'http://localhost:5000'; // 백엔드 서버

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = () => {
  return apiClient.get('/');
};

// --- 회원가입 API 함수 (Phase 3) ---
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

// --- 로그인 API 함수 (Phase 4) ---
export const login = async (email, password) => {
  try {
    const response = await apiClient.post('/api/auth/login', {
      email,
      password,
    });
    
    // 성공 시, 응답 데이터(token, user)를 반환
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

// --- (나중에 주석 해제) API 요청 시 자동으로 토큰 추가 ---
/*
apiClient.interceptors.request.use((config) => {
  // localStorage에서 토큰을 가져옵니다.
  const token = localStorage.getItem('accessToken');
  if (token) {
    // 헤더에 토큰을 추가합니다.
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});
*/