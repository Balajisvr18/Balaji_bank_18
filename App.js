import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CustomerPage from './components/CustomerPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import AdminPage from './components/AdminPage';
import SendMoneyPage from './components/SendMoneyPage';



function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/sendmoney" element={<SendMoneyPage />} />
          

        </Routes>
      </div>
    </Router>
  );
}

export default App;
