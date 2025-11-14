import React, { createContext, useState, useContext } from 'react';
// 1. [수정] apiLogin 임포트
import { login as apiLogin } from '../services/api.js'; 
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

// 2. [신규] JWT 토큰의 Payload를 디코딩하는 헬퍼 함수
// (토큰에서 user.id, user.email, user.role을 추출하기 위함)
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Invalid token payload", e);
    return null;
  }
};


export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => {
    return localStorage.getItem('accessToken') || null;
  });
  
  const navigate = useNavigate();

  // 3. [신규] 인증 데이터를 저장하고 이동하는 "공통" 함수
  const setAuthenticated = (userObject, tokenString) => {
    setUser(userObject);
    setToken(tokenString);
    localStorage.setItem('accessToken', tokenString);
    localStorage.setItem('user', JSON.stringify(userObject)); 
    navigate('/'); // 로그인 성공 시 메인 페이지로 이동
  };

  // 4. (기존) "일반" 비밀번호 로그인
  const login = async (email, password) => {
    try {
      const data = await apiLogin(email, password); // data = { access_token, user }
      setAuthenticated(data.user, data.access_token); // 공통 함수 호출
    } catch (error) {
      console.error('로그인 실패 (Context):', error);
      throw error; 
    }
  };
  
  // 5. [신규!] "개발자용" 토큰 주입 로그인
  const loginWithToken = (devToken) => {
    try {
      const payload = parseJwt(devToken); // (토큰에서 유저 정보 파싱)
      
      if (!payload || !payload.email || !payload.role || !payload.sub) {
        throw new Error("유효하지 않은 토큰입니다. (Payload에 email, role, sub가 없습니다)");
      }
      
      // (백엔드 /login API의 user 객체와 동일한 형태로 만듭니다)
      const userObject = {
        id: payload.sub, // 'sub' (Subject)가 바로 user.id 입니다.
        email: payload.email,
        role: payload.role
      };
      
      setAuthenticated(userObject, devToken); // 공통 함수 호출
      
    } catch (e) {
      console.error('개발자 토큰 로그인 실패:', e);
      throw e; // LoginPage가 에러를 잡을 수 있도록 다시 throw
    }
  };

  // 6. (기존) 로그아웃
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // 7. [수정] value 객체에 loginWithToken 추가
  const value = {
    user,
    token,
    login,
    loginWithToken, // ⬅️ [신규]
    logout,
    isAuthenticated: !!token 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};