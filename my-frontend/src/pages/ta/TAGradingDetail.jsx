import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
	Box,
	Paper,
	Typography,
	Stack,
	Button,
	List,
	ListItem,
	ListItemText,
	Divider,
	Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// 더미 채점 관리 페이지 (구조만 채워진 상태)
function TAGradingDetail() {
	const { courseId, assignmentId } = useParams();
	const navigate = useNavigate();

	// 더미 데이터
	const criteria = useMemo(
		() => [
			{ key: 'c1', name: '논리', description: '논리적 전개 및 근거 제시', max_score: 5 },
			{ key: 'c2', name: '표현', description: '문장 구성 및 표현력', max_score: 5 },
			{ key: 'c3', name: '참신성', description: '창의적 접근', max_score: 10 },
		],
		[]
	);

	const submissions = useMemo(
		() => [
			{ id: 1, student_name: '홍길동', status: 'submitted', graded: false, score: null },
			{ id: 2, student_name: '김철수', status: 'submitted', graded: true, score: 18 },
			{ id: 3, student_name: '이영희', status: 'submitted', graded: false, score: null },
		],
		[]
	);

	const submittedCount = submissions.length;
	const gradedCount = submissions.filter((s) => s.graded).length;

	return (
		<Box sx={{ p: 3 }}>
			<Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} elevation={1}>
				<Stack direction="row" spacing={2} alignItems="center">
					<Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
						뒤로
					</Button>
					<Box>
						<Typography variant="h6">채점 관리 (더미)</Typography>
						<Typography variant="body2" color="text.secondary">
							과제 ID: {assignmentId || '-'} · 과목 ID: {courseId || '-'}
						</Typography>
					</Box>
				</Stack>

				<Stack direction="row" spacing={1}>
					<Button startIcon={<EditIcon />} variant="outlined" size="small">
						설정
					</Button>
					<Button startIcon={<CheckCircleIcon />} variant="contained" color="primary" size="small">
						채점 시작
					</Button>
				</Stack>
			</Paper>

			<Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
				<Box sx={{ flex: 3 }}>
					<Paper sx={{ p: 2, mb: 2 }} elevation={1}>
						<Typography variant="h6">제출 목록</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>제출된 리포트의 더미 리스트입니다.</Typography>
						<List>
							{submissions.map((s) => (
								<React.Fragment key={s.id}>
									<ListItem sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
										<ListItemText primary={s.student_name} secondary={`ID: ${s.id} · 상태: ${s.status}`} />
										<Stack direction="row" spacing={1} alignItems="center">
											<Chip label={`점수: ${s.score ?? '-'} `} size="small" />
											<Chip label={s.graded ? '채점 완료' : '미채점'} color={s.graded ? 'success' : 'default'} size="small" />
											<Button size="small" variant="outlined" onClick={() => alert('채점 더미 동작')}>채점</Button>
										</Stack>
									</ListItem>
									<Divider />
								</React.Fragment>
							))}
						</List>
					</Paper>

					<Paper sx={{ p: 2 }} elevation={1}>
						<Typography variant="h6">기본 통계</Typography>
						<Stack spacing={1} sx={{ mt: 1 }}>
							<Typography variant="body2">총 제출 수: {submittedCount}개</Typography>
							<Typography variant="body2">채점 완료: {gradedCount}개</Typography>
							<Typography variant="body2">평균 점수(더미): {gradedCount ? Math.round((submissions.filter(s=>s.graded).reduce((a,b)=>a+(b.score||0),0)/gradedCount)*10)/10 : '-'}</Typography>
						</Stack>
					</Paper>
				</Box>

				<Box sx={{ flex: 1, minWidth: 300 }}>
					<Paper sx={{ p: 2, mb: 2 }} elevation={1}>
						<Typography variant="h6">채점 기준 미리보기</Typography>
						<Stack spacing={1} sx={{ mt: 1 }}>
							{criteria.map((c) => (
								<Box key={c.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<Box>
										<Typography variant="subtitle2">{c.name} <Typography component="span" variant="caption" color="text.secondary">· {c.max_score}점</Typography></Typography>
										<Typography variant="body2" color="text.secondary">{c.description}</Typography>
									</Box>
									<Button size="small" variant="text" onClick={() => alert('기준 상세 더미')}>수정</Button>
								</Box>
							))}
						</Stack>
					</Paper>

					<Paper sx={{ p: 2 }} elevation={1}>
						<Typography variant="h6">단축 동작</Typography>
						<Stack spacing={1} sx={{ mt: 1 }}>
							<Button variant="outlined" size="small" onClick={() => alert('모두 채점 완료(더미)')}>
								모두 채점 완료로 표시
							</Button>
							<Button variant="outlined" size="small" onClick={() => alert('채점 요약 내보내기(더미)')}>
								채점 요약 내보내기
							</Button>
						</Stack>
					</Paper>
				</Box>
			</Box>
		</Box>
	);
}

export default TAGradingDetail;

