import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
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
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

// Physics Engine
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

import { useParams } from 'react-router-dom';
import { requestDeepAnalysis, getDeepAnalysisResult } from '../services/api';

// MUI Components
import { 
  Box, Typography, Paper, Dialog, DialogTitle, 
  DialogContent, DialogActions, Button, Chip, 
  CircularProgress, Alert, Snackbar,
  Fade, LinearProgress, GlobalStyles,
  List, ListItem, ListItemText, ListItemIcon, Divider, Skeleton
} from '@mui/material';

// Icons
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ConstructionIcon from '@mui/icons-material/Construction';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

// -----------------------------------------------------------------------------
// 1. Constants & Styles
// -----------------------------------------------------------------------------

const GlobalKeyframes = () => (
  <GlobalStyles styles={{
    '@keyframes sparkFlow': { from: { strokeDashoffset: 1000 }, to: { strokeDashoffset: 0 } },
    '@keyframes dashdraw': { from: { strokeDashoffset: 20 }, to: { strokeDashoffset: 0 } },
    '@keyframes pulse': { 
      '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(213, 0, 249, 0.7)' }, 
      '70%': { transform: 'scale(1.05)', boxShadow: '0 0 0 6px rgba(213, 0, 249, 0)' }, 
      '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(213, 0, 249, 0)' } 
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
    data?.onEdgeClick?.(evt);
  };

  const isCreative = data?.feedback?.judgment === 'Creative';
  const mainColor = isCreative ? '#d500f9' : '#ff1744'; 

  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke: mainColor, strokeWidth: 12, opacity: 0.15, filter: 'blur(6px)' }} />
      <path
        id={id}
        style={{
          stroke: mainColor, strokeWidth: 3, strokeDasharray: '10, 5',
          animation: 'sparkFlow 40s linear infinite',
          filter: `drop-shadow(0 0 2px ${mainColor})`, fill: 'none'
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
             icon={<AutoFixHighIcon style={{fontSize: 14, color: '#fff'}} />} 
             label={isCreative ? "Spark!" : "Check"} size="small" onClick={handleSparkClick}
             sx={{
               fontSize: '0.7rem', height: 24, cursor: 'pointer', 
               background: isCreative ? 'linear-gradient(45deg, #aa00ff, #d500f9)' : 'linear-gradient(45deg, #d32f2f, #ff5252)',
               color: 'white', border: '1px solid rgba(255,255,255,0.5)',
               boxShadow: `0 0 10px ${mainColor}`, animation: 'pulse 2s infinite'
             }}
           />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const GhostEdge = ({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd }) => {
   const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
   return (
     <>
       <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ stroke: '#ff9800', strokeWidth: 2, strokeDasharray: '5, 5', animation: 'dashdraw 1s linear infinite', opacity: 0.8 }} />
       <EdgeLabelRenderer>
         <div style={{
           position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
           pointerEvents: 'all', zIndex: 10, background: '#fff', padding: '2px 8px',
           borderRadius: '12px', border: '1px solid #ff9800', boxShadow: '0 2px 4px rgba(255,152,0,0.2)'
         }}>
            <Typography variant="caption" sx={{fontWeight:'bold', color: '#e65100', display:'flex', alignItems:'center', gap:0.5}}>
              <LinkOffIcon fontSize="inherit"/> Link?
            </Typography>
         </div>
       </EdgeLabelRenderer>
     </>
   );
};

// ✅ [Fix] edgeTypes를 컴포넌트 밖으로 이동하여 리렌더링 시 경고 방지
const edgeTypes = { spark: SparkEdge, ghost: GhostEdge };

// -----------------------------------------------------------------------------
// 3. Logic Helpers (D3 & Data Transformation)
// -----------------------------------------------------------------------------

