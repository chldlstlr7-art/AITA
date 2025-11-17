/**
 * JWT 토큰에서 user_id를 추출하는 헬퍼 함수
 * @returns {number|null} 사용자 ID
 */
export const getUserIdFromToken = () => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('[JWT] 토큰이 없습니다.');
      return null;
    }

    // JWT 구조: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[JWT] 잘못된 토큰 형식');
      return null;
    }

    // payload 디코딩
    const payload = JSON.parse(atob(parts[1]));
    
    // 다양한 필드명 시도
    const userId = payload.sub || payload.user_id || payload.identity || payload.id;
    
    if (!userId) {
      console.error('[JWT] 토큰에 사용자 ID가 없습니다:', payload);
      return null;
    }

    // 문자열이면 숫자로 변환
    return typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
  } catch (e) {
    console.error('[JWT] 사용자 ID 추출 실패:', e);
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