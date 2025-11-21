import React, { useCallback, useEffect, useState, useRef } from 'react';
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
  MarkerType,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

// Physics Engine (D3)
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

import { useParams } from 'react-router-dom';
import { requestDeepAnalysis, getDeepAnalysisResult } from '../services/api';

// MUI Components
import { 
  Box, Typography, Paper, Dialog, DialogTitle, 
  DialogContent, DialogActions, Button, Chip, 
  CircularProgress, Alert, Snackbar,
  Fade, LinearProgress, GlobalStyles,
  List, ListItem, ListItemText, ListItemIcon, Divider, Skeleton,
  Drawer, IconButton
} from '@mui/material';

// Icons
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ConstructionIcon from '@mui/icons-material/Construction';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import ArticleIcon from '@mui/icons-material/Article';
import HubIcon from '@mui/icons-material/Hub';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

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

  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke: mainColor, strokeWidth: data.weight ? data.weight * 8 : 4, opacity: 0.3, filter: 'blur(4px)' }} />
      <path
        id={id}
        style={{
          stroke: mainColor, strokeWidth: 2, strokeDasharray: '10, 5',
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
             icon={<AutoFixHighIcon style={{fontSize: 16, color: '#fff'}} />} 
             label={isCreative ? "Spark!" : "Check"} size="small" onClick={handleSparkClick}
             sx={{
               fontSize: '0.85rem', height: 28, cursor: 'pointer', fontWeight: 'bold',
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

const GhostEdge = ({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }) => {
   const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
   
   const handleGhostClick = (evt) => {
     evt.stopPropagation();
     data?.onEdgeClick?.(evt, data);
   };

   return (
     <>
       <BaseEdge 
         path={edgePath} 
         markerEnd={markerEnd} 
         style={{ 
            stroke: '#ff9800', 
            strokeWidth: 2.5, 
            strokeDasharray: '8, 8', 
            opacity: 0.8,
            animation: 'dashdraw 1s linear infinite' 
         }} 
       />
       <EdgeLabelRenderer>
         <div 
           onClick={handleGhostClick}
           style={{
            position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all', zIndex: 10, background: '#fff', padding: '4px 12px', cursor: 'pointer',
            borderRadius: '16px', border: '2px solid #ff9800', boxShadow: '0 4px 10px rgba(255,152,0,0.3)'
         }}>
            <Typography variant="body2" sx={{fontWeight:'bold', fontSize: '0.8rem', color: '#e65100', display:'flex', alignItems:'center', gap:0.5}}>
              <LinkOffIcon fontSize="small"/> Link?
            </Typography>
         </div>
       </EdgeLabelRenderer>
     </>
   );
};

const edgeTypes = { spark: SparkEdge, ghost: GhostEdge };

// -----------------------------------------------------------------------------
// 3. Hooks (Data & Graph Logic)
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

  const pollData = useCallback(async () => {
    try {
      const response = await getDeepAnalysisResult(reportId);
      const innerData = response?.data || response; 

      if (innerData) {
        setResultData(innerData);

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

const useGraphLayout = (neuronMap, onEdgeClick) => {
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
        type: n.type || 'concept', 
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
        cursor: 'pointer',
        zIndex: 100
      },
    }));

    const initialEdges = [];
    
    neuronMap.edges?.forEach((e) => {
      const isQuestionable = e.type === 'questionable';
      
      // [수정] 피드백 데이터 매칭 로직 강화
      // 1. creative_feedbacks 배열에서 찾기
      let feedback = null;
      if (isQuestionable && neuronMap.creative_feedbacks) {
         feedback = neuronMap.creative_feedbacks.find(cf => 
             cf.concepts && 
             cf.concepts.includes(e.source) && 
             cf.concepts.includes(e.target)
         );
      }

      // 2. 만약 배열에 없다면, 엣지 객체 자체에 있는 reason/feedback 필드를 사용 (백엔드 호환성)
      if (isQuestionable && !feedback) {
         if (e.reason || e.feedback || e.description) {
             feedback = {
                 judgment: e.judgment || 'Check', // 기본값 Check
                 feedback: e.reason || e.feedback || e.description
             };
         }
      }
      
      initialEdges.push({
        id: `edge-${e.source}-${e.target}`,
        source: e.source, target: e.target,
        type: isQuestionable ? 'spark' : 'default', 
        zIndex: isQuestionable ? 10 : 1,
        style: isQuestionable ? {} : { stroke: '#546e7a', strokeWidth: Math.max(2, (e.weight || 0.5) * 6), opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed, color: isQuestionable ? (feedback?.judgment === 'Creative' ? '#d500f9' : '#ff1744') : '#546e7a' },
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
        zIndex: 5,
        data: { zone: 'B', suggestion: s.suggestion, onEdgeClick }
      });
    });

    const simNodes = initialNodes.map(d => ({ ...d }));
    const simEdges = initialEdges.filter(e => !e.hidden).map(d => ({ ...d, source: d.source, target: d.target }));

    // [수정] D3 물리 엔진 파라미터 조정 (간격 넓힘)
    const simulation = forceSimulation(simNodes)
      .force("link", forceLink(simEdges).id(d => d.id).distance(250)) // 120 -> 250 (거리 대폭 증가)
      .force("charge", forceManyBody().strength(-2500)) // -1200 -> -2500 (반발력 2배 증가)
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(100)); // 60 -> 100 (노드 간 충돌 반경 증가)

    simulation.tick(300);

    const layoutedNodes = initialNodes.map((n, i) => ({
       ...n, position: { x: simNodes[i].x, y: simNodes[i].y } 
    }));

    setNodes(layoutedNodes);
    setEdges(initialEdges);
    processedRef.current = true;

    setTimeout(() => fitView({ duration: 1000, padding: 0.2 }), 100);

  }, [neuronMap, setNodes, setEdges, fitView, onEdgeClick]);

  return { nodes, edges, onNodesChange, onEdgesChange, isReady: processedRef.current };
};

// -----------------------------------------------------------------------------
// 4. UI Sub-Components
// -----------------------------------------------------------------------------

// Node Detail Drawer
const NodeDetailDrawer = ({ open, onClose, node }) => (
  <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 380, p: 3, borderLeft: '5px solid #3f51b5' } }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      <Chip 
        icon={<HubIcon sx={{ fontSize: 18 }} />} 
        label={node?.data?.type || "Concept"} 
        color="primary" size="medium" variant="outlined" sx={{ fontWeight:'bold' }}
      />
      <IconButton onClick={onClose}><CloseIcon /></IconButton>
    </Box>

    <Typography variant="h4" sx={{ fontWeight: 900, color: '#1a237e', mb: 3, wordBreak:'keep-all' }}>
      {node?.data?.label}
    </Typography>

    {node?.data?.summary && (
      <Box sx={{ bgcolor: '#f8f9fa', p: 2.5, borderRadius: 3, mb: 4, boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
        <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#455a64', mb: 1.5, fontWeight:'bold' }}>
          <ArticleIcon /> AI 요약
        </Typography>
        <Typography variant="body1" sx={{ lineHeight: 1.7, color: '#37474f', fontSize:'1rem' }}>
          {node.data.summary}
        </Typography>
      </Box>
    )}

    {node?.data?.score > 0 && (
      <Box>
        <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" gutterBottom>논리적 중요도</Typography>
        <Box sx={{ display:'flex', alignItems:'center', gap: 2 }}>
           <LinearProgress variant="determinate" value={node.data.score * 10} sx={{ flex: 1, height: 10, borderRadius: 5 }} />
           <Typography variant="h6" fontWeight="bold" color="primary">{node.data.score}</Typography>
        </Box>
      </Box>
    )}
  </Drawer>
);

// Analysis Sidebar (Integrity & Flow)
const AnalysisSidePanel = ({ integrity, flow, status }) => (
  <Paper elevation={3} sx={{ 
      width: 340, borderLeft: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', 
      bgcolor: '#fcfcfc', height: '100%', overflowY: 'auto', zIndex: 5 
  }}>
    {/* [수정] 문장 정합성 (한글화 완료) */}
    <Box sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{fontWeight:800, mb:2, display:'flex', alignItems:'center', gap:1, color: '#37474f'}}>
        <WarningAmberIcon color="warning"/> 문장 정합성 검사
      </Typography>
      
      {!integrity ? (
         (status === 'processing' || status === 'init') ? (
            <Box sx={{ display:'flex', alignItems:'center', gap: 2, p:1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">분석 중...</Typography>
            </Box>
         ) : <Typography variant="body2" color="text.secondary">데이터 없음</Typography>
      ) : integrity.length === 0 ? (
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
      )}
    </Box>

    <Divider />

    {/* [수정] 논리 흐름 (한글화 완료) */}
    <Box sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{fontWeight:800, mb:2, display:'flex', alignItems:'center', gap:1, color: '#37474f'}}>
        <LinkOffIcon color="action"/> 논리 흐름 검사
      </Typography>

      {!flow ? (
         (status === 'processing' || status === 'init') ? (
            <Box sx={{ display:'flex', flexDirection:'column', gap: 1 }}>
               <Skeleton variant="rectangular" height={60} sx={{borderRadius:2}} />
               <Skeleton variant="text" width="60%" />
            </Box>
         ) : <Typography variant="body2" color="text.secondary">데이터 없음</Typography>
      ) : flow.length === 0 ? (
         <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, color: '#2e7d32', display:'flex', alignItems:'center', gap:1 }}>
            <CheckCircleOutlineIcon fontSize="small"/> <Typography variant="body2" fontWeight="bold">흐름이 매끄럽습니다.</Typography>
         </Box>
      ) : (
         <List dense disablePadding sx={{ bgcolor:'#fff', borderRadius:2, border:'1px solid #eee' }}>
           {flow.map((gap, idx) => (
              <React.Fragment key={idx}>
                 <ListItem alignItems="flex-start">
                    <ListItemText 
                       secondaryTypographyProps={{ component: 'div' }} 
                       primary={<Typography variant="body2" fontWeight="bold" color="text.primary">단절 구간 {idx+1}</Typography>}
                       secondary={
                          <Box sx={{display:'flex', flexDirection:'column', mt:0.5, gap:0.5}}>
                             <Box sx={{display:'flex', alignItems:'center', gap:0.5}}>
                                <Chip label={gap.from} size="small" variant="outlined" sx={{maxWidth:'45%'}} />
                                <Typography variant="caption">➡</Typography>
                                <Chip label={gap.to} size="small" variant="outlined" sx={{maxWidth:'45%'}} />
                             </Box>
                             <Typography variant="caption" color="error" sx={{mt:0.5}}>{gap.reason}</Typography>
                          </Box>
                       }
                    />
                 </ListItem>
                 {idx < flow.length - 1 && <Divider component="li" />}
              </React.Fragment>
           ))}
         </List>
      )}
    </Box>
  </Paper>
);

