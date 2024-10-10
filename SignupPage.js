import React, { useState } from 'react';
import { TextField, Button, Typography, Box, Card, CardContent, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
const FIRESTORE_API_BASE_URL="https://firestore.googleapis.com/v1/projects/modern-bank-cb66c/databases/(default)/documents/"

function SignupPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    mobile: '',
    aadhaar: null,
    pan: null,
    balance: '',
    password: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: files ? files[0] : value
    }));
  };

  // Convert image file to Base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Convert Aadhaar and PAN images to Base64
      const aadhaarBase64 = await fileToBase64(formData.aadhaar);
      const panBase64 = await fileToBase64(formData.pan);

      // Prepare the data to send to Firebase
      const dataToSubmit = {
        fields: {
          email: { stringValue: formData.email },
          name: { stringValue: formData.name },
          mobile: { stringValue: formData.mobile },
          aadhaar: { stringValue: aadhaarBase64 },
          pan: { stringValue: panBase64 },
          password: { stringValue: formData.password },
          status: { booleanValue: false }, // Account creation pending
        }
      };

      // Use fetch API to send a POST request to Firestore
      console.log('Env Variables:', process.env);

      const apiUrl = `${FIRESTORE_API_BASE_URL}creation`; // The `creation` table/collection
      console.log('API Base URL:', process.env.FIRESTORE_API_BASE_URL);


      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(dataToSubmit)
      });

      if (response.ok) {
        setSuccessMessage('Account creation requested, check after 1 day.');
        setTimeout(() => navigate('/'), 5000); // Redirect after success
      } else {
        const errorData = await response.json();
        console.error('Error:', errorData);
        alert('Failed to create account. Please try again.');
      }

    } catch (error) {
      console.error('Error creating account:', error);
      alert('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
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
      <Card sx={{ maxWidth: 500, width: '100%', boxShadow: 3 }}>
        <CardContent>
          <Typography variant="h4" align="center" gutterBottom>
            Sign Up
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              fullWidth
              variant="outlined"
              sx={{ marginBottom: '1rem' }}
              required
            />

            <TextField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              fullWidth
              variant="outlined"
              sx={{ marginBottom: '1rem' }}
              required
            />

            <TextField
              label="Mobile"
              name="mobile"
              value={formData.mobile}
              onChange={handleInputChange}
              fullWidth
              variant="outlined"
              sx={{ marginBottom: '1rem' }}
              required
            />

            <Typography variant="body1" sx={{ marginBottom: '0.5rem' }}>
              Aadhaar Photo:
            </Typography>
            <input
              type="file"
              name="aadhaar"
              accept="image/*"
              onChange={handleInputChange}
              style={{ marginBottom: '1.5rem', width: '100%' }}
              required
            />

            <Typography variant="body1" sx={{ marginBottom: '0.5rem' }}>
              PAN Photo:
            </Typography>
            <input
              type="file"
              name="pan"
              accept="image/*"
              onChange={handleInputChange}
              style={{ marginBottom: '1.5rem', width: '100%' }}
              required
            />

            <TextField
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              fullWidth
              variant="outlined"
              sx={{ marginBottom: '1.5rem' }}
              required
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              sx={{ padding: '0.75rem', marginBottom: '1rem' }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </form>

          {successMessage && (
            <Typography variant="body1" align="center" sx={{ color: 'green', marginTop: '1rem' }}>
              {successMessage}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignupPage;