const calculateForceLayout = (nodes, edges) => {
  const simulationNodes = nodes.map((node) => ({ ...node }));
  const simulationEdges = edges
      .filter(e => !e.hidden)
      .map((edge) => ({ ...edge, source: edge.source, target: edge.target }));

  const simulation = forceSimulation(simulationNodes)
      .force("link", forceLink(simulationEdges)
          .id((d) => d.id)
          .distance((d) => 200 - ((d.data?.weight || 0.5) * 100))
      )
      .force("charge", forceManyBody().strength(-2500)) 
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(80));

  simulation.tick(300); // Synchronous calculation

  return nodes.map((node) => {
      const simNode = simulationNodes.find((n) => n.id === node.id);
      return { ...node, position: { x: simNode.x, y: simNode.y } };
  });
};

// -----------------------------------------------------------------------------
// 4. Custom Hooks
// -----------------------------------------------------------------------------

const useAnalysisPolling = (reportId) => {
  // 상태 정의: init | processing | partial | done | failed (새로 추가)
  const [status, setStatus] = useState('init'); 
  const [data, setData] = useState({}); 
  const pollingRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      console.log(`[Polling] 🛑 Report #${reportId}: 폴링 중지됨.`);
    }
  }, [reportId]);

  const pollData = useCallback(async () => {
    const now = new Date().toLocaleTimeString();
    console.log(`[Polling] 🔄 Report #${reportId}: 결과 조회 시도... (${now})`);
    
    try {
      const res = await getDeepAnalysisResult(reportId);

      // API 응답 구조를 기반으로 상태 확인
      const apiStatus = res?.status || 'unknown';
      console.log(`[Polling] ✅ Report #${reportId}: 응답 수신. Status=${apiStatus}`);

      // ************ 🐛 디버깅 로그 ************
      if (apiStatus === 'error' || apiStatus === 'unknown' || res?.data?.status === 'error') {
          console.error(`[Polling DEBUG] 🚨 Status=${apiStatus} 이므로, 수신된 전체 Data 객체 확인:`, res?.data);
      }
      // *******************************************

      if (res?.data) {
        setData(res.data);
        
        // --- [수정된 부분]: 오류 상태 확인 및 폴링 중지 ---
        if (res.data.status === 'error') {
          setStatus('failed'); // 'failed' 상태로 변경
          stopPolling();
          console.error(`[Polling] ⛔ 백엔드 분석 오류 확인. 폴링 중지. 메시지: ${res.data.message}`);
          return;
        }
        // ---------------------------------------------
        
        if (res.data.status === 'completed') {
          setStatus('done');
          stopPolling();
          console.log(`[Polling] 🏆 최종 완료 상태 확인. 폴링 중지.`);
          return; // 완료 시 이후 코드 실행 방지
        }
        
        // 상태 결정 로직: 완료나 에러가 아닐 경우, 부분 데이터 수신 여부 확인
        const hasAnyData = res.data.neuron_map || res.data.integrity_issues || res.data.flow_disconnects;
        if (hasAnyData) {
            // 'done' 상태가 아니라면 'partial'로 설정
            setStatus((prev) => (prev === 'done' ? 'done' : 'partial')); 
            console.log(`[Polling] 📈 부분 데이터 수신 완료. UI 업데이트.`);
        }
        
      } else if (apiStatus === 'pending') {
         console.log(`[Polling] ⏳ 분석 결과 미완료 (Pending 상태). 다음 폴링 대기.`);
      }

    } catch (error) {
      // AxiosError가 발생했거나, getDeepAnalysisResult에서 throw된 경우
      const errorStatus = error.response?.status || 'Network/Unknown';
      console.error(`[Polling] ❌ Report #${reportId}: 폴링 에러 발생. Status: ${errorStatus}`, error);
      // 에러가 나더라도 폴링은 계속 시도함 (네트워크 일시적 문제 가정)
    }
  }, [reportId, stopPolling]);

  useEffect(() => {
    if (!reportId) return;
    
    const start = async () => {
      console.log(`[Polling] 🚀 Report #${reportId} 폴링 초기화 시작.`);
      setStatus('processing');
      stopPolling(); // 혹시 모를 이전 인터벌 정리

      try {
        // 1. 초기 데이터 상태 체크 (분석이 이미 완료되었는지 확인)
        let res = await getDeepAnalysisResult(reportId);
        console.log(`[Polling] 💡 초기 상태 체크 결과: Status=${res?.status}`);
        
        if (res?.data?.status === 'completed' || res?.data?.status === 'error') {
            setData(res.data);
            setStatus(res.data.status === 'completed' ? 'done' : 'failed'); // 초기에도 에러 핸들링
            console.log(`[Polling] 🎯 초기 체크에서 ${res.data.status} 상태 확인. 폴링 불필요.`);
            return;
        } 
        
        // 2. 결과가 없거나 (pending), 진행 중인 상태인 경우
        if (res?.status === 'pending') {
            // 결과가 없으면 분석 요청을 시도
            try { 
                console.log('[Polling] ➡️ 결과가 없어 분석 요청 시도...');
                await requestDeepAnalysis(reportId); 
            } catch (e) { 
                console.warn('[Polling] 분석 요청 API 오류 발생 (이미 진행 중일 수 있음).');
            }
        }
        
        // 3. 폴링 시작
        pollingRef.current = setInterval(pollData, 3000);
        console.log(`[Polling] ⏱️ 3초 간격으로 폴링 시작.`);

      } catch (error) {
        // 초기 체크 자체가 실패한 경우 (API 에러 등) -> 분석 요청 후 폴링 시작
        console.error('[Polling] 초기 getDeepAnalysisResult 에러 발생. 분석 요청 후 폴링 시작.', error);
        try { await requestDeepAnalysis(reportId); } catch(e) { console.warn('[Polling] 분석 요청 API도 실패했습니다.'); }
        pollingRef.current = setInterval(pollData, 3000);
      }
    };

    start();
    return stopPolling; // 컴포넌트 언마운트 시 폴링 중지
  }, [reportId, pollData, stopPolling]);

  return { status, data };
};

