import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './components/Header.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import Container from '@mui/material/Container';

function App() {
  return (
    <AuthProvider>
      <Header />
      <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Outlet /> {/* HomePage, LoginPage 등이 여기에 옴 */}
      </Container>
    </AuthProvider>
  );
}

export default App;