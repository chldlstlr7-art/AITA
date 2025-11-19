import React, { createContext, useState, useContext } from 'react';
import { login as apiLogin } from '../services/api.js'; 
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

// JWT 토큰의 Payload를 디코딩하는 헬퍼 함수
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

// 역할 통합 헬퍼 함수
const getIntegratedRole = (role) => {
    if (role === 'developer' || role === 'admin') {
        return 'admin';
    }
    return role || 'student';
};


export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const storedUserJSON = localStorage.getItem('user');
        if (!storedUserJSON) return null;

        const storedUser = JSON.parse(storedUserJSON);
        
        // ⭐ 초기 로딩 시 역할 통합 적용
        const integratedRole = getIntegratedRole(storedUser.role);

        return {
            ...storedUser,
            role: integratedRole,
        };
    });
    
    const [token, setToken] = useState(() => {
        return localStorage.getItem('accessToken') || null;
    });
    
    const navigate = useNavigate();

    // 인증 데이터를 저장하고 이동하는 "공통" 함수
    const setAuthenticated = (userObject, tokenString) => {
        // ⭐ 역할 통합 로직 적용
        const integratedRole = getIntegratedRole(userObject.role);
            
        const finalUserObject = {
            ...userObject,
            role: integratedRole, // 통합된 역할로 저장
        };

        setUser(finalUserObject);
        setToken(tokenString);
        localStorage.setItem('accessToken', tokenString);
        localStorage.setItem('user', JSON.stringify(finalUserObject)); 
        navigate('/'); 
    };

    // "일반" 비밀번호 로그인
    const login = async (email, password) => {
        try {
            const data = await apiLogin(email, password); // data = { access_token, user }
            // apiLogin은 토큰을 저장하지 않고 반환만 함. 여기서 상태 업데이트 및 저장 처리.
            setAuthenticated(data.user, data.access_token); 
        } catch (error) {
            console.error('로그인 실패 (Context):', error);
            throw error; 
        }
    };
    
    // "개발자용" 토큰 주입 로그인
    const loginWithToken = (devToken) => {
        try {
            const payload = parseJwt(devToken); 
            
            if (!payload || !payload.email || !payload.role || !payload.sub) {
                throw new Error("유효하지 않은 토큰입니다. (Payload에 email, role, sub가 없습니다)");
            }
            
            const userObject = {
                id: payload.sub, 
                email: payload.email,
                role: payload.role
            };
            
            setAuthenticated(userObject, devToken); 
            
        } catch (e) {
            console.error('개발자 토큰 로그인 실패:', e);
            throw e; 
        }
    };

    // 로그아웃
    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const value = {
        user,
        token,
        login,
        loginWithToken, 
        logout,
        isAuthenticated: !!token 
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    return useContext(AuthContext);
};