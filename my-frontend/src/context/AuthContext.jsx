import React, { createContext, useState, useContext } from 'react';
// 1. [수정] apiLogin 외에 apiVerifyLoginCode도 임포트
import { login as apiLogin, verifyLoginCode as apiVerifyLoginCode } from '../services/api.js'; 
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('accessToken') || null;
  });
  
  const navigate = useNavigate();

  // 2. [신규] 인증 데이터를 저장하는 공통 함수
  const setAuthData = (data) => {
    setUser(data.user);
    setToken(data.access_token);
    localStorage.setItem('accessToken', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user)); 
    navigate('/'); // 로그인 성공 시 메인 페이지로 이동
  };

  // 3. [수정] 비밀번호 로그인 함수
  const login = async (email, password) => {
    try {
      const data = await apiLogin(email, password); 
      setAuthData(data); // 공통 함수 호출
    } catch (error) {
      console.error('로그인 실패 (Context):', error);
      throw error; 
    }
  };
  
  // 4. [신규] OTP 로그인 함수
  const loginWithOtp = async (email, code) => {
    try {
      const data = await apiVerifyLoginCode(email, code);
      setAuthData(data); // 공통 함수 호출
    } catch (error) {
      console.error('OTP 로그인 실패 (Context):', error);
      throw error;
    }
  };

  // 5. 로그아웃 함수
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // 6. Context가 제공할 값들
  const value = {
    user,
    token,
    login,        // (비밀번호 로그인용)
    loginWithOtp, // (OTP 로그인용)
    logout,
    isAuthenticated: !!token 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};