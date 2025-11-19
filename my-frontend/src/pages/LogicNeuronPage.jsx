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
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

// Physics Engine (D3 Force)
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

import { useParams } from 'react-router-dom';
import { requestDeepAnalysis, getDeepAnalysisResult } from '../services/api';

// MUI Components
import { 
  Box, Typography, Paper, Dialog, DialogTitle, 
  DialogContent, DialogActions, Button, Chip, 
  CircularProgress, Alert, Snackbar,
  Fade
} from '@mui/material';

// Icons
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ConstructionIcon from '@mui/icons-material/Construction';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

// -----------------------------------------------------------------------------
// 1. Visual Metaphor: Custom Edge Components
// -----------------------------------------------------------------------------

/**
 * [Zone C] The Spark Edge (Creative/Forced)
 */
const SparkEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const handleSparkClick = (evt) => {
    evt.stopPropagation();
    // Fix: Explicitly blur focus to prevent aria-hidden errors
    if (document.activeElement) {
        document.activeElement.blur();
    }
    if (data?.onEdgeClick) data.onEdgeClick(evt);
  };

  const isCreative = data?.feedback?.judgment === 'Creative';
  const mainColor = isCreative ? '#d500f9' : '#ff1744'; 

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        style={{ 
            stroke: mainColor, 
            strokeWidth: 12, 
            opacity: 0.15, 
            filter: 'blur(6px)' 
        }} 
      />
      <path
        id={id}
        style={{ 
            stroke: mainColor,
            strokeWidth: 3,
            strokeDasharray: '10, 5',
            animation: 'sparkFlow 40s linear infinite',
            filter: 'drop-shadow(0 0 2px ' + mainColor + ')',
            fill: 'none'
        }}
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 10
          }}
        >
            <Chip 
                icon={<AutoFixHighIcon style={{fontSize: 14, color: '#fff'}} />} 
                label={isCreative ? "Spark!" : "Check"} 
                size="small" 
                onClick={handleSparkClick}
                sx={{
                    fontSize: '0.7rem', height: 24, cursor: 'pointer', 
                    background: isCreative 
                        ? 'linear-gradient(45deg, #aa00ff, #d500f9)' 
                        : 'linear-gradient(45deg, #d32f2f, #ff5252)',
                    color: 'white', border: '1px solid rgba(255,255,255,0.5)',
                    boxShadow: `0 0 10px ${mainColor}`,
                    animation: 'pulse 2s infinite'
                }}
            />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

/**
 * [Zone B] The Ghost Edge (Missing Link)
 */
const GhostEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd }) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    });
  
    return (
      <>
        <BaseEdge 
            path={edgePath} 
            style={{ 
                stroke: '#ff9800', 
                strokeWidth: 2, 
                strokeDasharray: '5, 5',
                animation: 'dashdraw 1s linear infinite',
                opacity: 0.8
            }} 
            markerEnd={markerEnd} 
        />
        <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
                zIndex: 10,
                background: '#fff',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #ff9800',
                boxShadow: '0 2px 4px rgba(255,152,0,0.2)'
              }}
            >
               <Typography variant="caption" sx={{fontWeight:'bold', color: '#e65100', display:'flex', alignItems:'center', gap:0.5}}>
                  <LinkOffIcon fontSize="inherit"/> Link?
               </Typography>
            </div>
          </EdgeLabelRenderer>
      </>
    );
  };

// ✅ CRITICAL FIX: Define edgeTypes OUTSIDE the component.
// This prevents React Flow from thinking types changed on every render, fixing the warning.
const edgeTypes = {
  spark: SparkEdge,
  ghost: GhostEdge,
};

