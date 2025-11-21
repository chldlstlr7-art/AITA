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
import { requestDeepAnalysis, getDeepAnalysisResult, getFlowGraphImage } from '../services/api';

// MUI Components
import { 
  Box, Typography, Paper, Dialog, DialogTitle, 
  DialogContent, DialogActions, Button, Chip, 
  CircularProgress, Alert, Snackbar,
  Fade, LinearProgress, GlobalStyles,
  List, ListItem, ListItemText, ListItemIcon, Divider, Skeleton,
  Drawer, IconButton, Tooltip, useTheme
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';

// Icons
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects'; 
import CloseIcon from '@mui/icons-material/Close'; 
import MenuOpenIcon from '@mui/icons-material/MenuOpen'; 
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; 
import LinkOffIcon from '@mui/icons-material/LinkOff'; 
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DataObjectIcon from '@mui/icons-material/DataObject';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

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

const GhostEdge = ({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }) => {
   const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
   const [isHovered, setIsHovered] = useState(false);
   
   const handleGhostClick = (evt) => {
     evt.stopPropagation();
     data?.onEdgeClick?.(evt, data);
   };

   return (
     <g 
        onMouseEnter={() => setIsHovered(true)} 
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleGhostClick}
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
        zIndex: 100
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
        zIndex: isQuestionable ? 10 : 1,
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
        zIndex: 5,
        markerEnd: undefined, // 삼각형 화살표 제거
        data: { zone: 'B', suggestion: s.suggestion, onEdgeClick }
      });
    });

    const simNodes = initialNodes.map(d => ({ ...d }));
    const simEdges = initialEdges.filter(e => !e.hidden).map(d => ({ ...d, source: d.source, target: d.target }));

    const simulation = forceSimulation(simNodes)
      .force("link", forceLink(simEdges).id(d => d.id).distance(300)) 
      .force("charge", forceManyBody().strength(-3000)) 
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(100)); 

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

