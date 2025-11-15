import React, { useEffect, useRef, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Alert } from '@mui/material';
import Plotly from 'plotly.js/dist/plotly';

/**
 * LogicFlowChart 컴포넌트: flowData prop을 받아 Plotly 그래프를 자동 렌더링합니다.
 * @param {Object} flowData - Flow_Pattern 객체 (Plotly JSON 또는 nodes/edges 형식)
 */
function LogicFlowChart({ flowData }) {
    const plotlyRef = useRef(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // nodes/edges를 Plotly JSON으로 변환
    const convertToPlotlyJSON = (pattern) => {
        // 이미 Plotly JSON 형식이면 그대로 반환
        if (pattern.data && pattern.layout) {
            return pattern;
        }

        // nodes/edges 형식 처리
        if (pattern.nodes && Array.isArray(pattern.edges)) {
            const nodeIds = Object.keys(pattern.nodes);
            
            // 간단한 레이아웃 계산 (위에서 아래로)
            const positions = {};
            const levels = calculateLevels(nodeIds, pattern.edges);
            const levelGroups = {};
            
            nodeIds.forEach(id => {
                const lv = levels[id] || 0;
                if (!levelGroups[lv]) levelGroups[lv] = [];
                levelGroups[lv].push(id);
            });

            const yGap = 3.0;
            const xGap = 4.0;

            Object.keys(levelGroups).forEach(lv => {
                const nodes = levelGroups[lv];
                const startX = -(nodes.length - 1) * xGap / 2;
                nodes.forEach((id, idx) => {
                    positions[id] = {
                        x: startX + idx * xGap,
                        y: -parseInt(lv) * yGap
                    };
                });
            });

            // 노드 텍스트 처리
            const nodeTexts = nodeIds.map(id => {
                const text = pattern.nodes[id] || id;
                const cleaned = text.replace(/\[.*?\]:?\s*/g, '').trim();
                return cleaned.length > 30 ? cleaned.substring(0, 30) + '...' : cleaned;
            });

            // 엣지 shapes 생성
            const edgeShapes = pattern.edges.map(([src, tgt]) => {
                if (!positions[src] || !positions[tgt]) return null;
                return {
                    type: 'line',
                    x0: positions[src].x,
                    y0: positions[src].y,
                    x1: positions[tgt].x,
                    y1: positions[tgt].y,
                    line: { color: '#334155', width: 2 },
                    layer: 'below'
                };
            }).filter(Boolean);

            return {
                data: [{
                    x: nodeIds.map(id => positions[id]?.x || 0),
                    y: nodeIds.map(id => positions[id]?.y || 0),
                    mode: 'markers+text',
                    type: 'scatter',
                    marker: {
                        size: 20,
                        color: '#667eea',
                        line: { width: 2, color: '#2b3a55' }
                    },
                    text: nodeTexts,
                    textposition: 'middle center',
                    textfont: {
                        family: 'NanumGothic, "Noto Sans KR", Arial',
                        size: 12,
                        color: '#0f172a'
                    },
                    hovertext: nodeIds.map(id => pattern.nodes[id] || id),
                    hoverinfo: 'text'
                }],
                layout: {
                    showlegend: false,
                    hovermode: 'closest',
                    plot_bgcolor: 'white',
                    margin: { l: 40, r: 40, t: 40, b: 40 },
                    xaxis: { visible: false, showgrid: false, zeroline: false },
                    yaxis: { visible: false, showgrid: false, zeroline: false },
                    shapes: edgeShapes,
                    font: { family: 'NanumGothic, "Noto Sans KR", Arial' }
                }
            };
        }

        throw new Error('지원하지 않는 Flow_Pattern 형식입니다.');
    };

    // 위상 정렬로 레벨 계산
    const calculateLevels = (nodeIds, edges) => {
        const levels = {};
        const indegree = {};
        const graph = {};

        nodeIds.forEach(id => {
            indegree[id] = 0;
            graph[id] = [];
        });

        edges.forEach(([src, tgt]) => {
            if (nodeIds.includes(src) && nodeIds.includes(tgt)) {
                graph[src].push(tgt);
                indegree[tgt]++;
            }
        });

        const queue = nodeIds.filter(id => indegree[id] === 0);
        if (queue.length === 0) {
            nodeIds.forEach((id, idx) => { levels[id] = idx; });
            return levels;
        }

        let level = 0;
        while (queue.length > 0) {
            const levelSize = queue.length;
            for (let i = 0; i < levelSize; i++) {
                const node = queue.shift();
                levels[node] = level;
                graph[node].forEach(neighbor => {
                    indegree[neighbor]--;
                    if (indegree[neighbor] === 0) queue.push(neighbor);
                });
            }
            level++;
        }

        nodeIds.forEach(id => {
            if (levels[id] === undefined) levels[id] = level++;
        });

        return levels;
    };

    useEffect(() => {
        if (!flowData) {
            setIsLoading(false);
            return;
        }

        const drawGraph = async () => {
            try {
                setIsLoading(true);
                setError(null);

                console.log('[LogicFlowChart] 받은 데이터:', flowData);

                // Flow_Pattern 추출
                const pattern = flowData.Flow_Pattern || flowData;
                console.log('[LogicFlowChart] Flow_Pattern:', pattern);

                // Plotly JSON으로 변환
                const plotlyJSON = convertToPlotlyJSON(pattern);
                console.log('[LogicFlowChart] 변환된 Plotly JSON:', plotlyJSON);

                // Plotly 렌더링
                if (plotlyRef.current) {
                    await Plotly.newPlot(
                        plotlyRef.current,
                        plotlyJSON.data,
                        { ...plotlyJSON.layout, autosize: true },
                        {
                            displayModeBar: true,
                            modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d'],
                            responsive: true
                        }
                    );
                    console.log('[LogicFlowChart] Plotly 렌더링 성공');
                }

                setIsLoading(false);

            } catch (err) {
                console.error('[LogicFlowChart] Plotly 렌더링 오류:', err);
                setError(err.message || '그래프 렌더링 중 오류가 발생했습니다.');
                setIsLoading(false);
            }
        };

        drawGraph();

        return () => {
            if (plotlyRef.current) {
                Plotly.purge(plotlyRef.current);
            }
        };
    }, [flowData]);

    // 에러 상태
    if (error) {
        return (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
                <Typography variant="body2">
                    <strong>그래프 로딩 실패:</strong> {error}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    콘솔에서 상세 오류를 확인하세요.
                </Typography>
            </Alert>
        );
    }

    // 데이터 없음
    if (!flowData) {
        return (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
                <Typography color="text.secondary">
                    논리 흐름도 데이터를 불러올 수 없습니다.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box sx={{ position: 'relative' }}>
            {/* 로딩 오버레이 */}
            {isLoading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(255, 255, 255, 0.8)',
                        zIndex: 10,
                        borderRadius: 1
                    }}
                >
                    <CircularProgress size={40} />
                    <Typography variant="caption" sx={{ ml: 2 }}>
                        논리 흐름도 로딩 중...
                    </Typography>
                </Box>
            )}

            {/* Plotly 차트 컨테이너 */}
            <Box
                ref={plotlyRef}
                sx={{
                    width: '100%',
                    height: 900,
                    border: '1px solid #ddd',
                    borderRadius: 1,
                    bgcolor: 'white'
                }}
            />
        </Box>
    );
}

export default LogicFlowChart;