const useGraphTransformation = (rawMap, onEdgeClickCallback) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const isGraphLoaded = useRef(false);
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (isGraphLoaded.current || !rawMap?.nodes) return;

    const newNodes = rawMap.nodes.map((n) => ({
      id: n.id,
      data: { label: n.label },
      position: { x: 0, y: 0 }, 
      style: { 
        background: 'rgba(255, 255, 255, 0.95)', border: '1px solid #cfd8dc', borderRadius: '50px',
        padding: '10px 24px', fontWeight: 700, fontSize: '14px', minWidth: '80px',
        textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', color: '#37474f',
        cursor: 'pointer', transition: 'all 0.3s ease'
      },
    }));

    const newEdges = [];
    rawMap.edges?.forEach((e) => {
      const isQuestionable = e.type === 'questionable'; 
      const feedback = isQuestionable && rawMap.creative_feedbacks 
        ? rawMap.creative_feedbacks.find(cf => cf.concepts.includes(e.source) && cf.concepts.includes(e.target))
        : null;
      
      newEdges.push({
        id: `edge-${e.source}-${e.target}`,
        source: e.source, target: e.target,
        type: isQuestionable ? 'spark' : 'default', 
        zIndex: isQuestionable ? 10 : 1,
        style: isQuestionable ? {} : { stroke: '#546e7a', strokeWidth: Math.max(2, (e.weight || 0.5) * 8), opacity: 0.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: isQuestionable ? (feedback?.judgment === 'Creative' ? '#d500f9' : '#ff1744') : '#546e7a' },
        data: { zone: isQuestionable ? 'C' : 'A', weight: e.weight, feedback, onEdgeClick: onEdgeClickCallback }
      });
    });

    rawMap.suggestions?.forEach((s, idx) => {
      newEdges.push({
        id: `suggestion-${idx}`,
        source: s.target_node, target: s.partner_node,
        type: 'ghost', animated: true, hidden: true, zIndex: 5,
        data: { zone: 'B', suggestion: s.suggestion, onEdgeClick: onEdgeClickCallback }
      });
    });

    const layoutedNodes = calculateForceLayout(newNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(newEdges);
    
    isGraphLoaded.current = true;
    setTimeout(() => fitView({ duration: 1500, padding: 0.2 }), 100);
  }, [rawMap, setNodes, setEdges, fitView, onEdgeClickCallback]);

  const revealConnectedEdges = useCallback((nodeId) => {
    let revealed = 0;
    setEdges(eds => eds.map(e => {
        if (e.data?.zone === 'B' && e.hidden && (e.source === nodeId || e.target === nodeId)) {
            revealed++;
            return { ...e, hidden: false };
        }
        return e;
    }));
    return revealed;
  }, [setEdges]);

  return { nodes, edges, onNodesChange, onEdgesChange, revealConnectedEdges, isGraphLoaded: isGraphLoaded.current };
};

