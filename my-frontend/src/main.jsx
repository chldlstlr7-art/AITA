import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme.js'; // (이전에 만든 테마 파일 임포트)

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import App from './App.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx' 
import ReportPage from './pages/ReportPage.jsx';
// 1. [삭제!] ForgotPasswordPage 임포트 제거

import TADashboard from './pages/ta/TADashboard.jsx';
import TACourseDetail from './pages/ta/TACourseDetail.jsx';
import TAAssignmentDetail from './pages/ta/TAAssignmentDetail.jsx';
import TAGradingDetail from './pages/ta/TAGradingDetail.jsx';


const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, 
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/report/:reportId", element: <ReportPage /> },

      // 🆕 TA용 라우트
      {path: "/ta", element: <TADashboard /> },
      {path: "/ta/course/:courseId", element: <TACourseDetail />,},
      {path: "/ta/course/:courseId/assignment/:assignmentId", element: <TAAssignmentDetail /> ,},
      {path: "/ta/course/:courseId/assignment/:assignmentId/grading", element: <TAGradingDetail /> ,},
      // 2. [삭제!] /forgot-password 라우트 제거
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