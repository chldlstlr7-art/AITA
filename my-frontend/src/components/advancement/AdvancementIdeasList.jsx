import React from 'react';
import {
  Box,
  Typography,
  Stack,
  AccordionSummary,
  AccordionDetails,
  Fade,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import { StyledAccordion, IdeaChip, EvidenceBox } from './AdvancementStyles';

// evidence 데이터 렌더링 헬퍼 함수
const renderEvidence = (evidence) => {
  if (!evidence) return '근거 정보가 없습니다.';
  if (typeof evidence === 'string') return evidence;
  
  if (typeof evidence === 'object') {
    if (Array.isArray(evidence)) {
      return evidence.map((item, idx) => {
        if (typeof item === 'string') return item;
        if (item.q && item.a) return `Q: ${item.q}\nA: ${item.a}`;
        return JSON.stringify(item);
      }).join('\n\n');
    }
    
    if (evidence.q && evidence.a) {
      return `Q: ${evidence.q}\nA: ${evidence.a}`;
    }
    
    return JSON.stringify(evidence, null, 2);
  }
  
  return String(evidence);
};

function AdvancementIdeasList({ ideas }) {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          💡 AI 발전 아이디어
        </Typography>
        <Typography variant="body2" color="text.secondary">
          총 {ideas.length}개의 아이디어가 생성되었습니다
        </Typography>
      </Box>
      
      <Stack spacing={2.5}>
        {ideas.map((item, index) => (
          <Fade in key={index} timeout={600 + index * 100}>
            <StyledAccordion elevation={0}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  px: 3,
                  py: 1.5,
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 2,
                    my: 1,
                  },
                }}
              >
                <IdeaChip label={index + 1} />
                <Box flex={1}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <LightbulbIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                    <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {item.idea || '아이디어'}
                    </Typography>
                  </Stack>
                </Box>
              </AccordionSummary>
              
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
                <EvidenceBox>
                  <Typography 
                    variant="subtitle2" 
                    gutterBottom 
                    sx={{ 
                      fontWeight: 700, 
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    📚 근거
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      lineHeight: 1.8, 
                      color: 'text.secondary',
                      whiteSpace: 'pre-wrap',
                      pl: 1,
                    }}
                  >
                    {renderEvidence(item.evidence)}
                  </Typography>
                </EvidenceBox>
              </AccordionDetails>
            </StyledAccordion>
          </Fade>
        ))}
      </Stack>
    </Box>
  );
}

export default AdvancementIdeasList;