// Interaction Dialog
const InteractionDialog = ({ open, onClose, content }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #eee', pb:2 }}>
      {content?.type === 'creative' && <AutoFixHighIcon sx={{color:'#d500f9'}} />}
      {content?.type === 'forced' && <ConstructionIcon sx={{color:'#d32f2f'}} />}
      {content?.type === 'bridge' && <LinkOffIcon sx={{color:'#ff9800'}} />}
      <Typography variant="h6" component="span" sx={{ fontWeight: 800 }}>{content?.title}</Typography>
    </DialogTitle>
    <DialogContent sx={{ py: 3 }}>{content?.body}</DialogContent>
    <DialogActions>
      <Button onClick={onClose} variant="contained" size="large" sx={{ borderRadius: 2, px: 4, bgcolor:'#37474f' }}>확인</Button>
    </DialogActions>
  </Dialog>
);

// -----------------------------------------------------------------------------
// 5. Main Content Component
// -----------------------------------------------------------------------------

const LogicNeuronContent = () => {
  const { reportId } = useParams();
  const { status, resultData } = useBackendAnalysis(reportId);
  
  const [dialogState, setDialogState] = useState({ open: false, content: null });
  const [snackState, setSnackState] = useState({ open: false, message: '' });
  const [selectedNode, setSelectedNode] = useState(null);

  // 1. Edge Click Handler (데이터 방어 로직 추가됨)
  const handleEdgeClick = useCallback((event, edgeData) => {
    if (event?.stopPropagation) event.stopPropagation();
    const { zone, feedback, suggestion } = edgeData;
    let content = null;

    if (zone === 'C') { // Spark Edge
        const isCreative = feedback?.judgment === 'Creative';
        
        // [수정] feedback이 없을 경우 대체 텍스트 표시 로직 강화
        const feedbackText = feedback?.feedback || feedback?.reason || feedback?.description || feedback?.text || "AI가 이 연결에 대한 구체적인 코멘트를 생성하지 못했습니다. (데이터 없음)";

        content = {
          title: isCreative ? '✨ Creative Spark!' : '🔧 연결 재검토 필요',
          type: isCreative ? 'creative' : 'forced',
          body: (
            <Box>
              <Typography variant="subtitle1" sx={{fontWeight:'bold', color: isCreative ? '#7b1fa2' : '#c62828', mb:1}}>
                 {isCreative ? "탁월한 통찰입니다!" : "논리적 비약이 감지되었습니다."}
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                 <Typography variant="body1" sx={{ lineHeight:1.6 }}>
                    {feedbackText}
                 </Typography>
              </Paper>
            </Box>
          )
        };
    } else if (zone === 'B') { // Ghost Edge (Suggestion)
        let guideText = "";
        if (typeof suggestion === 'string') {
            guideText = suggestion;
        } else if (typeof suggestion === 'object' && suggestion !== null) {
            guideText = suggestion.socratic_guide || suggestion.question || suggestion.description || suggestion.text || "질문 내용을 찾을 수 없습니다.";
        } else {
            guideText = "가이드 데이터가 없습니다.";
        }

        content = {
          title: '🌉 Missing Link 발견',
          type: 'bridge',
          body: (
             <Box sx={{ display:'flex', gap: 2 }}>
                <LightbulbIcon sx={{ color:'#ff9800', fontSize:40 }} />
                <Box>
                   <Typography variant="subtitle2" gutterBottom sx={{color:'#757575'}}>AI 소크라테스 가이드</Typography>
                   <Typography variant="h6" fontWeight="bold" sx={{ color:'#e65100', lineHeight:1.4, mb: 1 }}>
                      "{guideText}"
                   </Typography>
                   <Typography variant="body2" display="block" sx={{ color:'#546e7a' }}>
                      이 질문에 답하며 두 개념 사이의 맥락을 연결해보세요.
                   </Typography>
                </Box>
             </Box>
          )
        };
    }

    if (content) setDialogState({ open: true, content });
  }, []);

  // 2. Graph Logic
  const { nodes, edges, onNodesChange, onEdgesChange, isReady } = useGraphLayout(resultData.neuron_map, handleEdgeClick);

  // 3. Node Click Handler
  const onNodeClick = useCallback((event, node) => {
      setSelectedNode(node);
  }, []);

  const isTotalLoading = (status === 'init' || status === 'processing') && !resultData.neuron_map;

  return (
    <Paper elevation={0} sx={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5' }}>
      <GlobalKeyframes />
      
      {/* Header */}
      <Box sx={{ p: 2, px:3, display: 'flex', justifyContent: 'space-between', alignItems:'center', background: '#fff', borderBottom: '1px solid #e0e0e0', zIndex: 10 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, color: '#1a237e' }}>
          <PsychologyIcon fontSize="large" color="primary" /> Logic Neuron Map
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
           {(status === 'processing' || status === 'partial') && (
             <Fade in={true}><Chip icon={<CircularProgress size={16}/>} label="AI 실시간 분석 중..." color="primary" variant="outlined" /></Fade>
           )}
           {status === 'done' && <Chip icon={<CheckCircleOutlineIcon/>} label="분석 완료" color="success" />}
        </Box>
      </Box>

      {status === 'partial' && <LinearProgress color="secondary" sx={{ height: 2 }} />}

      <Box sx={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        
        {/* 1. Map Canvas */}
        <Box sx={{ flex: 1, position: 'relative', height: '100%' }}>
           {isTotalLoading && (
             <Box sx={{ position: 'absolute', inset:0, zIndex: 20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', bgcolor:'rgba(255,255,255,0.8)' }}>
                <CircularProgress size={60} />
                <Typography sx={{ mt:2, fontWeight:'bold', color:'#546e7a' }}>논리 지도를 생성하고 있습니다...</Typography>
             </Box>
           )}
           
           <ReactFlow
             nodes={nodes} edges={edges}
             onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
             onNodeClick={onNodeClick}
             edgeTypes={edgeTypes}
             fitView minZoom={0.2} maxZoom={4}
           >
             <Background color="#b0bec5" gap={30} size={1} />
             <Controls showInteractive={false} />
             
             {/* Map Guide Panel */}
             {isReady && (
                <Panel position="bottom-left" style={{ marginLeft: 20, marginBottom: 20 }}>
                   <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.95)', backdropFilter:'blur(4px)', borderRadius: 3, boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
                      <Typography variant="subtitle2" fontWeight="bold" display="block" gutterBottom color="primary">🧭 탐험 가이드</Typography>
                      <Typography variant="caption" display="block" sx={{mb:0.5}}>🖱️ 노드 클릭: 상세 내용 확인</Typography>
                      <Typography variant="caption" display="block" sx={{mb:0.5}}>⚡ 스파크 선: 창의성/비약 판단</Typography>
                      <Typography variant="caption" display="block">🔗 점선(Missing Link): 클릭하여 연결 힌트 보기</Typography>
                   </Paper>
                </Panel>
             )}
           </ReactFlow>
        </Box>

        {/* 2. Sidebar (Integrity & Flow) */}
        <AnalysisSidePanel 
           integrity={resultData.integrity_issues} 
           flow={resultData.flow_disconnects} 
           status={status}
        />
      </Box>

      {/* Dialogs & Drawers */}
      <InteractionDialog 
        open={dialogState.open} 
        onClose={() => setDialogState(prev => ({ ...prev, open: false }))} 
        content={dialogState.content} 
      />
      
      <NodeDetailDrawer 
        open={!!selectedNode} 
        onClose={() => setSelectedNode(null)} 
        node={selectedNode} 
      />

      {/* Snackbar */}
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