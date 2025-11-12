import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as apiLogin } from '../services/api.js'; 
import { useNavigate } from 'react-router-dom';

// 1. Context 생성
const AuthContext = createContext(null);

// 2. Provider 컴포넌트 생성 (앱 전체를 감쌀 컴포넌트)
export function AuthProvider({ children }) {
  // 3. 상태 초기화 시 localStorage에서 값 읽기 (페이지 새로고침 대응)
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('accessToken') || null;
  });
  
  const navigate = useNavigate();

  // 4. 로그인 함수
  const login = async (email, password) => {
    try {
      const data = await apiLogin(email, password); 
      
      // 상태 업데이트
      setUser(data.user);
      setToken(data.access_token);
      
      // [중요] 토큰과 사용자 정보를 localStorage에 저장
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user)); // 사용자 정보도 저장
      
      // 메인 페이지로 이동
      navigate('/'); 

    } catch (error) {
      console.error('로그인 실패 (Context):', error);
      throw error; 
    }
  };

  // 5. 로그아웃 함수
  const logout = () => {
    setUser(null);
    setToken(null);
    // [중요] localStorage에서 모두 삭제
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // 6. Context가 제공할 값들
  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token // (token이 있으면 true)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 7. Hook 생성 (다른 컴포넌트에서 쉽게 사용하기 위함)
export const useAuth = () => {
  return useContext(AuthContext);
};