// -----------------------------------------------------------------------------
// 5. Sub-Components for UI
// -----------------------------------------------------------------------------

const AnalysisHeader = ({ status }) => (
  <Box sx={{ p: 2, px:3, display: 'flex', justifyContent: 'space-between', alignItems:'center', background: '#fff', borderBottom: '1px solid #e0e0e0', zIndex: 10 }}>
    <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, color: '#1a237e' }}>
      <PsychologyIcon fontSize="large" color="primary" /> Logic Neuron Map
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {status === 'partial' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} color="inherit" />
          <Typography variant="caption" color="text.secondary">실시간 분석 중...</Typography>
        </Box>
      )}
      {(status === 'partial' || status === 'done') && (
         <Box sx={{display:'flex', gap:1.5}}>
            <Box sx={{display:'flex', alignItems:'center', gap:0.5, px:1, border:'1px solid #eee', borderRadius:2}}>
              <Box sx={{width:20, height:4, bgcolor:'#546e7a'}} />
              <Typography variant="caption" color="text.secondary">튼튼한 논리</Typography>
            </Box>
            <Box sx={{display:'flex', alignItems:'center', gap:0.5, px:1, border:'1px solid #eee', borderRadius:2}}>
               <AutoFixHighIcon sx={{fontSize:16, color:'#d500f9'}} />
               <Typography variant="caption" color="text.secondary">Creative Spark</Typography>
            </Box>
         </Box>
      )}
    </Box>
  </Box>
);

