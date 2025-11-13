import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

// 1. [신규] MUI의 CSS 초기화 (Normalize)
import CssBaseline from '@mui/material/CssBaseline';
// 2. [신규] MUI의 기본 폰트 (Roboto)
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// [삭제] index.css는 더 이상 사용하지 않습니다.

import App from './App.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx' 
// 3. [신규] 리포트 상세 페이지 임포트
import ReportPage from './pages/ReportPage.jsx';

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, 
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      // 4. [신규] 리포트 상세 페이지 라우트
      // (예: /report/a1b2c3d4-...)
      { path: "/report/:reportId", element: <ReportPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* 5. [신규] <CssBaseline />을 맨 위에 둡니다. */}
    <CssBaseline />
    <RouterProvider router={router} />
  </React.StrictMode>
);