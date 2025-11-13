import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Grid,
  Card,
  CardContent, 
  Accordion,
  AccordionSummary, 
  AccordionDetails,
  Chip,
  Stack
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogicFlowChart from './LogicFlowChart.jsx'; // 1. LogicFlowChart 임포트

// --- (헬퍼 함수들은 이전과 동일) ---
const summaryTitles = {
  assignment_type: "과제 유형",
  Core_Thesis: "핵심 주장 (Core Thesis)",
  Problem_Framing: "문제 제기 (Problem Framing)",
  Claim: "세부 주장 (Claim)",
  Reasoning: "논거 (Reasoning)",
  Flow_Pattern: "논리 흐름 (Flow Pattern)",
  key_concepts: "주요 키워드"
};

const formatReportText = (text) => {
  return text.split('\n').map((line, index) => (
    <Typography 
      key={index} 
      variant="body2" 
      sx={{ 
        mb: 1.5, 
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap'
      }}
    >
      {line.startsWith('- **') ? (
        <strong>{line.replace(/\*| /g, '')}</strong>
      ) : (
        line
      )}
    </Typography>
  ));
};


function ReportDisplay({ data }) {
  if (!data) return null;

  const { summary, similarity_details } = data;

  return (
    <Box sx={{ mt: 3 }}>
      {/* --- 1. 분석 요약 (Summary) 섹션 --- */}
      <Card elevation={3} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            분석 요약
          </Typography>
          
          <Grid container spacing={2}>
            {Object.entries(summary).map(([key, value]) => {
              
              // 2. 'Flow_Pattern'은 별도의 차트가 처리하므로 건너뜀
              if (key === 'Flow_Pattern') return null; 

              return (
                <Grid item xs={12} sm={6} key={key}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="overline" color="text.secondary">
                      {summaryTitles[key] || key}
                    </Typography>
                    
                    {key === 'assignment_type' ? (
                      <Chip 
                        label={value} 
                        color={value === '분석 불가능' ? 'error' : 'primary'} 
                        sx={{ mt: 1 }} 
                      />
                    ) : (
                      <Typography variant="body1">
                        {typeof value === 'object' ? JSON.stringify(value) : value}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          
          {/* 3. 'Flow_Pattern'을 위한 차트 섹션 */}
          {summary.Flow_Pattern && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="overline" color="text.secondary">
                {summaryTitles['Flow_Pattern']}
              </Typography>
              {/* JSON으로 확인한 'summary.Flow_Pattern' 데이터를 
                LogicFlowChart 컴포넌트에 전달합니다.
              */}
              <LogicFlowChart flowData={summary.Flow_Pattern} />
            </Box>
          )}

        </CardContent>
      </Card>

      {/* --- 2. 유사도 분석 (Similarity) 섹션 (이전과 동일) --- */}
      <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4 }}>
        유사도 분석 결과
      </Typography>
      
      {similarity_details && similarity_details.length > 0 ? (
        <Stack spacing={2}>
          {similarity_details.map((item, index) => (
            <Accordion key={item.candidate_id}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
              >
                <Typography sx={{ width: '33%', flexShrink: 0, fontWeight: 'bold' }}>
                  {/* [수정] 백엔드 파서가 이제 'plagiarism_score' (50점 만점)를 보내주므로,
                    'weighted_similarity' 대신 'plagiarism_score'를 사용합니다.
                    (이전 JSON에는 plagiarism_score가 없었지만,
                     새 백엔드 명세서에는 이 키가 있습니다.)
                  */}
                  유사도 점수: {item.plagiarism_score || 'N/A'} / 50
                </Typography>
                <Typography sx={{ color: 'text.secondary' }}>
                  (비교 대상 ID: ...{item.candidate_id.slice(-12)})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ backgroundColor: '#f9f9f9' }}>
                <Typography variant="h6" gutterBottom>LLM 정밀 비교 리포트:</Typography>
                {formatReportText(item.llm_comparison_report)}
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack> 
      ) : (
        <Typography variant="body1">
          유사도 비교 결과가 없습니다.
        </Typography>
      )}

      {/* --- 3. (임시) 원본 JSON 데이터 (이전과 동일) --- */}
      <Accordion sx={{ mt: 4, backgroundColor: '#eee' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="caption">(디버깅용) 원본 JSON 데이터 보기</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box 
            component="pre" 
            sx={{ 
              whiteSpace: 'pre-wrap', 
              wordWrap: 'break-word',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}
          >
            {JSON.stringify(data, null, 2)}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

// 4. [핵심 수정!]
// 'export default LogicFlowChart;'가 아니라
// 'export default ReportDisplay;'가 맞습니다.
export default ReportDisplay;