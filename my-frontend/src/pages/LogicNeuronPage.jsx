import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
// Edge Issue Sidebar (좌측)
const EdgeIssueSidebar = ({ edgeIssues, onSelect, selectedId, nodeMap, isAnalyzing }) => (
  <Box sx={{
    position: 'relative',
    width: '100%',
    bgcolor: 'background.paper',
    borderBottom: '1px solid',
    borderColor: 'divider',
    p: 2,
    overflowY: 'auto',
    boxShadow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  }}>
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: 'primary.main' }}>
      연결 이슈/제안 목록
    </Typography>
    {isAnalyzing ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">분석 중...</Typography>
      </Box>
    ) : edgeIssues == null ? (
      <Typography variant="body2" color="text.secondary">이슈가 감지된 연결이 없습니다.</Typography>
    ) : edgeIssues.length === 0 ? (
      <Typography variant="body2" color="text.secondary">이슈가 감지된 연결이 없습니다.</Typography>
    ) : (
      edgeIssues.map((e, idx) => {
        const sourceLabel = nodeMap?.[e.source] || e.source;
        const targetLabel = nodeMap?.[e.target] || e.target;
        return (
        <Paper
          key={e.id}
          elevation={selectedId === e.id ? 6 : 1}
          sx={{
            p: 2,
            borderRadius: 2,
            border: selectedId === e.id ? '2px solid' : '1px solid',
            borderColor: selectedId === e.id ? 'primary.main' : 'divider',
            bgcolor: selectedId === e.id ? 'primary.lighter' : 'background.paper',
            cursor: 'pointer',
            mb: 1,
            transition: 'all 0.2s',
          }}
          onClick={() => onSelect(e)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {e.type === 'spark' && <Chip label="창의적 사고" size="small" color="secondary" />}
            {e.type === 'check' && <Chip label="비약 의심" size="small" color="error" />}
            {e.type === 'suggestion' && <Chip label="개념 연결 제안" size="small" color="primary" variant="outlined" />}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {sourceLabel} → {targetLabel}
            </Typography>
          </Box>
          {e.reason && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{e.reason}</Typography>
          )}
          {e.suggestion && (
            <Typography variant="body2" color="primary.main">💡 {e.suggestion}</Typography>
          )}
        </Paper>
      )})
    )}
  </Box>
);
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  useReactFlow,
  ReactFlowProvider,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

// Physics Engine (D3)
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

import { useParams, useNavigate } from 'react-router-dom';
import { requestDeepAnalysis, getDeepAnalysisResult, getFlowGraphImage } from '../services/api';
import { saveDeepAnalysis } from '../services/deepAnalysisStore';

// MUI Components
import { 
  Box, Typography, Paper, Dialog, DialogTitle, 
  DialogContent, DialogActions, Button, Chip, 
  CircularProgress, Alert, Snackbar,
  Fade, LinearProgress, GlobalStyles,
  List, ListItem, ListItemText, Divider,
  IconButton, Tooltip, useTheme,
  
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';

// Icons
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// -----------------------------------------------------------------------------
// 1. Styles & Constants
// -----------------------------------------------------------------------------

const GlobalKeyframes = () => (
  <GlobalStyles styles={{
    '@keyframes sparkFlow': { from: { strokeDashoffset: 1000 }, to: { strokeDashoffset: 0 } },
    '@keyframes dashdraw': { from: { strokeDashoffset: 20 }, to: { strokeDashoffset: 0 } },
    '@keyframes pulse': { 
      '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(213, 0, 249, 0.7)' }, 
      '70%': { transform: 'scale(1.05)', boxShadow: '0 0 0 6px rgba(213, 0, 249, 0)' }, 
      '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(213, 0, 249, 0)' } 
    },
    '@keyframes nudge': {
      '0%, 100%': { transform: 'translateY(-50%) translateX(0)' },
      '50%': { transform: 'translateY(-50%) translateX(-5px)' }
    }
  }} />
);

// -----------------------------------------------------------------------------
// 2. Custom Edge Components
// -----------------------------------------------------------------------------

const SparkEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }) => {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  
  const handleSparkClick = (evt) => {
    evt.stopPropagation();
    if (document.activeElement) document.activeElement.blur();
    data?.onEdgeClick?.(evt, data);
  };

  const isCreative = data?.feedback?.judgment === 'Creative';
  const mainColor = isCreative ? '#d500f9' : '#ff1744'; 
  const labelText = isCreative ? "창의적 사고" : "비약 의심";
  const strokeWidth = Math.max(1, (data.weight || 0) * 60);

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        style={{ 
            stroke: mainColor, 
            strokeWidth: strokeWidth, 
            opacity: 0.5, 
            filter: isCreative ? 'drop-shadow(0 0 3px #d500f9)' : 'none'
        }} 
      />
      <path
        id={id}
        style={{
          stroke: '#fff', strokeWidth: Math.min(2, strokeWidth / 3),
          animation: 'sparkFlow 40s linear infinite',
          opacity: 0.7, fill: 'none',
          strokeDasharray: '10, 20'
        }}
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div style={{
          position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          pointerEvents: 'all', zIndex: 10
        }}>
           <Chip 
             label={labelText} 
             size="small" 
             onClick={handleSparkClick}
             sx={{
               fontSize: '0.8rem', height: 24, cursor: 'pointer', fontWeight: 'bold',
               background: isCreative ? 'linear-gradient(45deg, #aa00ff, #d500f9)' : 'linear-gradient(45deg, #d32f2f, #ff5252)',
               color: 'white', border: '1px solid rgba(255,255,255,0.5)',
               boxShadow: `0 0 8px ${mainColor}`
             }}
           />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const GhostEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }) => {
   const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
   // 외부에서 hovered prop을 받아 강조 효과를 제어
   const isHovered = !!data?.hovered;
   
   const handleGhostClick = (evt) => {
     evt.stopPropagation();
     data?.onEdgeClick?.(evt, data);
   };

   const handleMouseEnter = () => {
     data?.onMouseEnter?.(id);
   };

   const handleMouseLeave = () => {
     data?.onMouseLeave?.();
   };

   return (
     <g 
        onClick={handleGhostClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer' }}
     >
       <path d={edgePath} stroke="transparent" strokeWidth={30} fill="none" style={{ pointerEvents: 'stroke' }} />

       <BaseEdge 
         path={edgePath} 
         markerEnd={markerEnd} 
         style={{ 
            stroke: isHovered ? '#ffc107' : '#b0bec5', 
            strokeWidth: isHovered ? 6 : 3, 
            strokeDasharray: isHovered ? 'none' : '5, 5', 
            opacity: isHovered ? 1 : 0.4,
            filter: isHovered ? 'drop-shadow(0 0 8px gold)' : 'none',
            transition: 'all 0.3s ease'
         }} 
       />

       <EdgeLabelRenderer>
         <div 
           style={{
            position: 'absolute', 
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px) ${isHovered ? 'scale(1.2)' : 'scale(1)'}`,
            pointerEvents: 'none',
            zIndex: 20,
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
         }}>
            <Paper
                elevation={isHovered ? 6 : 0}
                sx={{
                    borderRadius: '50%', width: isHovered ? 48 : 0, height: isHovered ? 48 : 0, 
                    display:'flex', alignItems:'center', justifyContent:'center',
                    bgcolor: '#ffeb3b',
                    border: '2px solid #fbc02d',
                    color: '#e65100',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                }}
            >
                {isHovered && <EmojiObjectsIcon sx={{ fontSize: 28 }} />}
            </Paper>
            
            {!isHovered && (
                <Typography variant="caption" sx={{fontWeight:'bold', color: '#b0bec5', textShadow:'0 0 2px white'}}>
                    연결?
                </Typography>
            )}
         </div>
       </EdgeLabelRenderer>
     </g>
   );
};

// 기본 Edge: weight에 따라 두께가 변하는 커스텀 엣지
const VariableWidthEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd, data }) => {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  // weight에 따라 두께 조정, 최대 30
  const weight = data?.weight || 0.5;
  const minWidth = 2;
  const maxWidth = 30;
  const strokeWidth = Math.max(minWidth, Math.min(maxWidth, weight * 60));
  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: '#546e7a', strokeWidth, opacity: 0.7, ...style }}
    />
  );
};

const edgeTypes = { spark: SparkEdge, ghost: GhostEdge, default: VariableWidthEdge };

// -----------------------------------------------------------------------------
// 3. Hooks
// -----------------------------------------------------------------------------

const useBackendAnalysis = (reportId) => {
  const [status, setStatus] = useState('init'); 
  const [resultData, setResultData] = useState({
    neuron_map: null,
    integrity_issues: null,
    flow_disconnects: null,
    status: 'processing'
  });
  const pollingRef = useRef(null);

  // 🎬 데모용 하드코딩 데이터
  const DEMO_REPORT_ID = '2381065f-68eb-431a-835d-4050833f4a82';
  const DEMO_DATA = {
    flow_disconnects: [
      {
        child_id: "[원인 분석 1]",
        issue_type: "Bridge Needed",
        parent_id: "[핵심 주장]",
        quote: "디지털 네이티브와 디지털 이주민의 간극",
        reason: "핵심 주장에서 원인 분석 1로 넘어갈 때, '국가 차원의 맞춤형 교육 필요성'과 '세대 간 차이 인식' 사이에 보다 명확한 연결고리나 설명이 필요합니다.",
        score: 0.5,
        suggestion: "핵심 주장과 원인 분석 1 사이에서 왜 세대 간 차이가 중요한지 구체적으로 설명해 보면 좋을 것 같아요."
      },
      {
        child_id: "[사례 1]",
        issue_type: "Bridge Needed",
        parent_id: "[원인 분석 1]",
        quote: "디지털 네이티브와 디지털 이주민의 간극",
        reason: "원인 분석 1('기술 학습에 대한 심리적 장애')이 사례(E1)와 어떻게 연결되는지에 대한 추가 설명이 필요합니다. 현재는 단순히 디지털화된 일상생활 예시만 제시되었어요.",
        score: 0.7,
        suggestion: "디지털 이주민이 왜 이러한 서비스 변화에 심리적으로 어려움을 느끼는지 더 자세히 설명해 주는 게 좋겠어요."
      }
    ],
    integrity_issues: [
      {
        quote: "'최근 연구에 따르면'",
        reason: "연구 출처나 구체적인 데이터를 제시하지 않아 신뢰성이 낮음.",
        socratic_suggestion: "'최근 연구'라면 어느 기관/학자의 연구인가요? 특정 자료를 인용하면 더 설득력이 높아질 것 같아요.",
        type: "Ambiguity"
      },
      {
        quote: "'모든 노인들이 유튜브의 가짜 정치 뉴스를 맹신하고 있다'",
        reason: "노인 전체를 동일시하는 과도한 일반화 표현.",
        socratic_suggestion: "'일부 노인들이...' 정도로 수정한다면 통계적 맥락을 반영하면서도 부정적 이미지를 완화할 수 있지 않을까요?",
        type: "Overgeneralization"
      },
      {
        quote: "스마트폰 뱅킹을 할 줄 모르는 노인들은... 모바일 전용 금리 우대 혜택이나 온라인 최저가 쇼핑의 혜택도 누리지 못한다",
        reason: "디지털 미숙지가 경제적 손실로 이어진다는 주장에 대한 구체적 사례나 통계 자료가 없음.",
        socratic_suggestion: "금융감독원 발표 자료 등에서 실제로 발생한 피해 금액이나 사례를 추가하면 주장의 타당성이 높아지지 않을까요?",
        type: "Logical Leap"
      }
    ],
    neuron_map: {
      creative_feedbacks: [
        {
          concepts: ["디지털 빈곤", "고령자 모드"],
          judgment: "Creative",
          feedback: "디지털 빈곤 문제를 기술적 접근(고령자 모드)으로 해결하려는 시도는 매우 창의적입니다. 단순히 교육만으로는 해결할 수 없는 인터페이스 설계의 문제를 지적하고 있어요.",
          reason: "경제적 불평등과 기술적 해결책을 연결하여, 다층적인 문제 해결 방안을 제시하는 통찰력 있는 연결입니다."
        },
        {
          concepts: ["디지털 리터러시", "사회적 배제"],
          judgment: "Check",
          feedback: "디지털 리터러시 부족이 사회적 배제로 직접 연결된다는 주장은 다소 비약이 있을 수 있습니다. 중간 단계(예: 정보 접근성 제한, 경제활동 제약 등)에 대한 설명이 필요합니다.",
          reason: "원인과 결과 사이에 여러 매개 변수가 존재하는데, 이를 생략하고 직접 연결하고 있습니다."
        }
      ],
      edges: [
        { source: "디지털 네이티브/이주민", target: "찾아가는 교육", type: "normal", weight: 0.31 },
        { source: "디지털 네이티브/이주민", target: "사회적 배제", type: "normal", weight: 0.3 },
        { source: "디지털 리터러시", target: "고령자 모드", type: "normal", weight: 0.33 },
        { source: "디지털 빈곤", target: "사회적 배제", type: "normal", weight: 0.32 },
        { source: "찾아가는 교육", target: "사회적 배제", type: "normal", weight: 0.31 },
        { source: "고령자 모드", target: "사회적 배제", type: "normal", weight: 0.33 },
        { source: "디지털 빈곤", target: "고령자 모드", type: "questionable", weight: 0.28, 
          reason: "디지털 빈곤과 고령자 모드 사이의 창의적 연결",
          judgment: "Creative" },
        { source: "디지털 리터러시", target: "사회적 배제", type: "questionable", weight: 0.25,
          reason: "디지털 리터러시에서 사회적 배제로의 직접 연결",
          judgment: "Check" }
      ],
      nodes: [
        { id: "디지털 네이티브/이주민", label: "디지털 네이티브/이주민" },
        { id: "디지털 리터러시", label: "디지털 리터러시" },
        { id: "디지털 빈곤", label: "디지털 빈곤" },
        { id: "찾아가는 교육", label: "찾아가는 교육" },
        { id: "고령자 모드", label: "고령자 모드" },
        { id: "사회적 배제", label: "사회적 배제" }
      ],
      suggestions: [
        {
          target_node: "고령자 모드",
          partner_node: "디지털 네이티브/이주민",
          suggestion: {
            socratic_guide: "고령자 모드라는 기술적 해결책이 세대 간 격차를 어떻게 좁힐 수 있을까요?",
            question: "디지털 네이티브들이 설계한 '고령자 모드'가 정말 디지털 이주민의 니즈를 제대로 반영할 수 있을까요? 사용자 참여형 설계의 필요성은 없을까요?",
            description: "기술 제공자와 수혜자의 관점 차이를 논의하면 더욱 깊이 있는 분석이 될 것입니다."
          },
          score: 0.82
        },
        {
          target_node: "찾아가는 교육",
          partner_node: "디지털 빈곤",
          suggestion: {
            socratic_guide: "교육만으로 경제적 디지털 빈곤 문제를 해결할 수 있을까요?",
            question: "찾아가는 교육이 디지털 기기 구매 능력이 없는 계층에게는 어떤 의미가 있을까요? 교육과 함께 기기 지원 정책도 필요하지 않을까요?",
            description: "교육 접근성과 경제적 접근성을 함께 고려하면 보다 포괄적인 해결책을 제시할 수 있습니다."
          },
          score: 0.79
        }
      ]
    },
    status: "completed"
  };

  const pollData = useCallback(async () => {
    try {
      // 🎬 데모 모드: 특정 reportId일 때 하드코딩 데이터 반환
      if (reportId === DEMO_REPORT_ID) {
        console.log('🎬 [DEMO MODE] 하드코딩된 데이터 사용 중');
        setResultData(DEMO_DATA);
        try { saveDeepAnalysis(reportId, DEMO_DATA); } catch (err) { console.warn('saveDeepAnalysis failed', err); }
        setStatus('done');
        return true;
      }

      // 일반 모드: 실제 백엔드 호출
      const response = await getDeepAnalysisResult(reportId);
      const innerData = response?.data || response; 

      if (innerData) {
        setResultData(innerData);
        try { saveDeepAnalysis(reportId, innerData); } catch (err) { console.warn('saveDeepAnalysis failed', err); }

        if (innerData.status === 'error') {
          setStatus('failed');
          return true; 
        }
        
        if (innerData.status === 'completed') {
          setStatus('done');
          return true; 
        }

        if (innerData.neuron_map || innerData.integrity_issues || innerData.flow_disconnects) {
           setStatus('partial');
        } else {
           setStatus('processing');
        }
      }
      return false; 
    } catch (err) {
      console.error("Polling Error:", err);
      return false; 
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId) return;
    let isMounted = true;

    const init = async () => {
      setStatus('processing');
      try { await requestDeepAnalysis(reportId); } catch(e) { console.warn('Analysis request skipped/failed'); }

      const loop = async () => {
        if (!isMounted) return;
        const stop = await pollData();
        if (!stop) {
          pollingRef.current = setTimeout(loop, 3000);
        }
      };
      loop();
    };

    init();
    return () => { isMounted = false; if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, [reportId, pollData]);

  return { status, resultData };
};

const useGraphLayout = (neuronMap, onEdgeClick, onMouseEnter, onMouseLeave) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!neuronMap?.nodes || processedRef.current) return;

    const initialNodes = neuronMap.nodes.map((n) => ({
      id: n.id,
      data: { 
        label: n.label, 
        type: n.type || '핵심 개념', 
        summary: n.summary || '', 
        score: n.score || 0 
      },
      position: { x: 0, y: 0 }, 
      style: { 
        background: 'rgba(255, 255, 255, 0.98)', 
        border: '2px solid #cfd8dc', 
        borderRadius: '50px',
        padding: '14px 28px', 
        fontWeight: 800,      
        fontSize: '16px',     
        minWidth: '100px',
        textAlign: 'center', 
        boxShadow: '0 6px 15px rgba(0,0,0,0.12)', 
        color: '#263238',
        zIndex: 10
      },
    }));

    const initialEdges = [];
    
    neuronMap.edges?.forEach((e) => {
      const isQuestionable = e.type === 'questionable';
      let feedback = null;
      if (isQuestionable && neuronMap.creative_feedbacks) {
         feedback = neuronMap.creative_feedbacks.find(cf => 
             cf.concepts && 
             cf.concepts.length === 2 &&
             cf.concepts.includes(e.source) && 
             cf.concepts.includes(e.target)
         );
      }
      if (isQuestionable && !feedback) {
         if (e.reason || e.feedback || e.description) {
             feedback = {
                 judgment: e.judgment || 'Check',
                 feedback: e.reason || e.feedback || e.description,
                 reason: e.reason 
             };
         }
      }
      // weight에 따라 두께를 조정, 최대 30으로 제한
      const weight = e.weight || 0.5;
      const minWidth = 2;
      const maxWidth = 30;
      const strokeWidth = Math.max(minWidth, Math.min(maxWidth, weight * 60));
      initialEdges.push({
        id: `edge-${e.source}-${e.target}`,
        source: e.source, target: e.target,
        type: isQuestionable ? 'spark' : 'default', 
        zIndex: isQuestionable ? 100 : 1,
        style: isQuestionable ? {} : { stroke: '#546e7a', strokeWidth, opacity: 0.7 },
        markerEnd: undefined, // 삼각형 화살표 제거
        data: { zone: isQuestionable ? 'C' : 'A', weight: e.weight, feedback, onEdgeClick }
      });
    });

    neuronMap.suggestions?.forEach((s, idx) => {
      initialEdges.push({
        id: `suggestion-${idx}`,
        source: s.target_node, target: s.partner_node,
        type: 'ghost', 
        animated: true, 
        hidden: false, 
        zIndex: 50,
        markerEnd: undefined, // 삼각형 화살표 제거
        data: { zone: 'B', suggestion: s.suggestion, onEdgeClick, onMouseEnter, onMouseLeave }
      });
    });

    const simNodes = initialNodes.map(d => ({ ...d }));
    const simEdges = initialEdges.filter(e => !e.hidden).map(d => ({ ...d, source: d.source, target: d.target }));

    // 노드 간 최소 거리 더 크게 (예: 160)
    const simulation = forceSimulation(simNodes)
      .force("link", forceLink(simEdges).id(d => d.id).distance(d => Math.max(160, d.distance || 160))) // 더 멀리
      .force("charge", forceManyBody().strength(-200)) // 반발력 거의 없음
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(70));

    simulation.tick(300);

    const layoutedNodes = initialNodes.map((n, i) => ({
       ...n, position: { x: simNodes[i].x, y: simNodes[i].y } 
    }));

    setNodes(layoutedNodes);
    setEdges(initialEdges);
    processedRef.current = true;

    setTimeout(() => fitView({ duration: 1000, padding: 0.2 }), 100);

  }, [neuronMap, setNodes, setEdges, fitView, onEdgeClick, onMouseEnter, onMouseLeave]);

  return { nodes, edges, onNodesChange, onEdgesChange, isReady: processedRef.current };
};

// -----------------------------------------------------------------------------
// 4. UI Sub-Components
// -----------------------------------------------------------------------------

// [화면 중앙 하단] Integrity Panel (문장 정합성 검사) - 아코디언 없이 심플하게 나열
const integrityTypeKoMap = {
  Ambiguity: '모호한 표현',
  Overgeneralization: '성급한 일반화',
  Logical_Leap: '논리적 비약',
  'Logical Leap': '논리적 비약',
  Lack_of_Evidence: '구체적 증거 부재',
  'Lack of Evidence': '구체적 증거 부재'
};

const IntegrityPanel = ({ integrity, status }) => {
  const theme = useTheme();
  const safeIntegrity = Array.isArray(integrity) ? integrity : [];
  const isLoading = (status === 'processing' || status === 'init') && integrity == null;

  return (
    <Paper elevation={0} sx={{ width: '100%', bgcolor: theme.palette.background.paper, mt: 2, p: 0 }}>
      <Box sx={{ p: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottom: `2px solid ${theme.palette.primary.main}`, bgcolor: theme.palette.primary.main, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.primary.contrastText }}>
          문장 정합성 검사
        </Typography>
        {safeIntegrity.length > 0 && (
          <Chip label={`${safeIntegrity.length}건 발견`} size="small" sx={{ fontWeight: 'bold', bgcolor: theme.palette.primary.contrastText, color: theme.palette.primary.main }} />
        )}
      </Box>
      <Box sx={{ p: 2, maxHeight: 520, overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1 }}>
            <CircularProgress size={20} color="primary" />
            <Typography variant="body2" color="primary.main">분석 중...</Typography>
          </Box>
        ) : integrity == null ? (
          <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.07), borderRadius: 2, color: theme.palette.primary.main }}>
            <Typography variant="body2" fontWeight="bold">분석 중...</Typography>
          </Box>
        ) : safeIntegrity.length === 0 ? (
          <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.07), borderRadius: 2, color: theme.palette.primary.main }}>
            <Typography variant="body2" fontWeight="bold">모든 문장이 논리적으로 완벽합니다!</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {safeIntegrity.map((issue, idx) => (
              <Paper key={idx} elevation={2} sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), borderLeft: `6px solid ${theme.palette.primary.main}`, transition: 'transform 0.18s ease, box-shadow 0.18s ease', '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 14px 36px rgba(16,24,40,0.12)' } }}>
                {issue.quote && (
                  <Typography variant="body1" sx={{ fontWeight: 700, color: theme.palette.primary.main, fontSize: '1.1rem', mb: 0.5, fontStyle: 'italic' }}>
                    "{issue.quote}"
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="primary.main" sx={{ fontSize: '1.01rem' }}>
                    {integrityTypeKoMap[issue.type] || issue.type || '유형 미상'}
                  </Typography>
                  {issue.reason && (
                    <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontWeight: 500, opacity: 0.85 }}>
                      {issue.reason}
                    </Typography>
                  )}
                </Box>
                {(issue.socratic_suggestion || issue.description) && (
                  <>
                    <Typography variant="caption" display="block" sx={{ fontWeight: 'bold', color: theme.palette.primary.main, mb: 0.5, fontSize: '0.9rem' }}>
                      AITA의 제안
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '1rem', lineHeight: '1.5', color: theme.palette.text.primary }}>
                      {issue.socratic_suggestion || issue.description}
                    </Typography>
                  </>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// [사이드바] Logic Flow Diagram
const DiagramContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  minHeight: 520,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: theme.palette.background.default,
  borderBottom: `1px solid ${theme.palette.divider}`,
  overflow: 'auto',
  padding: '1rem',
}));

const StyledImage = styled('img')({
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '4px',
  boxShadow: '0 10px 30px rgba(16,24,40,0.12)'
});

function LogicFlowDiagram({ reportId }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reportId) return;

    const fetchDiagram = async () => {
      setIsLoading(true);
      setError(null);
      if (imageUrl) { URL.revokeObjectURL(imageUrl); setImageUrl(null); }

      try {
        const imageBlob = await getFlowGraphImage(reportId);
        const localImageUrl = URL.createObjectURL(imageBlob);
        setImageUrl(localImageUrl);
      } catch (err) {
        console.error("논리 흐름도 로딩 오류:", err);
        setError(null); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiagram();
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [reportId]);

  if (isLoading) {
    return <DiagramContainer><CircularProgress /></DiagramContainer>;
  }

  if (imageUrl) {
    return <DiagramContainer><StyledImage src={imageUrl} alt="논리 흐름도" /></DiagramContainer>;
  }

  return (
    <DiagramContainer>
      <Typography variant="body2" color="textSecondary">
        {reportId ? "논리 흐름도 생성 중..." : "리포트를 선택하세요."}
      </Typography>
    </DiagramContainer>
  );
}

// [사이드바] Flow Check Panel - [수정] Theme 적용 및 Chip 제거
const FlowCheckPanel = ({ flow, status }) => {
  const theme = useTheme();
  const safeFlow = Array.isArray(flow) ? flow : [];
  const isLoading = (status === 'processing' || status === 'init') && flow == null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper', overflowY: 'auto' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.secondary.main, position:'sticky', top:0, zIndex:1, color: theme.palette.secondary.contrastText, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
        <Typography variant="subtitle1" sx={{fontWeight:900, color: theme.palette.secondary.contrastText, display:'flex', alignItems:'center', gap:1}}>
          <AccountTreeIcon fontSize="small" sx={{ color: theme.palette.secondary.contrastText }} /> 논리 흐름 검사
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p:1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">분석 중...</Typography>
          </Box>
        ) : flow == null ? (
          <Box sx={{ p: 2, bgcolor: '#fffde7', borderRadius: 2, color: '#fbc02d' }}>
            <Typography variant="body2" fontWeight="bold">분석 중...</Typography>
          </Box>
        ) : safeFlow.length === 0 ? (
          <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, color: theme.palette.success.main }}>
            <Typography variant="body2" fontWeight="bold">논리 흐름이 매끄럽습니다.</Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ bgcolor: 'background.paper' }}>
            {safeFlow.map((gap, idx) => (
              <React.Fragment key={idx}>
                <ListItem alignItems="flex-start" sx={{ px: 0, alignItems: 'flex-start' }}>
                  <ListItemText 
                    secondaryTypographyProps={{ component: 'div' }} 
                    primary={null}
                    secondary={
                      <Box sx={{display:'flex', flexDirection:'column', gap:1}}>
                        {/* 연결 정보 표시 */}
                        <Box sx={{display:'flex', alignItems:'center', gap:0.5, bgcolor: alpha(theme.palette.secondary.contrastText, 0.06), p:1, borderRadius:1}}>
                          <Chip label={gap.parent_id || '?'} size="small" sx={{maxWidth:'40%', height:24}} />
                          <Typography variant="caption">➡</Typography>
                          <Chip label={gap.child_id || '?'} size="small" sx={{maxWidth:'40%', height:24}} />
                        </Box>
                        {/* quote 강조 */}
                        {gap.quote && (
                          <Box sx={{ mt:1, mb:1, bgcolor: alpha(theme.palette.secondary.main, 0.12), p:1.5, borderRadius:2 }}>
                            <Typography variant="body2" sx={{ fontStyle:'italic', color: theme.palette.secondary.contrastText, lineHeight:1.6, fontWeight:700 }}>
                              "{gap.quote}"
                            </Typography>
                          </Box>
                        )}
                        {/* 이유/질문 */}
                        <Box>
                          {gap.reason && (
                            <Typography variant="body2" color="text.primary" sx={{fontWeight:'bold', fontSize:'0.95rem', mb:0.5}}>
                              {gap.reason}
                            </Typography>
                          )}
                          {gap.suggestion && (
                            <Typography variant="caption" color="primary.main" sx={{mt:0.5, display:'block'}}>
                              💡 {gap.suggestion}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
                {idx < safeFlow.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

// Interaction Dialog
const InteractionDialog = ({ open, onClose, content }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
    <DialogTitle sx={{ borderBottom: '1px solid #eee', pb:2, fontWeight: 800 }}>
      {content?.title}
    </DialogTitle>
    <DialogContent sx={{ py: 3 }}>{content?.body}</DialogContent>
    <DialogActions>
      <Button onClick={onClose} variant="contained" size="large" sx={{ borderRadius: 2, px: 4 }}>확인</Button>
    </DialogActions>
  </Dialog>
);

// Debug Data Dialog
const DebugDataDialog = ({ open, onClose, data }) => (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <Typography fontWeight="bold">원본 데이터 (Raw JSON)</Typography>
            <IconButton onClick={onClose}><CloseIcon/></IconButton>
        </DialogTitle>
        <DialogContent dividers>
            <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', overflow: 'auto', maxHeight: '70vh' }}>
                <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                    {JSON.stringify(data, null, 2)}
                </pre>
            </Paper>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>닫기</Button>
        </DialogActions>
    </Dialog>
);

// -----------------------------------------------------------------------------
// 5. Main Content Component
// -----------------------------------------------------------------------------


const LogicNeuronContent = () => {
   const { reportId } = useParams();
   const { status, resultData } = useBackendAnalysis(reportId);
   const theme = useTheme();
  const navigate = useNavigate();

   // hover 핸들러 추가
   const handleEdgeMouseEnter = useCallback((edgeId) => {
     setHoveredEdgeId(edgeId);
   }, []);

   const handleEdgeMouseLeave = useCallback(() => {
     setHoveredEdgeId(null);
   }, []);

   // handleEdgeClick을 먼저 선언
   const handleEdgeClick = useCallback((event, edgeData) => {
    if (event?.stopPropagation) event.stopPropagation();
    const { zone, feedback, suggestion } = edgeData;
    let content = null;

    if (zone === 'C') { 
       const isCreative = feedback?.judgment === 'Creative';
          
       const feedbackText = feedback?.feedback || feedback?.reason || feedback?.description || feedback?.text || "AI가 이 연결에 대한 구체적인 코멘트를 생성하지 못했습니다. (데이터 없음)";
       const reasonText = feedback?.reason || "";

       content = {
        title: isCreative ? '창의적 사고' : '비약 의심', 
        type: isCreative ? 'creative' : 'forced',
        body: (
          <Box>
           <Typography variant="subtitle1" sx={{fontWeight:'bold', color: isCreative ? theme.palette.secondary.main : theme.palette.error.main, mb:1}}>
             {isCreative ? "탁월한 통찰입니다!" : "논리적 비약이 감지되었습니다."}
           </Typography>
           <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5), borderRadius: 2, mb: 2 }}>
             <Typography variant="subtitle2" color="textSecondary" gutterBottom>분석 결과</Typography>
             <Typography variant="body1" sx={{ lineHeight:1.6, fontWeight: 500 }}>
               {feedbackText}
             </Typography>
           </Paper>
                
           {reasonText && (
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.warning.light, 0.1), borderRadius: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}` }}>
                <Typography variant="subtitle2" color="warning.main" gutterBottom>판단 근거</Typography>
                <Typography variant="body2" sx={{ lineHeight:1.5, color: 'text.primary' }}>
                  {reasonText}
                </Typography>
              </Paper>
           )}
          </Box>
        )
       };
    } else if (zone === 'B') { 
       let guideText = "";
       if (typeof suggestion === 'string') {
          guideText = suggestion;
       } else if (typeof suggestion === 'object' && suggestion !== null) {
          guideText = suggestion.socratic_guide || suggestion.question || suggestion.description || suggestion.text || "질문 내용을 찾을 수 없습니다.";
       } else {
          guideText = "가이드 데이터가 없습니다.";
       }

       content = {
        title: '연결 고리 발견', 
        type: 'bridge',
        body: (
          <Box sx={{ display:'flex', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{color:'text.secondary'}}>AITA의 제안</Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ color:'warning.main', lineHeight:1.4, mb: 1 }}>
                "{guideText}"
              </Typography>
              <Typography variant="body2" display="block" sx={{ color:'text.secondary' }}>
                이 질문에 답하며 두 개념 사이의 맥락을 연결해보세요.
              </Typography>
            </Box>
          </Box>
        )
       };
    }

    if (content) setDialogState({ open: true, content });
   }, [theme]);

   // 반드시 훅 선언 순서 준수: nodes, edges 등 먼저 선언
   const { nodes, edges, onNodesChange, onEdgesChange, isReady } = useGraphLayout(resultData?.neuron_map, handleEdgeClick, handleEdgeMouseEnter, handleEdgeMouseLeave);

   // 1. 이슈 edge 추출 (spark, check, suggestion)
   const edgeIssues = useMemo(() => {
      const map = resultData?.neuron_map;
      if (!map?.edges) return [];
      const issues = [];
      // spark, check(빨간선)
      map.edges.forEach((e) => {
        const isSpark = e.type === 'questionable';
        const isCheck = e.type === 'check' || (!isSpark && e.type === 'forced');
        if (!isSpark && !isCheck) return;
        let feedback = null;
        if (isSpark && map.creative_feedbacks) {
          feedback = map.creative_feedbacks.find(cf =>
            cf.concepts &&
            cf.concepts.length === 2 &&
            cf.concepts.includes(e.source) &&
            cf.concepts.includes(e.target)
          );
        }
        if (!feedback && (e.reason || e.feedback || e.description)) {
          feedback = {
            judgment: e.judgment || 'Check',
            feedback: e.reason || e.feedback || e.description,
            reason: e.reason
          };
        }
        
        // 🔥 수정: judgment에 따라 라벨 결정
        const isCreativeJudgment = feedback?.judgment === 'Creative';
        
        issues.push({
          id: `edge-${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          isCreative: isCreativeJudgment,
          label: isCreativeJudgment ? '창의적 사고' : '비약 의심',
          reason: feedback?.reason || '',
          suggestion: feedback?.feedback || '',
          edgeRaw: e,
          type: isCreativeJudgment ? 'spark' : 'check',
        });
      });
      // suggestion(점선) edge
      if (Array.isArray(map.suggestions)) {
        map.suggestions.forEach((s, idx) => {
          issues.push({
            id: `suggestion-${idx}`,
            source: s.target_node,
            target: s.partner_node,
            isCreative: false,
            label: '개념 연결 제안',
            reason: '',
            suggestion: typeof s.suggestion === 'string' ? s.suggestion : (s.suggestion?.socratic_guide || s.suggestion?.question || s.suggestion?.description || s.suggestion?.text || ''),
            edgeRaw: s,
            type: 'suggestion',
          });
        });
      }
      return issues;
    }, [resultData]);

    // 2. 선택된 이슈 edge 상태 + hoveredEdgeId(ghost edge 강조용)
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);
    const [hoveredEdgeId, setHoveredEdgeId] = useState(null); // ghost edge hover 효과용
    const reactFlowInstance = useReactFlow();

    // 3. 사이드바 edge 클릭 핸들러 (reactflow 이동/강조/hover)
    const handleEdgeIssueSelect = useCallback((edge) => {
      setSelectedEdgeId(edge.id);
      // suggestion(ghost) edge 클릭 시 hover 효과도 트리거
      if (edge.type === 'suggestion') {
        setHoveredEdgeId(edge.id);
      }
      // 해당 edge의 source/target 노드 위치로 이동 (center)
      const edgeObj = edges.find(e => e.id === edge.id);
      if (!edgeObj) return;
      const sourceNode = nodes.find(n => n.id === edgeObj.source);
      const targetNode = nodes.find(n => n.id === edgeObj.target);
      if (sourceNode && targetNode) {
        // 두 노드의 중간 위치 계산
        const centerX = (sourceNode.position.x + targetNode.position.x) / 2;
        const centerY = (sourceNode.position.y + targetNode.position.y) / 2;
        reactFlowInstance.setCenter(centerX, centerY, { zoom: 1.3, duration: 600 });
      }
    }, [edges, nodes, reactFlowInstance]);


    const [dialogState, setDialogState] = useState({ open: false, content: null });
     const [snackState, setSnackState] = useState({ open: false, message: '' });
     const [showDebug, setShowDebug] = useState(false);


    const isTotalLoading = (status === 'init' || status === 'processing') && !resultData?.neuron_map;

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'background.default', overflow: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <GlobalKeyframes />

      {/* 1. Header (compact height) */}
      <Box sx={{ p: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`, zIndex: 10, height: 56, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
          개념 연결망
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {(status === 'processing' || status === 'partial') && (
            <Fade in={true}><Chip label="AITA 실시간 분석 중..." color="primary" variant="outlined" /></Fade>
          )}
          {status === 'done' && <Chip label="분석 완료" color="success" />}
        </Box>
      </Box>

      {status === 'partial' && <LinearProgress color="secondary" sx={{ height: 2, flexShrink: 0 }} />}

      {/* 2. Main Content Stack: Neuron Map -> Edge Issues -> Flow Check -> Integrity */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        {/* Neuron Map */}
        <Paper elevation={1} sx={{ width: '100%', minHeight: 360, borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ width: '100%', height: 360 }}>
            {isTotalLoading && (
              <Box sx={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.background.paper, 0.8) }}>
                <CircularProgress size={60} />
                <Typography sx={{ mt: 2, fontWeight: 'bold', color: 'text.secondary' }}>개념 연결망을 생성하고 있습니다...</Typography>
              </Box>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges.map(e => {
                if (e.type === 'ghost') {
                  const isHovered = hoveredEdgeId === e.id;
                  return {
                    ...e,
                    data: {
                      ...e.data,
                      selected: selectedEdgeId === e.id,
                      hovered: isHovered
                    }
                  };
                }
                if (selectedEdgeId && e.id === selectedEdgeId) {
                  return {
                    ...e,
                    style: {
                      ...(e.style || {}),
                      stroke: '#ffd600',
                      strokeWidth: (e.style?.strokeWidth || 6) + 6,
                      opacity: 1,
                      filter: 'drop-shadow(0 0 12px #ffd600)'
                    },
                    data: {
                      ...e.data,
                      selected: true
                    }
                  };
                }
                return {
                  ...e,
                  style: {
                    ...(e.style || {}),
                    opacity: 0.7,
                    filter: 'none'
                  },
                  data: {
                    ...e.data,
                    selected: false
                  }
                };
              })}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              edgeTypes={edgeTypes}
              fitView minZoom={0.2} maxZoom={4}
            >
              <Background color="#e3f2fd" variant="lines" gap={10000} />
              <Controls showInteractive={false} />
              <Panel position="bottom-right" style={{ marginRight: 20, marginBottom: 20 }}>
                <Button variant="contained" color="inherit" size="small" onClick={() => setShowDebug(true)} sx={{ bgcolor: alpha(theme.palette.grey[800], 0.8), color: '#fff', fontSize: '0.75rem' }}>
                  원본 데이터
                </Button>
              </Panel>
            </ReactFlow>
          </Box>
        </Paper>

        {/* Edge Issues (full width) */}
        <EdgeIssueSidebar
          edgeIssues={edgeIssues}
          onSelect={handleEdgeIssueSelect}
          selectedId={selectedEdgeId}
          nodeMap={useMemo(() => {
            const map = {};
            nodes.forEach(n => { map[n.id] = n.data?.label || n.id; });
            return map;
          }, [nodes])}
          isAnalyzing={status === 'init' || status === 'processing' || status === 'partial' || !resultData?.neuron_map}
        />

        {/* Flow Check + Logic Flow Diagram (responsive: column on xs, row on md+) */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'stretch' }}>
          <Box sx={{ flex: 1, minWidth: 0, height: { md: 520 }, overflow: 'auto' }}>
            <FlowCheckPanel flow={resultData.flow_disconnects} status={status} />
          </Box>
          <Box sx={{ width: { xs: '100%', md: 520 }, flexShrink: 0, height: { md: 520 } }}>
            <LogicFlowDiagram reportId={reportId} />
          </Box>
        </Box>

        {/* Integrity */}
        <Box>
          <IntegrityPanel integrity={resultData.integrity_issues} status={status} />
        </Box>

        {/* 리포트분석(이전 페이지)로 돌아가는 버튼 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={() => navigate(-1)}
            sx={{ fontWeight: 'bold', borderRadius: 2, px: 4 }}
          >
            리포트 분석 목록으로 돌아가기
          </Button>
        </Box>
      </Box>

      {/* Dialogs */}
      <InteractionDialog
        open={dialogState.open}
        onClose={() => setDialogState(prev => ({ ...prev, open: false }))}
        content={dialogState.content}
      />

      <DebugDataDialog
        open={showDebug}
        onClose={() => setShowDebug(false)}
        data={resultData}
      />

      <Snackbar
        open={snackState.open}
        autoHideDuration={5000}
        onClose={() => setSnackState(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled" sx={{ width: '100%', boxShadow: 4, bgcolor: 'grey.900', color: '#fff', fontWeight: 'bold' }}>
          {snackState.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const LogicNeuronPage = () => (
    <ReactFlowProvider>
        <LogicNeuronContent />
    </ReactFlowProvider>
);

export default LogicNeuronPage;