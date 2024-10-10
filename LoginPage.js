import React, { useState } from 'react';
import { TextField, Button, Typography, Box, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig'; // Correct path to firebaseConfig
import { signInWithEmailAndPassword } from 'firebase/auth';
// const FIRESTORE_API_BASE_URL="https://firestore.googleapis.com/v1/projects/modern-bank-cb66c/databases/(default)/documents/"

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      // Authenticate using Firebase
      await signInWithEmailAndPassword(auth, email, password);

      // // Fetch admin status from Firestore
      // const response = await fetch(`${FIRESTORE_API_BASE_URL}admin?where=email==${email}`, {
      //   method: 'GET',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      // });

      // const data = await response.json();
      sessionStorage.setItem('email', email);
      // Check if user is admin
      if (email==="balajisvr18@gmail.com") {
        navigate('/admin');
      } else {
        navigate('/customer');
      }
    } catch (err) {
      setError('Authentication failed. Please check your email and password.');
      console.error('Error during login:', err);
    }
  };

  const goToSignUp = () => {
    navigate('/signup');
  };

  return (
    <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
    }}
  >
    <Card sx={{ maxWidth: 400, width: '100%', boxShadow: 3 }}>
      <CardContent>
        <Typography variant="h4" align="center" gutterBottom>
          Login
        </Typography>

        {error && (
          <Typography variant="body2" color="error" align="center" sx={{ marginBottom: '1rem' }}>
            {error}
          </Typography>
        )}

        <TextField
          label="Email"
          variant="outlined"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          sx={{ marginBottom: '1rem' }}
        />
        <TextField
          label="Password"
          type="password"
          variant="outlined"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          sx={{ marginBottom: '1.5rem' }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleLogin}
          fullWidth
          sx={{ marginBottom: '1rem' }}
        >
          Login
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          onClick={goToSignUp}
          fullWidth
        >
          Sign Up
        </Button>
      </CardContent>
    </Card>
  </Box>
  );
}

export default LoginPage;
