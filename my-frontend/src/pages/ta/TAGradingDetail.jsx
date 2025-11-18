import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Paper, List, ListItemButton, ListItemText, CircularProgress, ListItem, Divider, Collapse, IconButton, Stack, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getTaCourses, getAssignmentsByCourse, getAssignmentSubmissions, getAssignmentCriteria, getAssignmentDetail, putAssignmentCriteria } from '../../services/api.js';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

function TAGradingDetail() {
    const navigate = useNavigate();
    const { courseId } = useParams();
    const location = useLocation();
    const courseFromState = location.state?.course || null;
	const [taCourses, setTaCourses] = useState([]);
	const [loadingCourses, setLoadingCourses] = useState(true);
	const [coursesError, setCoursesError] = useState('');
	const [navigatingCourseId, setNavigatingCourseId] = useState(null);


	useEffect(() => {
		let mounted = true;
		const fetch = async () => {
			setLoadingCourses(true);
			try {
				const data = await getTaCourses();
				const list = data?.courses || data?.courses || data || [];
				if (!mounted) return;
				setTaCourses(list);
				setCoursesError('');
			} catch (e) {
				console.error('TA 과목 목록 로드 실패:', e);
				setCoursesError(e.message || '과목 목록을 불러오지 못했습니다.');
				setTaCourses([]);
			} finally {
				if (mounted) setLoadingCourses(false);
			}
		};
		fetch();
		return () => { mounted = false; };
	}, []);

	const SIDEBAR_WIDTH = { xs: '180px', sm: '220px', md: '260px' };

	const [assignments, setAssignments] = useState([]);
	const [loadingAssignments, setLoadingAssignments] = useState(true);
	const [expandedMap, setExpandedMap] = useState({});

	useEffect(() => {
		let mounted = true;
		const fetch = async () => {
			if (!courseId) return;
			setLoadingAssignments(true);
			try {
				const data = await getAssignmentsByCourse(courseId);
				const list = data?.assignments || data || [];
				if (!mounted) return;
				setAssignments(list);
			} catch (e) {
				console.error('과제 목록 로드 실패:', e);
				setAssignments([]);
			} finally {
				if (mounted) setLoadingAssignments(false);
			}
		};
		fetch();
		return () => { mounted = false; };
	}, [courseId]);

	const toggleExpand = async (assignment) => {
		const id = assignment?.id;
		if (!id) return;
		setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
		// If expanding and submissions not present, try load
		if (!expandedMap[id] && (!assignment.submissions || assignment.submissions.length === 0)) {
			try {
				const res = await getAssignmentSubmissions(id);
				const subs = res?.submissions || res || [];
				setAssignments((prev) => prev.map((a) => (String(a.id) === String(id) ? { ...a, submissions: subs } : a)));
			} catch (e) {
				console.error('제출물 로드 실패:', e);
			}
		}
	};

	// ===== 채점 기준 다이얼로그 상태 및 핸들러
	const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false);
	const [criteriaLoading, setCriteriaLoading] = useState(false);
	const [criteriaText, setCriteriaText] = useState('');
	const [criteriaRows, setCriteriaRows] = useState([]);
	const [currentCriteriaAssignmentId, setCurrentCriteriaAssignmentId] = useState(null);

	const handleOpenCriteriaDialog = (assignmentId) => {
		(async () => {
			if (!assignmentId) {
				alert('과제 정보가 없습니다.');
				return;
			}
			setCriteriaLoading(true);
			setCurrentCriteriaAssignmentId(assignmentId);
			try {
				let criteriaData = null;
				try {
					criteriaData = await getAssignmentCriteria(assignmentId);
				} catch (err) {
					// 폴백: assignment 상세에서 조회
					const data = await getAssignmentDetail(assignmentId);
					const a = data.assignment || data;
					criteriaData = a.criteria || data.criteria || null;
				}

				setCriteriaText(criteriaData ? JSON.stringify(criteriaData, null, 2) : '');
				if (criteriaData) {
					if (Array.isArray(criteriaData)) {
						setCriteriaRows(
							criteriaData.map((v, i) => ({
								key: v.key || `criteria_${i + 1}`,
								name: v.key || v.name || `criteria_${i + 1}`,
								description: v.name || v.title || v.description || '',
								max_score: v.max_score ?? v.maxScore ?? v.score ?? 0,
							}))
						);
					} else if (typeof criteriaData === 'object') {
						setCriteriaRows(
							Object.keys(criteriaData).map((k) => ({
								key: k,
								name: k,
								description: criteriaData[k]?.name || '',
								max_score: criteriaData[k]?.max_score ?? criteriaData[k]?.maxScore ?? 0,
							}))
						);
					} else {
						setCriteriaRows([]);
					}
				} else {
					setCriteriaRows([]);
				}
			} catch (e) {
				console.error('채점 기준 로드 실패:', e);
				alert('채점 기준을 불러오지 못했습니다.');
				setCriteriaText('');
				setCriteriaRows([]);
			} finally {
				setCriteriaLoading(false);
				setCriteriaDialogOpen(true);
			}
		})();
	};

	const handleAddRow = () => setCriteriaRows((prev) => [...prev, { name: '', description: '', max_score: 0 }]);
	const handleRemoveRow = (index) => setCriteriaRows((prev) => prev.filter((_, i) => i !== index));
	const handleChangeRow = (index, field, value) => setCriteriaRows((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });

	const handleSaveCriteria = async () => {
		if (!currentCriteriaAssignmentId) return;
		try {
			if (!criteriaRows || criteriaRows.length === 0) {
				await putAssignmentCriteria(currentCriteriaAssignmentId, null);
				setCriteriaDialogOpen(false);
				return;
			}
			const payload = {};
			criteriaRows.forEach((r, i) => {
				const key = r.key || `criteria_${i + 1}`;
				payload[key] = { name: r.description || '', max_score: Number(r.max_score) || 0 };
			});
			await putAssignmentCriteria(currentCriteriaAssignmentId, payload);
			setCriteriaDialogOpen(false);
		} catch (e) {
			console.error('채점 기준 저장 실패:', e);
			alert('채점 기준 저장 중 오류가 발생했습니다.');
		}
	};

	return (
		<Box sx={{ mt: 4, px: { xs: 1, md: 1 }, boxSizing: 'border-box' }}>
			<Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
				{/* Left sidebar: TA courses */}
				<Box sx={{ width: SIDEBAR_WIDTH, position: 'fixed', left: 0, top: '64px', height: `calc(100vh - 64px)`, p: 2, boxSizing: 'border-box', zIndex: 1200 }}>
					<Paper sx={{ p: 2, borderRadius: 1.5, backgroundColor: '#fff', height: '100%', overflowY: 'auto' }} elevation={1}>
						<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }} onClick={() => navigate('/ta')}>내 과목</Typography>

						{loadingCourses ? (
							<Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={20} /></Box>
						) : coursesError ? (
							<Typography variant="body2" color="error">{coursesError}</Typography>
						) : taCourses.length === 0 ? (
							<Typography variant="body2" color="text.secondary">담당 과목이 없습니다.</Typography>
						) : (
							<List disablePadding sx={{ overflowY: 'auto', maxHeight: 'calc(100% - 32px)' }}>
								{taCourses.map((c) => (
									<ListItemButton
										key={c.id}
										onClick={() => {
											// 과제별 Grading이 아닌 과목 단위 Grading으로 이동
											setNavigatingCourseId(c.id);
											navigate(`/ta/course/${c.id}/grading`, { state: { course: c } });
											setNavigatingCourseId(null);
										}}
										sx={{ justifyContent: 'flex-start', alignItems: 'flex-start', py: 1.1 }}
									>
										<ListItemText
											primary={
												<Typography variant="subtitle2" noWrap sx={{ fontWeight: String(c.id) === String(courseId) ? 700 : 400 }}>
													{c.course_name || c.course_code || '무명'}
												</Typography>
											}
											secondary={<Typography variant="caption" color="text.secondary">{c.semester_label || c.semester_text || c.semester}</Typography>}
										/>
										{navigatingCourseId === c.id && (
											<Box sx={{ ml: 1 }}><CircularProgress size={18} /></Box>
										)}
									</ListItemButton>
								))}
							</List>
						)}
					</Paper>
				</Box>

				{/* Main content area */}
				<Box sx={{ ml: { xs: '150px', sm: '200px', md: '220px' }, width: '100%' }}>
						<Paper sx={{ p: 3, mb: 3 }} elevation={1}>
							<Button
								startIcon={<ArrowBackIcon fontSize="small" />}
								size="small"
								onClick={() => navigate(-1)}
								sx={{
									color: 'text.secondary',
									textTransform: 'none',
									minWidth: 64,
									px: 1,
								}}
							>
								뒤로
							</Button>
							<Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
								채점 종합 관리
							</Typography>
							<Typography variant="h6" sx={{ mt: 1, fontWeight: 400, fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
								{courseFromState?.course_name || courseFromState?.name || taCourses.find(c => String(c.id) === String(courseId))?.course_name || `과목 ID: ${courseId}`}
							</Typography>
						</Paper>

						{/* Assignments list + Statistics: 3:1 layout */}
						{loadingAssignments ? (
							<Paper sx={{ p: 3 }} elevation={0}><Typography>과제 목록을 불러오는 중입니다...</Typography></Paper>
						) : (
							<Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
								{/* Left: assignments (3) */}
								<Box sx={{ flex: 3 }}>
									{assignments.length === 0 ? (
										<Paper sx={{ p: 3 }} elevation={0}><Typography color="text.secondary">등록된 과제가 없습니다.</Typography></Paper>
									) : (
										<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
											{assignments.map((a) => {
												const submitted = a.report_count ?? a.submission_count ?? (Array.isArray(a.submissions) ? a.submissions.length : 0);
												let graded = a.graded_count ?? a.graded_reports ?? a.graded_submissions ?? 0;
												if (!graded && Array.isArray(a.submissions)) {
													graded = a.submissions.filter((s) => s && (s.graded === true || s.score != null || String(s.status || '').toLowerCase() === 'graded')).length;
												}
												const isExpanded = Boolean(expandedMap[a.id]);
												return (
													<Paper key={a.id} sx={{ p: 2 }} elevation={1}>
														<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
															<Box>
																<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{a.assignment_name || a.name || '무제 과제'}</Typography>
																{/* 제출/채점 현황을 TACourseDetail 스타일의 버튼(Chip)로 대체 */}
																<Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
																	{(() => {
																		const total = a.total_students ?? undefined;
																		const submittedOk = typeof total === 'number' ? submitted >= total : null;
																		const submittedLabel = total ? `제출 ${submitted}/${total}` : `제출 ${submitted}`;
																		return (
																			<Chip
																				label={submittedLabel}
																				size="small"
																				clickable
																				onClick={(e) => { e.stopPropagation(); toggleExpand(a); }}
																				sx={(theme) => ({
																					cursor: 'pointer',
																					fontSize: '0.85rem',
																					px: 1,
																					py: 0.4,
																					...(submittedOk === null
																						? {}
																						: submittedOk
																							? { backgroundColor: 'rgba(16,185,129,0.12)', color: theme.palette.success.dark }
																							: { backgroundColor: 'rgba(239,68,68,0.08)', color: theme.palette.error.dark }),
																				})}
																			/>
																		);
																	})()}

																	{(() => {
																		const gradedOk = typeof submitted === 'number' && submitted > 0 ? graded >= submitted : null;
																		const gradedLabel = submitted ? `채점 ${graded}/${submitted}` : `채점완료 ${graded}`;
																		return (
																			<Chip
																				label={gradedLabel}
																				size="small"
																				clickable
																				onClick={(e) => { e.stopPropagation(); toggleExpand(a); }}
																				sx={(theme) => ({
																					cursor: 'pointer',
																					fontSize: '0.85rem',
																					px: 1,
																					py: 0.4,
																					...(gradedOk === null
																						? (graded > 0 ? { backgroundColor: 'rgba(16,185,129,0.08)', color: theme.palette.success.dark } : {})
																						: gradedOk
																							? { backgroundColor: 'rgba(16,185,129,0.12)', color: theme.palette.success.dark }
																							: { backgroundColor: 'rgba(239,68,68,0.08)', color: theme.palette.error.dark }),
																				})}
																			/>
																		);
																	})()}
																</Stack>
															</Box>
															<Stack direction="column" spacing={1} alignItems="flex-end">
																<Button variant="outlined" size="medium" onClick={() => handleOpenCriteriaDialog(a.id)}>채점 기준</Button>
																<Button variant="text" size="small" onClick={() => toggleExpand(a)}>{isExpanded ? '제출물 접기' : '제출물 보기'}</Button>
															</Stack>
														</Box>
														<Collapse in={isExpanded} timeout="auto" unmountOnExit>
															<Box sx={{ mt: 2 }}>
																{Array.isArray(a.submissions) && a.submissions.length > 0 ? (
																	<List disablePadding>
																		{a.submissions.map((s, idx) => (
																			<React.Fragment key={s.id || s.report_id || idx}>
																				<ListItem sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
																					<ListItemText
																						primary={s.student_name || s.student_email || `제출자 ${idx + 1}`}
																						secondary={`리포트 ID: ${s.id || s.report_id || '-'}`}
																					/>
																					<Box>
																						{(() => {
																							const isGraded = Boolean(s && (s.graded === true || s.score != null || String(s.status || s.state || '').toLowerCase() === 'graded' || String(s.graded) === 'true'));
																							const isCompleted = String(s.status || s.state || '').toLowerCase() === 'completed';
																							return (
																							<>
																								{isCompleted ? (
																									<>
																										<Button size="small" variant="contained" onClick={() => navigate(`/ta/course/${courseId}/assignment/${a.id}/report/${s.id || s.report_id}/analysis`, { state: { course: courseFromState, assignment: a, student: s, openTabIndex: 0 } })}>AI분석</Button>
																										{isGraded ? (
																										<Button size="small" variant="contained" color="success" sx={{ ml: 1 }} disabled>채점완료</Button>
																										) : (
																										<Button size="small" variant="outlined" sx={{ ml: 1 }} onClick={() => navigate(`/ta/course/${courseId}/assignment/${a.id}/report/${s.id || s.report_id}/analysis`, { state: { course: courseFromState, assignment: a, student: s, openTabIndex: 2 } })}>채점하기</Button>
																										)}
																									</>
																								) : (
																									<>
																										<Button size="small" variant="outlined" onClick={() => navigate(`/ta/course/${courseId}/assignment/${a.id}/report/${s.id || s.report_id}/aita`, { state: { course: courseFromState, assignment: a, student: s } })}>AITA분석</Button>
																										{isGraded ? (
																										<Button size="small" variant="contained" color="success" sx={{ ml: 1 }} disabled>채점완료</Button>
																										) : (
																										<Button size="small" variant="contained" sx={{ ml: 1 }} onClick={() => navigate(`/ta/course/${courseId}/assignment/${a.id}/report/${s.id || s.report_id}/analysis`, { state: { course: courseFromState, assignment: a, student: s, openTabIndex: 2 } })}>채점하기</Button>
																										)}
																									</>
																								)}
																							</>
																							);
																						})()}
																				</Box>
																			</ListItem>
																				<Divider component="li" />
																			</React.Fragment>
																		))}
																	</List>
																) : (
																	<Typography color="text.secondary">제출물이 없습니다.</Typography>
																)}
															</Box>
														</Collapse>
													</Paper>
												);
											})}
										</Box>
									)}
								</Box>

								{/* Right: statistics (1) */}
								<Box sx={{ flex: 1 }}>
									<Paper sx={{ p: 2, borderRadius: 1, position: 'sticky', top: 96, minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} elevation={1}>
										<Box>
											<Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>통계</Typography>
											<Typography variant="body2" color="text.secondary">여기에 통계 요약을 출력 예정</Typography>
										</Box>
										<Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
											<Button
												variant="contained"
												size="medium"
												onClick={() => navigate(`/ta/course/${courseId}/stats`, { state: { course: courseFromState } })}
											>
												통계 페이지 바로가기
											</Button>
										</Box>
									</Paper>
								</Box>
							</Box>
						)}
					</Box>

					{/* 채점 기준 다이얼로그 (AssignmentDetail의 동작과 동일) */}
					<Dialog open={criteriaDialogOpen} onClose={() => setCriteriaDialogOpen(false)} fullWidth maxWidth="lg">
						<DialogTitle>채점 기준 보기/수정</DialogTitle>
						<DialogContent>
							{criteriaLoading ? (
								<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
							) : (
								<Stack spacing={2}>
									{(!criteriaRows || criteriaRows.length === 0) && (
										<Typography color="text.secondary">채점 항목이 없습니다. 새 항목을 추가하세요.</Typography>
									)}

									<Box sx={{ pt: 2 }}>
										{criteriaRows.map((row, idx) => (
											<Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'stretch', mb: 1 }}>
												<TextField label="채점 항목" value={row.name} onChange={(e) => handleChangeRow(idx, 'name', e.target.value)} variant="outlined" fullWidth sx={{ flex: 1, '& .MuiInputBase-root': { minHeight: 56 } }} />
												<TextField label="채점 기준 설명" value={row.description} onChange={(e) => handleChangeRow(idx, 'description', e.target.value)} variant="outlined" multiline fullWidth sx={{ flex: 2, '& .MuiInputBase-root': { minHeight: 56, alignItems: 'flex-start', paddingTop: '10px' } }} />
												<TextField label="배점" value={row.max_score} onChange={(e) => handleChangeRow(idx, 'max_score', e.target.value)} variant="outlined" type="number" sx={{ width: 110, '& .MuiInputBase-root': { minHeight: 56, justifyContent: 'center' }, '& input': { textAlign: 'center' } }} />
												<IconButton onClick={() => handleRemoveRow(idx)} aria-label="삭제" sx={{ alignSelf: 'center' }}><DeleteIcon /></IconButton>
											</Box>
										))}
									</Box>

									<Box>
										<Button startIcon={<AddCircleOutlineIcon />} onClick={handleAddRow}>항목 추가</Button>
									</Box>
								</Stack>
							)}
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setCriteriaDialogOpen(false)}>닫기</Button>
							<Button variant="contained" onClick={handleSaveCriteria}>저장</Button>
						</DialogActions>
					</Dialog>

				</Box>
			</Box>
		);
}

export default TAGradingDetail;

