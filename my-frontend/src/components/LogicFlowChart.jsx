import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Alert } from '@mui/material';
import { apiClient } from '../services/api';

/**
 * LogicFlowChart 컴포넌트: reportId를 받아 PNG 이미지를 표시합니다.
 * @param {number} reportId - 리포트 ID
 */
function LogicFlowChart({ reportId }) {
    const [imageUrl, setImageUrl] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        if (!reportId) {
            setIsLoading(false);
            setError('리포트 ID가 제공되지 않았습니다.');
            return;
        }

        const fetchFlowGraph = async () => {
            try {
                setIsLoading(true);
                setError(null);
                setStatus(null);

                console.log(`[LogicFlowChart] 논리 흐름도 요청: reportId=${reportId}`);

                // PNG 이미지를 blob으로 받기
                const response = await apiClient.get(`/api/report/${reportId}/flow-graph`, {
                    responseType: 'blob', // 🔥 중요: blob으로 받기
                    validateStatus: (status) => status < 500 // 202, 404 등도 처리
                });

                console.log('[LogicFlowChart] 응답 상태:', response.status);
                console.log('[LogicFlowChart] Content-Type:', response.headers['content-type']);

                // 1. 202 Accepted - 분석 진행 중
                if (response.status === 202) {
                    // JSON 응답 파싱
                    const text = await response.data.text();
                    const json = JSON.parse(text);
                    setStatus(json.status);
                    setError(json.message || '리포트 분석이 진행 중입니다.');
                    setIsLoading(false);
                    return;
                }

                // 2. 404 Not Found - 데이터 없음
                if (response.status === 404) {
                    const text = await response.data.text();
                    const json = JSON.parse(text);
                    setError(json.message || '논리 흐름도 데이터를 찾을 수 없습니다.');
                    setIsLoading(false);
                    return;
                }

                // 3. 500 Internal Server Error
                if (response.status === 500) {
                    const text = await response.data.text();
                    const json = JSON.parse(text);
                    setError(json.message || '서버 오류가 발생했습니다.');
                    setIsLoading(false);
                    return;
                }

                // 4. 200 OK - PNG 이미지 성공
                if (response.status === 200 && response.headers['content-type']?.includes('image/png')) {
                    // Blob을 Object URL로 변환
                    const blob = response.data;
                    const url = URL.createObjectURL(blob);
                    
                    console.log('[LogicFlowChart] PNG 이미지 로드 성공');
                    setImageUrl(url);
                    setIsLoading(false);
                    return;
                }

                // 5. 기타 예상치 못한 응답
                setError('예상치 못한 응답 형식입니다.');
                setIsLoading(false);

            } catch (err) {
                console.error('[LogicFlowChart] 논리 흐름도 로딩 오류:', err);
                
                // 네트워크 오류 또는 JSON 파싱 오류 처리
                if (err.response?.data) {
                    try {
                        const text = await err.response.data.text();
                        const json = JSON.parse(text);
                        setError(json.message || '논리 흐름도를 불러오는 중 오류가 발생했습니다.');
                    } catch {
                        setError('논리 흐름도를 불러오는 중 오류가 발생했습니다.');
                    }
                } else {
                    setError(err.message || '네트워크 오류가 발생했습니다.');
                }
                
                setIsLoading(false);
            }
        };

        fetchFlowGraph();

        // Cleanup: Object URL 해제
        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [reportId]);

    // 로딩 중
    if (isLoading) {
        return (
            <Paper 
                variant="outlined" 
                sx={{ 
                    p: 6, 
                    textAlign: 'center', 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                }}
            >
                <CircularProgress size={40} sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                    논리 흐름도를 불러오는 중...
                </Typography>
            </Paper>
        );
    }

    // 에러 상태 (분석 진행 중 포함)
    if (error) {
        const severity = status === 'processing' || status === 'processing_analysis' ? 'info' : 'error';
        
        return (
            <Alert severity={severity} sx={{ borderRadius: 2 }}>
                <Typography variant="body2">
                    <strong>{severity === 'info' ? '분석 진행 중' : '오류'}:</strong> {error}
                </Typography>
                {status && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        현재 상태: {status}
                    </Typography>
                )}
            </Alert>
        );
    }

    // 이미지 표시
    if (imageUrl) {
        return (
            <Paper 
                variant="outlined" 
                sx={{ 
                    p: 2, 
                    borderRadius: 2,
                    border: '1px solid #e0e0e0',
                    bgcolor: 'white'
                }}
            >
                <Box
                    component="img"
                    src={imageUrl}
                    alt="논리 흐름도"
                    sx={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        borderRadius: 1
                    }}
                />
            </Paper>
        );
    }

    // 데이터 없음 (예상치 못한 상태)
    return (
        <Paper 
            variant="outlined" 
            sx={{ 
                p: 3, 
                textAlign: 'center', 
                borderRadius: 2,
                border: '1px solid #e0e0e0'
            }}
        >
            <Typography color="text.secondary">
                논리 흐름도 데이터를 불러올 수 없습니다.
            </Typography>
        </Paper>
    );
}

export default LogicFlowChart;