// -----------------------------------------------------------------------------
// 2. Physics Engine 
// -----------------------------------------------------------------------------
const runForceLayout = (nodes, edges) => {
    const simulationNodes = nodes.map((node) => ({ ...node }));
    const simulationEdges = edges
        .filter(e => !e.hidden)
        .map((edge) => ({ ...edge, source: edge.source, target: edge.target }));

    const simulation = forceSimulation(simulationNodes)
        .force("link", forceLink(simulationEdges)
            .id((d) => d.id)
            .distance((d) => {
                const weight = d.data?.weight || 0.5;
                return 200 - (weight * 100); 
            })
        )
        .force("charge", forceManyBody().strength(-2500)) 
        .force("center", forceCenter(0, 0))
        .force("collide", forceCollide(80));

    simulation.tick(300);

    return nodes.map((node) => {
        const simNode = simulationNodes.find((n) => n.id === node.id);
        return {
            ...node,
            position: { x: simNode.x, y: simNode.y },
        };
    });
};

// -----------------------------------------------------------------------------
// 3. Main Component
// -----------------------------------------------------------------------------
const LogicNeuronContent = () => {
  const { reportId } = useParams(); 
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [analysisStatus, setAnalysisStatus] = useState('processing'); 
  
  // UX States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: '', content: '', type: '' });
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  
  const pollingIntervalRef = useRef(null);
  const { fitView } = useReactFlow();

  // ---------------------------------------------------------------------------
  // Interaction Logic
  // ---------------------------------------------------------------------------
  
  // [Step 2] Reveal Missing Links
  const onNodeClick = useCallback((event, node) => {
    // ✅ Fix: Blur focus on the node <g> element to prevent aria-hidden error
    if (document.activeElement) {
        document.activeElement.blur();
    }

    let revealedCount = 0;

    setEdges((currentEdges) => 
      currentEdges.map((edge) => {
        if (edge.data?.zone === 'B' && edge.hidden && (edge.source === node.id || edge.target === node.id)) {
            revealedCount++;
            return { ...edge, hidden: false }; 
        }
        return edge;
      })
    );

    if (revealedCount > 0) {
        setSnackMessage(`🔍 ${revealedCount}개의 잠재적 연결 고리를 발견했습니다! 주황색 선을 확인하세요.`);
        setSnackOpen(true);
    }
  }, [setEdges]);

  // [Step 3] Analyze Edges
  const onEdgeClick = useCallback((event, edge) => {
    if (event && event.stopPropagation) event.stopPropagation();
    
    // ✅ Fix: Blur focus on the edge <g> element to prevent aria-hidden error
    // This ensures focus is returned to body before the Modal opens and hides #root
    if (document.activeElement) {
        document.activeElement.blur();
    }

    const zone = edge.data?.zone;
    
    // Zone C
    if (zone === 'C') {
      const feedback = edge.data?.feedback;
      const isCreative = feedback?.judgment === 'Creative';

      setDialogContent({
        title: isCreative ? '✨ Creative Spark!' : '🔧 연결 정비 필요',
        content: (
            <Box>
                <Typography variant="h6" sx={{ color: isCreative ? '#7b1fa2' : '#d32f2f', fontWeight: 'bold', mb: 2 }}>
                   {isCreative ? "탁월한 통찰력입니다!" : "논리적 연결이 조금 어색해요."}
                </Typography>
                <Paper elevation={0} sx={{ p: 2, bgcolor: isCreative ? '#f3e5f5' : '#ffebee', borderRadius: 2, display: 'flex', gap: 2 }}>
                    <Box sx={{ mt: 0.5 }}>
                        {isCreative ? <EmojiEventsIcon sx={{ fontSize: 40, color: '#aa00ff' }} /> : <ConstructionIcon sx={{ fontSize: 40, color: '#d32f2f' }} />}
                    </Box>
                    <Box>
                        <Typography variant="subtitle1" sx={{fontWeight:'bold', mb:0.5}}>AI 분석 코멘트</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            {feedback ? feedback.feedback : "분석 데이터가 없습니다."}
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        ),
        type: isCreative ? 'creative' : 'forced'
      });
      setDialogOpen(true);
    } 
    // Zone B
    else if (zone === 'B') {
      const guide = edge.data?.suggestion?.socratic_guide;
      setDialogContent({
        title: '🌉 Missing Link 발견',
        content: (
            <Box>
                <Paper elevation={0} sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 2, display:'flex', gap: 2, alignItems:'flex-start' }}>
                      <LightbulbIcon sx={{ fontSize: 30, color: '#ff9800', mt:0.5 }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontSize: '1.05rem', fontWeight: 600, color:'#e65100', mb: 1 }}>
                            "{guide}"
                        </Typography>
                        <Typography variant="body2" sx={{ color:'#ef6c00' }}>
                            이 두 개념 사이에는 숨겨진 맥락이 있습니다. 위 질문에 답하며 글을 확장해보세요.
                        </Typography>
                      </Box>
                </Paper>
            </Box>
        ),
        type: 'bridge'
      });
      setDialogOpen(true);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Data Processing
  // ---------------------------------------------------------------------------
  const processGraphData = useCallback((rawData) => {
    let safeData = rawData.data && rawData.data.neuron_map ? rawData.data : rawData;
    if (!safeData.neuron_map) safeData = { neuron_map: { nodes: [], edges: [] } };

    const { neuron_map } = safeData;

    // Nodes
    const newNodes = neuron_map.nodes.map((n) => ({
      id: n.id,
      data: { label: n.label },
      position: { x: 0, y: 0 }, 
      style: { 
        background: 'rgba(255, 255, 255, 0.95)', 
        border: '1px solid #cfd8dc', 
        borderRadius: '50px',
        padding: '10px 24px',
        fontWeight: 700,
        fontSize: '14px',
        minWidth: '80px',
        textAlign: 'center',
        boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
        color: '#37474f',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      },
    }));

    const newEdges = [];

    // Existing Edges
    if (neuron_map.edges) {
        neuron_map.edges.forEach((e) => {
          const isQuestionable = e.type === 'questionable'; 
          const weight = e.weight || 0.5;
          
          const feedbackData = isQuestionable && neuron_map.creative_feedbacks 
            ? neuron_map.creative_feedbacks.find(cf => cf.concepts.includes(e.source) && cf.concepts.includes(e.target))
            : null;
            
          const edgeObj = {
            id: `edge-${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            type: isQuestionable ? 'spark' : 'default', 
            animated: false, 
            zIndex: isQuestionable ? 10 : 1,
            style: isQuestionable 
                ? {} 
                : { 
                    stroke: '#546e7a', 
                    strokeWidth: Math.max(2, weight * 8), 
                    opacity: 0.8
                  },
            markerEnd: { 
                type: MarkerType.ArrowClosed, 
                color: isQuestionable ? (feedbackData?.judgment === 'Creative' ? '#d500f9' : '#ff1744') : '#546e7a' 
            },
            data: { 
              zone: isQuestionable ? 'C' : 'A',
              weight: weight,
              feedback: feedbackData,
              onEdgeClick: (evt) => onEdgeClick(evt, { data: { zone: isQuestionable ? 'C' : 'A', feedback: feedbackData } }) 
            }
          };
          newEdges.push(edgeObj);
        });
    }

    // Suggestions
    if (neuron_map.suggestions) {
      neuron_map.suggestions.forEach((s, idx) => {
        newEdges.push({
          id: `suggestion-${idx}`,
          source: s.target_node,
          target: s.partner_node,
          type: 'ghost',
          animated: true,
          hidden: true,
          zIndex: 5,
          data: { 
            zone: 'B',
            suggestion: s.suggestion,
            onEdgeClick: (evt) => onEdgeClick(evt, { data: { zone: 'B', suggestion: s.suggestion } })
          }
        });
      });
    }

    const layoutedNodes = runForceLayout(newNodes, newEdges);
    
    setNodes(layoutedNodes);
    setEdges(newEdges);
    setAnalysisStatus('done');
    
    setTimeout(() => fitView({ duration: 1500, padding: 0.2 }), 100); 

  }, [setNodes, setEdges, fitView, onEdgeClick]);

  // ---------------------------------------------------------------------------
  // API Polling
  // ---------------------------------------------------------------------------
  const pollData = useCallback(async () => {
    try {
        const res = await getDeepAnalysisResult(reportId);
        if (res && res.status !== 'pending' && res.data) {
            processGraphData(res.data);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        }
    } catch (error) { /* ... */ }
  }, [reportId, processGraphData]);

  useEffect(() => {
    if (!reportId) return;
    const startProcess = async () => {
        setAnalysisStatus('processing'); 
        try {
            const res = await getDeepAnalysisResult(reportId);
            if (res && res.status !== 'pending' && res.data) {
                processGraphData(res.data);
            } else { 
                 try { await requestDeepAnalysis(reportId); } catch (e) {}
                 pollingIntervalRef.current = setInterval(pollData, 3000);
            }
        } catch (error) {
             try { await requestDeepAnalysis(reportId); } catch(e) {}
             pollingIntervalRef.current = setInterval(pollData, 3000);
        }
    };
    startProcess();
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [reportId, pollData, processGraphData]);


  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Paper elevation={0} sx={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f0f2f5' }}>
      
      <style>
        {`
          @keyframes sparkFlow { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
          @keyframes dashdraw { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }
          @keyframes pulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(213, 0, 249, 0.7); } 70% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(213, 0, 249, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(213, 0, 249, 0); } }
        `}
      </style>

      {/* Header */}
      <Box sx={{ p: 2, px:3, display: 'flex', justifyContent: 'space-between', alignItems:'center', background: '#fff', borderBottom: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 10 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5, color: '#1a237e' }}>
            <PsychologyIcon fontSize="large" color="primary" /> Logic Neuron Map
        </Typography>
        {analysisStatus === 'done' && (
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

      {/* Canvas */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {analysisStatus === 'processing' && (
           <Fade in={true}>
               <Box sx={{ position: 'absolute', inset:0, display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', zIndex: 20, bgcolor: 'rgba(255,255,255,0.85)', backdropFilter:'blur(4px)' }}>
                   <CircularProgress size={60} thickness={4} sx={{color:'#1a237e', mb: 3}} />
                   <Typography variant="h6" color="text.primary" fontWeight="bold">신경망을 스캔하고 있습니다...</Typography>
                   <Typography variant="body2" color="text.secondary">논리적 연결 강도와 창의적 스파크를 분석 중입니다.</Typography>
               </Box>
           </Fade>
        )}

        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick} 
            onEdgeClick={onEdgeClick} 
            edgeTypes={edgeTypes} 
            fitView
            minZoom={0.3}
            maxZoom={4}
            attributionPosition="bottom-right"
        >
            <Background color="#b0bec5" gap={30} size={1} />
            <Controls showInteractive={false} />
            
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
        </ReactFlow>
      </Box>

      {/* Dialogs */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #eee', pb:2 }}>
            {dialogContent.type === 'creative' && <AutoFixHighIcon sx={{color:'#d500f9'}} />}
            {dialogContent.type === 'forced' && <ConstructionIcon sx={{color:'#d32f2f'}} />}
            {dialogContent.type === 'bridge' && <LinkOffIcon sx={{color:'#ff9800'}} />}
            
            {/* component="span" fixes h6 inside h2 HTML nesting error */}
            <Typography variant="h6" component="span" sx={{ fontWeight: 800 }}>{dialogContent.title}</Typography>
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
            {dialogContent.content}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} variant="contained" sx={{ borderRadius: 2, px: 4, bgcolor:'#37474f' }}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackOpen} autoHideDuration={5000} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" sx={{ width: '100%', boxShadow: 4, bgcolor:'#263238', color:'#fff', fontWeight:'bold' }}>{snackMessage}</Alert>
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