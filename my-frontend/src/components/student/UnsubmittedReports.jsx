import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// ==================== Styled Components ====================

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(3),
}));

const DrawerTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.3rem',
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const ReportListItem = styled(ListItemButton)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s',
  
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    borderColor: theme.palette.primary.main,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(6, 2),
  color: theme.palette.text.secondary,
}));

// ==================== Main Component ====================

function UnsubmittedReports({ reports, onClose }) {
  const navigate = useNavigate();

  const handleViewReport = (reportId) => {
    navigate(`/report/${reportId}`);
    onClose();
  };

  return (
    <Box>
      <DrawerHeader>
        <DrawerTitle>
          <DescriptionIcon color="primary" />
          제출하지 않은 리포트
        </DrawerTitle>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DrawerHeader>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        분석은 완료했지만 아직 과제에 제출하지 않은 리포트 목록입니다
      </Typography>

      {!reports || reports.length === 0 ? (
        <EmptyState>
          <DescriptionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary" gutterBottom>
            제출하지 않은 리포트가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary">
            모든 리포트가 제출되었습니다
          </Typography>
        </EmptyState>
      ) : (
        <List disablePadding>
          {reports.map((report) => (
            <React.Fragment key={report.report_id}>
              <ReportListItem onClick={() => handleViewReport(report.report_id)}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                        {report.report_title || '제목 없음'}
                      </Typography>
                      <Chip
                        label={report.status === 'completed' ? '분석 완료' : '처리 중'}
                        size="small"
                        color={report.status === 'completed' ? 'success' : 'warning'}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      분석일: {report.created_at ? new Date(report.created_at).toLocaleDateString('ko-KR') : '-'}
                    </Typography>
                  }
                />
                <IconButton size="small" color="primary">
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </ReportListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );
}

export default UnsubmittedReports;