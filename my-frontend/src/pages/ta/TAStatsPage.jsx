import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Stack, Grid, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getAssignmentsByCourse, getAssignmentStats } from '../../services/api.js';

export default function TAStatsPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const location = useLocation();
  const course = location.state?.course || null;

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAssignmentsByCourse(courseId);
        const list = res?.assignments || [];
        if (!mounted) return;
        setAssignments(list);

        // Fetch stats for each assignment in parallel (settled)
        const statResults = await Promise.allSettled((list || []).map((a) => getAssignmentStats(a.id)));
        if (!mounted) return;
        const map = {};
        (list || []).forEach((a, idx) => {
          const r = statResults[idx];
          map[a.id] = r && r.status === 'fulfilled' ? r.value : null;
        });
        setStatsMap(map);
      } catch (e) {
        console.error('TAStatsPage load error', e);
        if (!mounted) return;
        setError(e.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAll();
    return () => { mounted = false; };
  }, [courseId]);

  return (
    <Box sx={{ mt: 4, px: { xs: 1, md: 2 } }}>
      <Paper sx={{ p: 3 }} elevation={1}>
        <Box sx={{ mt: 1, mb: 1 }}>
          <Box
            onClick={() => navigate(-1)}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, cursor: 'pointer', color: 'text.secondary' }}
            aria-label="뒤로가기"
          >
            <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 700 }}>{'<'}</Typography>
            <Typography component="span" sx={{ color: 'text.secondary' }}>{course?.course_name || `과목 ${courseId}`}</Typography>
          </Box>
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700 }}>통계 모아보기</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          과목 {course?.course_name || courseId} 에 대한 통계입니다.
        </Typography>


        <Box sx={{ mt: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
          ) : error ? (
            <Typography color="error">에러: {error}</Typography>
          ) : assignments.length === 0 ? (
            <Typography color="text.secondary">등록된 과제가 없습니다.</Typography>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {assignments.map((a) => {
                const s = statsMap[a.id];
                const submitted = s?.submission_count ?? a.report_count ?? a.submission_count ?? (Array.isArray(a.submissions) ? a.submissions.length : 0);
                const total_students = s?.total_students ?? a.total_students ?? null;
                const submissionRate = s?.submission_rate ?? (typeof submitted === 'number' && typeof total_students === 'number' && total_students > 0 ? ((submitted / total_students) * 100) : null);
                const graded_count = s?.graded_count ?? s?.gradedCount ?? 0;
                const average_score = s?.average_score ?? null;
                const max_score = s?.max_score ?? null;
                const min_score = s?.min_score ?? null;
                const stddev_score = s?.stddev_score ?? null;

                return (
                  <Paper key={a.id} sx={{ p: 2 }} elevation={1}>
                    <Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{s?.assignment_name || a.assignment_name || a.name || `과제 ${a.id}`}</Typography>
                        <Typography variant="caption" color="text.secondary">과제 ID: {a.id}</Typography>
                      </Box>

                      <TableContainer sx={{ mt: 1 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>총 수강생</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>제출 수</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>제출률</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>채점 수</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              <TableCell sx={{ py: 1 }}>{total_students != null ? total_students : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{submitted != null ? submitted : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{submissionRate != null ? `${Number(submissionRate).toFixed(1)}%` : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{graded_count != null ? graded_count : '-'}</TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, pt: 2 }}>평균</TableCell>
                              <TableCell sx={{ fontWeight: 700, pt: 2 }}>최대</TableCell>
                              <TableCell sx={{ fontWeight: 700, pt: 2 }}>최소</TableCell>
                              <TableCell sx={{ fontWeight: 700, pt: 2 }}>표준편차</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ py: 1 }}>{average_score != null ? Number(average_score).toFixed(2) : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{max_score != null ? Number(max_score).toFixed(2) : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{min_score != null ? Number(min_score).toFixed(2) : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{stddev_score != null ? Number(stddev_score).toFixed(2) : '-'}</TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, pt: 2 }}>Q1 (25%)</TableCell>
                              <TableCell sx={{ fontWeight: 700, pt: 2 }}>Q2 (50%)</TableCell>
                              <TableCell sx={{ fontWeight: 700, pt: 2 }}>Q3 (75%)</TableCell>
                              <TableCell />
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ py: 1 }}>{s?.q1 != null ? Number(s.q1).toFixed(2) : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{s?.q2 != null ? Number(s.q2).toFixed(2) : '-'}</TableCell>
                              <TableCell sx={{ py: 1 }}>{s?.q3 != null ? Number(s.q3).toFixed(2) : '-'}</TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