// [화면 중앙 하단] Integrity Panel (문장 정합성 검사)
const IntegrityPanel = ({ integrity, status }) => {
  const theme = useTheme();

  // null이면 빈 배열로 처리
  const safeIntegrity = integrity ?? [];
  return (
    <Paper elevation={0} sx={{ 
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', 
        bgcolor: '#fff', borderTop: '1px solid #eee', overflowY: 'auto'
    }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #f0f0f0', bgcolor:'#fafafa', display:'flex', alignItems:'center', gap:1, position: 'sticky', top: 0, zIndex: 5 }}>
        <Typography variant="h6" sx={{fontWeight:800, color: '#37474f'}}>
          문장 정합성 검사
        </Typography>
        {safeIntegrity.length > 0 && (
          <Chip label={`${safeIntegrity.length}건 발견`} size="small" color="warning" sx={{fontWeight:'bold'}} />
        )}
      </Box>
      <Box sx={{ p: 3 }}>
        {(status === 'processing' || status === 'init') && integrity == null ? (
          <Box sx={{ display:'flex', alignItems:'center', gap: 2, p:1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">검사 중...</Typography>
          </Box>
        ) : safeIntegrity.length === 0 ? (
          <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 2, color: '#2e7d32' }}>
            <Typography variant="body2" fontWeight="bold">모든 문장이 논리적으로 완벽합니다!</Typography>
          </Box>
        ) : (
          <Box sx={{ display:'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 2 }}>
            {safeIntegrity.map((issue, idx) => (
              <Paper key={idx} elevation={0} sx={{ border:'1px solid #e0e0e0', borderRadius:3, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                <Box sx={{ bgcolor: alpha(theme.palette.warning.light, 0.1), p:1.5, px:2, borderBottom:`1px solid ${alpha(theme.palette.warning.main, 0.2)}` }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="warning.main">
                    {issue.type}
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5, flex:1 }}>
                  {issue.quote && (
                    <Box sx={{ mb:2, opacity:0.9, bgcolor: alpha(theme.palette.grey[100], 0.5), p:1.5, borderRadius:2 }}>
                      <Typography variant="body1" sx={{ fontStyle:'italic', color: 'text.secondary', lineHeight:1.6 }}>
                        "{issue.quote}"
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="caption" display="block" sx={{ fontWeight:'bold', color: 'primary.main', mb:0.5, fontSize:'0.9rem' }}>
                    💡 AI 제안
                  </Typography>
                  <Typography variant="body1" sx={{ fontSize:'1rem', lineHeight:'1.5', color: 'text.primary' }}>
                    {issue.socratic_suggestion || issue.description}
                  </Typography>
                </Box>
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
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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

  // null이면 빈 배열로 처리
  const safeFlow = flow ?? [];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper', overflowY: 'auto' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.secondary.main, 0.05), position:'sticky', top:0, zIndex:1 }}>
        <Typography variant="subtitle1" sx={{fontWeight:800, color: theme.palette.secondary.main, display:'flex', alignItems:'center', gap:1}}>
          <AccountTreeIcon fontSize="small"/> 논리 흐름 검사
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {(status === 'processing' || status === 'init') && flow == null ? (
          <Box sx={{ display:'flex', flexDirection:'column', gap: 1 }}>
            <Skeleton variant="rectangular" height={60} sx={{borderRadius:2}} />
            <Skeleton variant="text" width="60%" />
          </Box>
        ) : safeFlow.length === 0 ? (
          <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 2, color: theme.palette.success.main }}>
            <Typography variant="body2" fontWeight="bold">논리 흐름이 매끄럽습니다.</Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ bgcolor: 'background.paper' }}>
            {safeFlow.map((gap, idx) => (
              <React.Fragment key={idx}>
                <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                  <ListItemText 
                    secondaryTypographyProps={{ component: 'div' }} 
                    primary={null}
                    secondary={
                      <Box sx={{display:'flex', flexDirection:'column', gap:1}}>
                        {/* 연결 정보 표시 */}
                        <Box sx={{display:'flex', alignItems:'center', gap:0.5, bgcolor: alpha(theme.palette.grey[200], 0.5), p:1, borderRadius:1}}>
                          <Chip label={gap.parent_id || gap.from || "?"} size="small" sx={{maxWidth:'40%', height:24}} />
                          <Typography variant="caption">➡</Typography>
                          <Chip label={gap.child_id || gap.to || "?"} size="small" sx={{maxWidth:'40%', height:24}} />
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.primary" sx={{fontWeight:'bold', fontSize:'0.85rem'}}>
                            {gap.reason}
                          </Typography>
                          <Typography variant="caption" color="primary.main" sx={{mt:0.5, display:'block'}}>
                            💡 {gap.suggestion}
                          </Typography>
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
  const theme = useTheme(); // 테마 사용
  
  const [dialogState, setDialogState] = useState({ open: false, content: null });
  const [snackState, setSnackState] = useState({ open: false, message: '' });
  const [showDebug, setShowDebug] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); 

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

  const { nodes, edges, onNodesChange, onEdgesChange, isReady } = useGraphLayout(resultData.neuron_map, handleEdgeClick);

  const isTotalLoading = (status === 'init' || status === 'processing') && !resultData.neuron_map;

  return (
    <Box sx={{ width: '100%', height: '100vh', bgcolor: 'background.default', overflow: 'hidden', display:'flex', flexDirection:'column', position: 'relative' }}>
      <GlobalKeyframes />
      
      {/* 1. Header */}
      <Box sx={{ p: 2, px:3, display: 'flex', justifyContent: 'space-between', alignItems:'center', bgcolor: 'background.paper', borderBottom: `1px solid ${theme.palette.divider}`, zIndex: 10, height: 64, flexShrink: 0 }}>
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

      {/* 2. Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
         
         {/* Top: Neuron Map (65%) */}
         <Box sx={{ flex: 6.5, position: 'relative', borderBottom: `1px solid ${theme.palette.divider}`, width: '100%', height: '100%' }}>
            {isTotalLoading && (
              <Box sx={{ position: 'absolute', inset:0, zIndex: 20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', bgcolor: alpha(theme.palette.background.paper, 0.8) }}>
                 <CircularProgress size={60} />
                 <Typography sx={{ mt:2, fontWeight:'bold', color:'text.secondary' }}>개념 연결망을 생성하고 있습니다...</Typography>
              </Box>
            )}
            
            <Box sx={{ width: '100%', height: '100%' }}>
                <ReactFlow
                  nodes={nodes} edges={edges}
                  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                  edgeTypes={edgeTypes}
                  fitView minZoom={0.2} maxZoom={4}
                >
                  {/* 단순 배경 (격자 없음) */}
                  <Background color="#e3f2fd" variant="lines" gap={10000} />
                  <Controls showInteractive={false} />
                  <Panel position="bottom-right" style={{ marginRight: 20, marginBottom: 20 }}>
                     <Button variant="contained" color="inherit" size="small" onClick={() => setShowDebug(true)} sx={{ bgcolor: alpha(theme.palette.grey[800], 0.8), color: '#fff', fontSize: '0.75rem' }}>
                         원본 데이터
                     </Button>
                  </Panel>
                </ReactFlow>
            </Box>
         </Box>

         {/* Bottom: Integrity Check (30%) */}
         <Box sx={{ flex: 3.5, overflow: 'hidden', width: '100%' }}>
            <IntegrityPanel integrity={resultData.integrity_issues} status={status} />
         </Box>

      </Box>

      {/* [Fixed Sidebar Trigger Button] */}
      <Box sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 100, animation: 'nudge 3s infinite' }}>
         <Tooltip title="논리 흐름 상세 분석" placement="left">
            <Button 
               variant="contained" 
               color="primary"
               onClick={() => setIsDrawerOpen(true)}
               sx={{ 
                   borderRadius: '8px 0 0 8px', 
                   minWidth: '40px', 
                   padding: '12px 4px',
                   boxShadow: theme.shadows[6]
               }}
            >
               <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                   <ArrowBackIosNewIcon fontSize="small" />
                   <Typography variant="caption" sx={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: 2, fontWeight:'bold' }}>
                       논리흐름
                   </Typography>
               </Box>
            </Button>
         </Tooltip>
      </Box>

      {/* 3. Right Sidebar Drawer */}
      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      >
        <Box sx={{ width: 500, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
            {/* Header with Theme Color */}
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                <Typography variant="h6" fontWeight="bold">논리 흐름 상세 분석</Typography>
                <IconButton onClick={() => setIsDrawerOpen(false)} sx={{ color: 'inherit' }}><CloseIcon /></IconButton>
            </Box>

            {/* Top: Diagram (65% - Increased) */}
            <Box sx={{ flex: 6.5, borderBottom: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
                <LogicFlowDiagram reportId={reportId} />
            </Box>

            {/* Bottom: Flow Check (35% - Reduced) */}
            <Box sx={{ flex: 3.5, overflow: 'hidden' }}>
                <FlowCheckPanel flow={resultData.flow_disconnects} status={status} />
            </Box>
        </Box>
      </Drawer>

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
        <Alert severity="info" variant="filled" sx={{ width: '100%', boxShadow: 4, bgcolor: 'grey.900', color: '#fff', fontWeight:'bold' }}>
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