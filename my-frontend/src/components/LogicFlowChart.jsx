import React, { useMemo } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Paper, Typography, Box } from '@mui/material';

// -----------------------------------------------------------------
// 핵심 주장 중심 + 공통점/차이점 + 간단 근거 노드(간격 넓음)
// -----------------------------------------------------------------
const transformFlowData = (flowData) => {
  const edges = [];
  const positionedNodes = new Map();

  // 레이아웃 상수 (중앙 집중형 + 트리 구조)
  const X_CENTER = 900;
  const Y_CENTER = 500;
  
  // 핵심 주장 & 핵심 근거: 중앙
  const CORE_Y_GAP = 120;
  
  // 공통점/차이점 그룹: 상/하단
  const COMMON_Y = 80;
  const DIFF_Y = 920;
  
  // 좌/우측 그룹 배치
  const GROUP_X_LEFT = 300;
  const GROUP_X_RIGHT = 1500;
  const GROUP_Y_GAP = 160;

  const summary = flowData?.summary || {};
  const pattern = summary?.Flow_Pattern || {};
  const patternNodes = pattern?.nodes || {};

  const keyPatterns = {
    core: [/Core_Thesis/i, /Core.?Thesis/i, /핵심/i, /Claim/i],
    common: [/공통점/i, /공통/i, /common/i, /\[공통점\]/i],
    diff: [/차이점/i, /차이/i, /difference/i, /\[차이점\]/i],
    evidence: [/근거/i, /증거/i, /evidence/i, /Reasoning/i],
    conclusion: [/결론/i, /결론부/i, /conclusion/i],
    intro: [/도입/i, /문제/i, /introd/i]
  };

  const containsKeyword = (str, patterns) => {
    if (!str) return false;
    return patterns.some(rx => rx.test(String(str)));
  };

  const candidates = { core: [], common: [], diff: [], evidence: [], conclusion: [], intro: [] };
  
  const visit = (obj, path = '') => {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj === 'string') {
      for (const [k, patterns] of Object.entries(keyPatterns)) {
        if (containsKeyword(obj, patterns)) {
          candidates[k].push({ 
            id: path || `s_${Math.random().toString(36).slice(2,8)}`, 
            text: obj 
          });
        }
      }
      return;
    }
    
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        for (const [cat, patterns] of Object.entries(keyPatterns)) {
          if (containsKeyword(k, patterns)) {
            const text = (typeof v === 'string' && v.trim()) ? v : k;
            candidates[cat].push({ id: `${path}.${k}`, text });
          }
        }
        visit(v, path ? `${path}.${k}` : k);
      }
    }
  };
  
  visit(flowData);

  // 핵심 주장 (중앙)
  let coreLabel =
    summary?.Core_Thesis ||
    summary?.Claim ||
    summary?.core_thesis ||
    summary?.claim ||
    (candidates.core.length ? candidates.core[0].text : null) ||
    (flowData?.text_snippet ? (String(flowData.text_snippet).split(/[\r\n\.]/).find(s=>s.trim()) || null) : null) ||
    '핵심 주장';

  const coreId = 'Core_Thesis';
  positionedNodes.set(coreId, {
    id: coreId,
    data: { label: coreLabel },
    position: { x: X_CENTER, y: Y_CENTER },
    style: {
      background: '#fff8e1',
      border: '3px solid #1565c0',
      padding: 14,
      width: 700
    },
    type: 'default'
  });

  const MAX = 6;
  const showCommons = candidates.common.slice(0, MAX);
  const showDiffs = candidates.diff.slice(0, MAX);
  const showEvidences = candidates.evidence.slice(0, MAX);

  // =========================================
  // 핵심 근거 (중앙, 핵심 주장 위/아래)
  // =========================================
  const keyEvidences = showEvidences.slice(0, 2);
  
  keyEvidences.forEach((e, idx) => {
    const id = `key_evidence_${idx}`;
    const y = idx === 0 ? Y_CENTER - CORE_Y_GAP : Y_CENTER + CORE_Y_GAP;
    positionedNodes.set(id, {
      id,
      data: { label: e.text },
      position: { x: X_CENTER, y },
      style: { width: 620, padding: 10, background: '#fffde7', border: '2px solid #f57f17' },
      type: 'default'
    });
    edges.push({
      id: `e-${coreId}-${id}`,
      source: coreId,
      target: id,
      animated: true,
      style: { stroke: '#f57f17', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed' }
    });
  });

  // =========================================
  // 공통점 그룹 (상단 좌측)
  // =========================================
  const COMMON_X = GROUP_X_LEFT;
  showCommons.forEach((c, idx) => {
    const id = `common_${idx}`;
    const y = COMMON_Y + idx * GROUP_Y_GAP;
    
    positionedNodes.set(id, {
      id,
      data: { label: c.text },
      position: { x: COMMON_X, y },
      style: { width: 360, padding: 12, background: '#e8f5e9', border: '1px solid #2e7d32' },
      type: 'default'
    });
    
    // 핵심 주장과 연결
    edges.push({
      id: `e-${coreId}-${id}`,
      source: coreId,
      target: id,
      animated: false,
      style: { stroke: '#1565c0', strokeWidth: 1.8, strokeDasharray: '5,5' },
      markerEnd: { type: 'arrowclosed' }
    });

    // 세부 근거 연결 (해당 근거가 있으면)
    const relatedEvidence = showEvidences.find((e, ei) => ei > 1 && ei < showEvidences.length);
    if (relatedEvidence && idx < 2) {
      const eidx = showEvidences.indexOf(relatedEvidence);
      const eid = `evidence_common_${idx}`;
      const ex = COMMON_X + 420;
      const ey = y + 20;
      
      positionedNodes.set(eid, {
        id: eid,
        data: { label: relatedEvidence.text },
        position: { x: ex, y: ey },
        style: { width: 300, padding: 8, background: '#f1f8e9', fontSize: 12 },
        type: 'default'
      });
      
      edges.push({
        id: `e-${id}-${eid}`,
        source: id,
        target: eid,
        animated: false,
        style: { stroke: '#9e9e9e', strokeWidth: 1 },
        markerEnd: { type: 'arrowclosed' }
      });
    }
  });

  // =========================================
  // 차이점 그룹 (하단 우측)
  // =========================================
  const DIFF_X = GROUP_X_RIGHT;
  showDiffs.forEach((d, idx) => {
    const id = `diff_${idx}`;
    const y = DIFF_Y - idx * GROUP_Y_GAP;
    
    positionedNodes.set(id, {
      id,
      data: { label: d.text },
      position: { x: DIFF_X, y },
      style: { width: 360, padding: 12, background: '#fff3e0', border: '1px solid #e65100' },
      type: 'default'
    });
    
    // 핵심 주장과 연결
    edges.push({
      id: `e-${coreId}-${id}`,
      source: coreId,
      target: id,
      animated: false,
      style: { stroke: '#d84315', strokeWidth: 1.8, strokeDasharray: '5,5' },
      markerEnd: { type: 'arrowclosed' }
    });

    // 세부 근거 연결
    const relatedEvidence = showEvidences.find((e, ei) => ei > 1 && ei < showEvidences.length);
    if (relatedEvidence && idx < 2) {
      const eid = `evidence_diff_${idx}`;
      const ex = DIFF_X - 420;
      const ey = y + 20;
      
      positionedNodes.set(eid, {
        id: eid,
        data: { label: relatedEvidence.text },
        position: { x: ex, y: ey },
        style: { width: 300, padding: 8, background: '#fff8e1', fontSize: 12 },
        type: 'default'
      });
      
      edges.push({
        id: `e-${id}-${eid}`,
        source: id,
        target: eid,
        animated: false,
        style: { stroke: '#9e9e9e', strokeWidth: 1 },
        markerEnd: { type: 'arrowclosed' }
      });
    }
  });

  return { nodes: Array.from(positionedNodes.values()), edges };
};


function LogicFlowChart({ flowData }) {
  const { nodes, edges } = useMemo(() => transformFlowData(flowData), [flowData]);

  if (!nodes || nodes.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">논리 흐름도 데이터를 불러올 수 없거나, 흐름이 없습니다.</Typography>
      </Paper>
    );
  }

  return (
    // [수정] 차트 높이를 900px로 유지
    <Box sx={{ height: 900, border: '1px solid #ddd', borderRadius: '4px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView // 자동으로 줌/이동
        nodesDraggable={true}
        nodesConnectable={false}
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </Box>
  );
}

export default LogicFlowChart;