// ✅ [Fix] 중괄호 닫기 오류 수정됨
const AnalysisSidePanel = ({ integrity, flow }) => {
  return (
    <Paper elevation={3} sx={{ 
        width: 320, borderLeft: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', 
        bgcolor: '#fcfcfc', height: '100%', overflowY: 'auto', zIndex: 5 
    }}>
      
      {/* 2. Integrity Section */}
      <Box sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{fontWeight:800, mb:2, display:'flex', alignItems:'center', gap:1, color: '#37474f'}}>
          <WarningAmberIcon fontSize="small" color="warning"/> 문장 정합성 (Integrity)
        </Typography>
        
        {integrity ? (
           integrity.length === 0 ? (
              <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, color: '#2e7d32', display:'flex', alignItems:'center', gap:1 }}>
                 <CheckCircleOutlineIcon fontSize="small"/> <Typography variant="body2" fontWeight="bold">완벽합니다!</Typography>
              </Box>
           ) : (
              <List dense disablePadding sx={{ bgcolor:'#fff', borderRadius:2, border:'1px solid #eee' }}>
                {integrity.map((issue, idx) => (
                   <React.Fragment key={idx}>
                      <ListItem alignItems="flex-start">
                         <ListItemIcon sx={{minWidth: 30, mt:0.5}}><ErrorOutlineIcon fontSize="small" color="error"/></ListItemIcon>
                         <ListItemText 
                            primary={<Typography variant="body2" fontWeight="bold" color="text.primary">{issue.type}</Typography>}
                            secondary={<Typography variant="caption" color="text.secondary">{issue.description}</Typography>} 
                         />
                      </ListItem>
                      {idx < integrity.length - 1 && <Divider component="li" />}
                   </React.Fragment>
                ))}
              </List>
           )
        ) : (
           // Loading State
           <Box sx={{ display:'flex', alignItems:'center', gap: 2, p:1 }}>
             <CircularProgress size={20} />
             <Typography variant="body2" color="text.secondary">정합성 검사 중...</Typography>
           </Box>
        )}
      </Box>

      <Divider />

      {/* 3. Flow Disconnects Section */}
      <Box sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{fontWeight:800, mb:2, display:'flex', alignItems:'center', gap:1, color: '#37474f'}}>
          <LinkOffIcon fontSize="small" color="action"/> 논리 흐름 (Flow Check)
        </Typography>

        {flow ? (
           flow.length === 0 ? (
              <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, color: '#2e7d32', display:'flex', alignItems:'center', gap:1 }}>
                 <CheckCircleOutlineIcon fontSize="small"/> <Typography variant="body2" fontWeight="bold">흐름이 매끄럽습니다.</Typography>
              </Box>
           ) : (
              <List dense disablePadding sx={{ bgcolor:'#fff', borderRadius:2, border:'1px solid #eee' }}>
                {flow.map((gap, idx) => (
                   <React.Fragment key={idx}>
                      <ListItem alignItems="flex-start">
                         <ListItemText 
                            primary={<Typography variant="body2" fontWeight="bold" color="text.primary">단절 구간 {idx+1}</Typography>}
                            secondary={
                              <Box component="span" sx={{display:'flex', flexDirection:'column', mt:0.5, gap:0.5}}>
                                <Chip label={gap.from} size="small" variant="outlined" sx={{maxWidth:'100%'}} />
                                <Typography variant="caption" align="center">⬇️</Typography>
                                <Chip label={gap.to} size="small" variant="outlined" sx={{maxWidth:'100%'}} />
                                <Typography variant="caption" color="error" sx={{mt:0.5}}>{gap.reason}</Typography>
                              </Box>
                            }
                         />
                      </ListItem>
                      {idx < flow.length - 1 && <Divider component="li" />}
                   </React.Fragment>
                ))}
              </List>
           )
        ) : (
           // Loading State (Skeleton)
           <Box sx={{ display:'flex', flexDirection:'column', gap: 1 }}>
             <Box sx={{ display:'flex', alignItems:'center', gap: 2, mb: 1 }}>
                <CircularProgress size={20} color="secondary"/>
                <Typography variant="body2" color="text.secondary">흐름 끊김 확인 중...</Typography>
             </Box>
             <Skeleton variant="rectangular" height={60} sx={{borderRadius:2}} />
             <Skeleton variant="text" width="60%" />
           </Box>
        )}
      </Box>
    </Paper>
  );
};

const MapGuidePanel = () => (
  <Box sx={{ position: 'absolute', bottom: 30, left: 30, bgcolor: 'rgba(255,255,255,0.95)', p: 2.5, borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: 320, backdropFilter:'blur(10px)' }}>
    <Typography variant="subtitle2" sx={{fontWeight: 800, mb:1.5, color: '#1a237e', display:'flex', alignItems:'center', gap:1}}>
      🧠 탐험 가이드
    </Typography>
    <Box sx={{ display:'flex', flexDirection:'column', gap: 1 }}>
      <Typography variant="body2" sx={{ fontSize:'0.85rem' }}>
        🏝️ <b>외딴 섬(Node)</b>을 눌러보세요.<br/>
        <span style={{color:'#ef6c00', fontSize:'0.8rem', marginLeft:'24px'}}>👉 숨겨진 연결 고리(Missing Link)가 나타납니다.</span>
      </Typography>
      <Typography variant="body2" sx={{ fontSize:'0.85rem' }}>
        ⚡ <b>반짝이는 선</b>을 눌러보세요.<br/>
        <span style={{color:'#9c27b0', fontSize:'0.8rem', marginLeft:'24px'}}>👉 창의적인 연결인지, 억지인지 AI가 판단해줍니다.</span>
      </Typography>
    </Box>
  </Box>
);

