import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  useRouteError,
} from "react-router-dom";

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme.js';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import App from './App.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx' 
import ReportPage from './pages/ReportPage.jsx';
import AdvancementPage from './pages/AdvancementPage.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';

import TADashboard from './pages/ta/TADashboard.jsx';
import TACourseDetail from './pages/ta/TACourseDetail.jsx';
import TAAssignmentDetail from './pages/ta/TAAssignmentDetail.jsx';
import TAGradingDetail from './pages/ta/TAGradingDetail.jsx';
import TAReportPage from './pages/ta/TAReportPage.jsx';

// 🔥 에러 페이지
function ErrorPage() {
  const error = useRouteError();
  console.error('🔴 Router Error:', error);

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace' }}>
      <h1>⚠️ 라우팅 오류 발생</h1>
      <h2>{error?.status} {error?.statusText}</h2>
      <p><strong>Message:</strong> {error?.message}</p>
      <details style={{ marginTop: '20px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>에러 상세 정보</summary>
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '20px', 
          overflow: 'auto',
          marginTop: '10px'
        }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      </details>
      <button 
        onClick={() => window.location.href = '/'} 
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          cursor: 'pointer'
        }}
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      
      // 🔥 학생 대시보드
      { path: "/dashboard", element: <StudentDashboard /> },
      { path: "/dashboard/:userId", element: <StudentDashboard /> }, // 🔥 개발자용 학생 ID 파라미터 지원
      
      // 발전 아이디어 페이지
      { 
        path: "/report/:reportId/advancement", 
        element: <AdvancementPage />,
        errorElement: <ErrorPage />
      },
      
      // 리포트 페이지
      { path: "/report/:reportId", element: <ReportPage /> },

      // 🔥 TA용 라우트
      { path: "/ta", element: <TADashboard /> },
      { path: "/ta/dashboard", element: <TADashboard /> },
      { path: "/ta/grading", element: <TAGradingDetail /> }, // 🔥 TA 채점 관리 페이지 (메인)
      { path: "/ta/course/:courseId", element: <TACourseDetail /> },
      { path: "/ta/course/:courseId/assignment/:assignmentId", element: <TAAssignmentDetail /> },
      { path: "/ta/course/:courseId/assignment/:assignmentId/grading", element: <TAGradingDetail /> }, // 🔥 특정 과제 채점 페이지
      { path: "/ta/course/:courseId/grading", element: <TAGradingDetail /> },
      { path: "/ta/course/:courseId/assignment/:assignmentId/report/:reportId/analysis", element: <TAReportPage /> },

    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>
);