/**
 * JWT 토큰에서 user_id를 추출하는 헬퍼 함수
 */
export const getUserIdFromToken = () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('[jwtHelper] 토큰이 없습니다.');
      return null;
    }

    // JWT는 "header.payload.signature" 형태
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[jwtHelper] 잘못된 JWT 형식');
      return null;
    }

    // payload는 Base64로 인코딩되어 있음
    const payload = JSON.parse(atob(parts[1]));
    
    // Flask-JWT-Extended는 'sub' 필드에 identity를 저장
    const userId = payload.sub;
    
    if (!userId) {
      console.error('[jwtHelper] payload에 sub(user_id)가 없습니다.');
      return null;
    }

    console.log('[jwtHelper] ✅ user_id 추출 성공:', userId);
    return parseInt(userId, 10); // 정수로 변환
    
  } catch (error) {
    console.error('[jwtHelper] 토큰 파싱 실패:', error);
    return null;
  }
};

/**
 * JWT 토큰의 유효성을 확인 (만료 여부)
 */
export const isTokenValid = () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;

    if (!exp) return false;

    // exp는 Unix timestamp (초 단위)
    const now = Math.floor(Date.now() / 1000);
    return exp > now;
    
  } catch (error) {
    console.error('[jwtHelper] 토큰 검증 실패:', error);
    return false;
  }
};

/**
 * 토큰에서 사용자 역할(role) 추출
 */
export const getUserRoleFromToken = () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    
    // 백엔드에서 role을 JWT claims에 포함시켰다면
    return payload.role || 'student'; // 기본값 student
    
  } catch (error) {
    console.error('[jwtHelper] role 추출 실패:', error);
    return null;
  }
};