const InteractionDialog = ({ open, onClose, content }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #eee', pb:2 }}>
      {content.type === 'creative' && <AutoFixHighIcon sx={{color:'#d500f9'}} />}
      {content.type === 'forced' && <ConstructionIcon sx={{color:'#d32f2f'}} />}
      {content.type === 'bridge' && <LinkOffIcon sx={{color:'#ff9800'}} />}
      <Typography variant="h6" component="span" sx={{ fontWeight: 800 }}>{content.title}</Typography>
    </DialogTitle>
    <DialogContent sx={{ py: 3 }}>{content.body}</DialogContent>
    <DialogActions>
      <Button onClick={onClose} variant="contained" sx={{ borderRadius: 2, px: 4, bgcolor:'#37474f' }}>확인</Button>
    </DialogActions>
  </Dialog>
);

const LoadingOverlay = ({ label }) => (
  <Fade in={true}>
    <Box sx={{ position: 'absolute', inset:0, display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', zIndex: 20, bgcolor: 'rgba(255,255,255,0.85)', backdropFilter:'blur(4px)' }}>
      <CircularProgress size={60} thickness={4} sx={{color:'#1a237e', mb: 3}} />
      <Typography variant="h6" color="text.primary" fontWeight="bold">신경망을 스캔하고 있습니다...</Typography>
      <Typography variant="body2" color="text.secondary">{label || "논리적 연결 강도와 창의적 스파크를 분석 중입니다."}</Typography>
    </Box>
  </Fade>
);

// -----------------------------------------------------------------------------
// 6. Main Component
// -----------------------------------------------------------------------------

const LogicNeuronContent = () => {
  const { reportId } = useParams();
  
  // State
  const [dialogState, setDialogState] = useState({ open: false, content: { title: '', body: null, type: '' } });
  const [snackState, setSnackState] = useState({ open: false, message: '' });
  
  // 1. Get Data (Polling)
  const { status, data } = useAnalysisPolling(reportId);

  // 2. Interaction Handlers
  const handleEdgeClick = useCallback((event, edgeData) => {
    if (event?.stopPropagation) event.stopPropagation();
    if (document.activeElement) document.activeElement.blur();

    const { zone, feedback, suggestion } = edgeData;
    let content = {};

    if (zone === 'C') {
        const isCreative = feedback?.judgment === 'Creative';
        content = {
          title: isCreative ? '✨ Creative Spark!' : '🔧 연결 정비 필요',
          type: isCreative ? 'creative' : 'forced',
          body: (
            <Box>
              <Typography variant="h6" sx={{ color: isCreative ? '#7b1fa2' : '#d32f2f', fontWeight: 'bold', mb: 2 }}>
                {isCreative ? "탁월한 통찰력입니다!" : "논리적 연결이 조금 어색해요."}
              </Typography>
              <Paper elevation={0} sx={{ p: 2, bgcolor: isCreative ? '#f3e5f5' : '#ffebee', borderRadius: 2, display: 'flex', gap: 2 }}>
                 <Box sx={{ mt: 0.5 }}>{isCreative ? <EmojiEventsIcon sx={{ fontSize: 40, color: '#aa00ff' }} /> : <ConstructionIcon sx={{ fontSize: 40, color: '#d32f2f' }} />}</Box>
                 <Box>
                    <Typography variant="subtitle1" sx={{fontWeight:'bold', mb:0.5}}>AI 분석 코멘트</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{feedback?.feedback || "분석 데이터가 없습니다."}</Typography>
                 </Box>
              </Paper>
            </Box>
          )
        };
    } else if (zone === 'B') {
        content = {
          title: '🌉 Missing Link 발견',
          type: 'bridge',
          body: (
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 2, display:'flex', gap: 2, alignItems:'flex-start' }}>
               <LightbulbIcon sx={{ fontSize: 30, color: '#ff9800', mt:0.5 }} />
               <Box>
                 <Typography variant="body1" sx={{ fontSize: '1.05rem', fontWeight: 600, color:'#e65100', mb: 1 }}>"{suggestion?.socratic_guide}"</Typography>
                 <Typography variant="body2" sx={{ color:'#ef6c00' }}>이 두 개념 사이에는 숨겨진 맥락이 있습니다. 위 질문에 답하며 글을 확장해보세요.</Typography>
               </Box>
            </Paper>
          )
        };
    }
    setDialogState({ open: true, content });
  }, []);

  // 3. Transform Data & Layout
  const onEdgeClickAdapter = useCallback((evt, edge) => handleEdgeClick(evt, edge.data), [handleEdgeClick]);
  const { nodes, edges, onNodesChange, onEdgesChange, revealConnectedEdges, isGraphLoaded } = useGraphTransformation(data?.neuron_map, onEdgeClickAdapter);

  // 4. Node Click Handler
  const onNodeClick = useCallback((event, node) => {
     if (document.activeElement) document.activeElement.blur();
     const count = revealConnectedEdges(node.id);
     if (count > 0) setSnackState({ open: true, message: `🔍 ${count}개의 잠재적 연결 고리를 발견했습니다! 주황색 선을 확인하세요.` });
  }, [revealConnectedEdges]);

  useEffect(() => {
    if (status === 'partial' && isGraphLoaded) setSnackState({ open: true, message: "🧠 신경망 데이터가 수신되었습니다. 추가 분석을 기다립니다..." });
    if (status === 'done') setSnackState({ open: true, message: "✅ 모든 AI 심층 분석이 완료되었습니다." });
  }, [status, isGraphLoaded]);

  // 로딩 로직: 초기 진입 시 아예 데이터가 없으면 전체 로딩, 하나라도 있으면 화면 표시
  const isTotallyEmpty = (status === 'init' || status === 'processing') && !isGraphLoaded && !data?.integrity_issues && !data?.flow_disconnects;

  return (
    <Paper elevation={0} sx={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5' }}>
      <GlobalKeyframes />
      
      <AnalysisHeader status={status} />
      {status === 'partial' && <LinearProgress color="secondary" sx={{ height: 2 }} />}

      <Box sx={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        
        {/* 1. Neuron Map Area */}
        <Box sx={{ flex: 1, position: 'relative', height: '100%' }}>
            {/* 데이터는 없지만 아직 로딩 중일 때만 오버레이 표시 (부분 로딩 시에는 지도만 먼저 보여줌) */}
            {isTotallyEmpty && <LoadingOverlay label="논리 지도를 그리는 중..." />}
            
            {/* 그래프 데이터가 있으면 렌더링, 없으면 빈 화면(또는 로딩오버레이 뒤) */}
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick} onEdgeClick={onEdgeClickAdapter}
              edgeTypes={edgeTypes} // ✅ 바깥에서 선언된 객체 사용
              fitView minZoom={0.3} maxZoom={4} attributionPosition="bottom-right"
            >
              <Background color="#b0bec5" gap={30} size={1} />
              <Controls showInteractive={false} />
              {isGraphLoaded && <MapGuidePanel />}
            </ReactFlow>
        </Box>

        {/* 2 & 3. Side Panel for Partial Loading (Integrity & Flow) */}
        <AnalysisSidePanel 
            integrity={data?.integrity_issues} 
            flow={data?.flow_disconnects} 
        />
        
      </Box>

      <InteractionDialog 
        open={dialogState.open} 
        onClose={() => setDialogState(prev => ({ ...prev, open: false }))} 
        content={dialogState.content} 
      />

      <Snackbar 
        open={snackState.open} 
        autoHideDuration={5000} 
        onClose={() => setSnackState(prev => ({ ...prev, open: false }))} 
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled" sx={{ width: '100%', boxShadow: 4, bgcolor:'#263238', color:'#fff', fontWeight:'bold' }}>
          {snackState.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

const LogicNeuronPage = () => (
    <ReactFlowProvider>
        <LogicNeuronContent />
    </ReactFlowProvider>
);

export default LogicNeuronPage;