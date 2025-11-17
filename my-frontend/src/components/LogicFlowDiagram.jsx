import React, { useState, useEffect } from 'react';
// [수정] api.js 파일에서 getFlowGraphImage 함수를 가져옵니다.
// (경로는 실제 파일 위치에 맞게 수정하세요)
import { getFlowGraphImage } from '../services/api'; 
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const DiagramContainer = styled(Box)({
  width: '100%',
  minHeight: '400px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#f8f9fa',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  overflow: 'auto',
  padding: '1rem',
});

const StyledImage = styled('img')({
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '4px',
});

/**
 * 리포트 ID를 받아 논리 흐름도 이미지를 API로 조회하고 표시하는 컴포넌트
 * @param {object} props
 * @param {string} props.reportId - 표시할 리포트의 UUID
 */
function LogicFlowDiagram({ reportId }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // reportId가 없으면 아무것도 하지 않음
    if (!reportId) {
      setIsLoading(false);
      setError(null);
      // 기존 이미지 URL이 있다면 해제
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      return;
    }

    const fetchDiagram = async () => {
      setIsLoading(true);
      setError(null);
      
      // 이전에 생성된 Blob URL이 있다면 메모리 해제
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }

      try {
        // --- [수정] api.js의 함수를 사용 ---
        // (인증 토큰은 api.js의 axios 인터셉터가 자동으로 처리합니다)
        const imageBlob = await getFlowGraphImage(reportId);

        // [수정] 성공 시 응답은 imageBlob
        const localImageUrl = URL.createObjectURL(imageBlob);
        setImageUrl(localImageUrl);

      } catch (err) {
        // [수정] 실패 시 err.message에 파싱된 오류가 담겨있음
        console.error("논리 흐름도 로딩 오류:", err);
        setError(err.message || '논리 흐름도를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiagram();

    // 컴포넌트가 사라질 때 Blob URL을 메모리에서 해제
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [reportId]); // 의존성 배열에서 'token' 제거

  // --- 렌더링 로직 ---

  if (isLoading) {
    return (
      <DiagramContainer>
        <CircularProgress />
      </DiagramContainer>
    );
  }

  if (error) {
    return (
      <DiagramContainer>
        <Alert severity="warning">{error}</Alert>
      </DiagramContainer>
    );
  }

  if (imageUrl) {
    return (
      <DiagramContainer>
        <StyledImage src={imageUrl} alt="논리 흐름도" />
      </DiagramContainer>
    );
  }

  return (
    <DiagramContainer>
      <Typography variant="body2" color="textSecondary">
        {reportId ? "데이터 로딩 중..." : "논리 흐름도를 표시할 리포트를 선택하세요."}
      </Typography>
    </DiagramContainer>
  );
}

export default LogicFlowDiagram;