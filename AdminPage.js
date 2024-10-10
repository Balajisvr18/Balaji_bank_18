import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Button, Box, Snackbar, TextField } from '@mui/material';
import emailjs from 'emailjs-com';

const FIRESTORE_API_BASE_URL = "https://firestore.googleapis.com/v1/projects/modern-bank-cb66c/databases/(default)/documents/";

const AdminPage = () => {
  const [requests, setRequests] = useState([]);
  const [loanRequests, setLoanRequests] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [showRequests, setShowRequests] = useState(false);
  const [showLoanRequests, setShowLoanRequests] = useState(false);
  const [transactionLimit, setTransactionLimit] = useState('');
  const [showTransactionLimit, setShowTransactionLimit] = useState(false); // Add this line

  const [transactionDocId, setTransactionDocId] = useState('');
  const itemsPerPage = 1;

  useEffect(() => {
    if (showRequests) {
      fetchRequests();
    }
    if (showLoanRequests) {
      fetchLoanRequests();
    }
    if (showTransactionLimit) {
      fetchTransactionLimit();
    }
  }, [showRequests, showLoanRequests,showTransactionLimit]);


  const fetchLoanRequests = async () => {
    try {
      const response = await fetch(`${FIRESTORE_API_BASE_URL}loan`);
      const data = await response.json();
      setLoanRequests(data.documents || []);
    } catch (error) {
      console.error('Error fetching loan requests:', error);
      setErrorMessage('Failed to fetch loan requests.');
      setSnackbarOpen(true);
    }
  };

  // Fetch transaction limit from Firestore
  const fetchTransactionLimit = async () => {
    try {
      const response = await fetch(`${FIRESTORE_API_BASE_URL}admin`);
      const data = await response.json();
      const document = data.documents[0]; // Assuming only one document is present
      if (document) {
        setTransactionLimit(document.fields.transaction_limit.doubleValue || '');
        setTransactionDocId(document.name.split('/').pop());
      }
    } catch (error) {
      console.error('Error fetching transaction limit:', error);
      setErrorMessage('Failed to fetch transaction limit.');
      setSnackbarOpen(true);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${FIRESTORE_API_BASE_URL}creation`);
      const data = await response.json();
      setRequests(data.documents || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setErrorMessage('Failed to fetch account creation requests.');
      setSnackbarOpen(true);
    }
  };
  const sendApprovalEmail = async (customerEmail, customerName) => {
    try {
        // EmailJS parameters for sending the email
        const templateParams = {
            subject: 'Account Request Approved!', // Dynamic subject
            to_email: customerEmail, // Dynamic recipient email from passed parameter
            to_name: customerName, // Dynamic recipient name from passed parameter
            message: `Hello ${customerName}, your account request has been approved!`, // Dynamic message
        };

        // Use emailjs to send the email
        emailjs.send('service_q9mevlp', 'template_en7x1tj', templateParams, '_LSxTYS9oERDuG8s0')
            .then((response) => {
                console.log('Email successfully sent!', response.status, response.text);
            }, (error) => {
                console.error('Failed to send email.', error);
            });
    } catch (error) {
        console.error('Error sending approval email:', error);
    }
};

  const handleApprove = async (email, requestData) => {
    try {
        const customerId = Math.floor(100000 + Math.random() * 900000).toString();
        const accountNumber = `${Math.floor(100000 + Math.random() * 900000)}`;
        const initialBalance = 100000; // Initialize the balance for the new account

        // Create a new account object to be added
        const newAccount = {
            mapValue: {
                fields: {
                    accountNumber: { stringValue: accountNumber },
                    balance: { integerValue: initialBalance },
                    status: { booleanValue: true },
                }
            }
        };

        // Check if the customer with this email already exists
        const customerResponse = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
        const customerData = await customerResponse.json();
        const existingCustomerDoc = customerData.documents.find(doc => doc.fields.email.stringValue === email);

        if (existingCustomerDoc) {
            // Customer already exists, append new account to the `accounts` array
            const existingAccounts = existingCustomerDoc.fields.accounts.arrayValue.values || [];
            existingAccounts.push(newAccount); // Add the new account to the accounts array

            const customerDocumentId = existingCustomerDoc.name.split('/').pop();

            // Update the customer with the new account
            const updatedCustomerData = {
                fields: {
                    ...existingCustomerDoc.fields, // Retain all the existing fields
                    accounts: { arrayValue: { values: existingAccounts } }, // Update the accounts array
                }
            };

            await fetch(`${FIRESTORE_API_BASE_URL}customer/${customerDocumentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCustomerData),
            });
        } else {
            // Customer does not exist, create a new customer with the accounts array
            const customerData = {
                fields: {
                    customerId: { stringValue: customerId },
                    email: { stringValue: email },
                    name: requestData.name,
                    mobile: requestData.mobile,
                    pan: requestData.pan,
                    aadhaar: requestData.aadhaar,
                    password: requestData.password,
                    accounts: { arrayValue: { values: [newAccount] } }, // Create new accounts array with the new account
                }
            };

            await fetch(`${FIRESTORE_API_BASE_URL}customer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customerData),
            });
        }
        sendApprovalEmail(email,requestData.name);
        // Delete the request from the creation table after approval
        const response = await fetch(`${FIRESTORE_API_BASE_URL}creation`);
        const data = await response.json();
        const documentToDelete = data.documents.find(doc => doc.fields.email.stringValue === email);

        if (documentToDelete) {
            const id = documentToDelete.name.split('/').pop();
            await fetch(`${FIRESTORE_API_BASE_URL}creation/${id}`, { method: 'DELETE' });
            await addAuthenticatedEmail(email, requestData.password.stringValue);
            fetchRequests();
        } else {
            console.error('Document not found for email:', email);
            setErrorMessage('No request found with the specified email.');
            setSnackbarOpen(true);
        }
    } catch (error) {
        console.error('Error approving request:', error);
        setErrorMessage('Failed to approve the request.');
        setSnackbarOpen(true);
    }
};


const handleLoanApprove = async (customerId, loanAmount) => {
    try {
      // Fetch the loan data to approve
      const response = await fetch(`${FIRESTORE_API_BASE_URL}loan`);
      const data = await response.json();
  
      // Find the document with the matching customerId
      const documentToApprove = data.documents.find(doc => doc.fields.customerId.stringValue === customerId);
      if (!documentToApprove) {
        setErrorMessage('Loan request not found');
        setSnackbarOpen(true);
        return;
      }
  
      // Create a new account number and initialize the balance with the loan amount
      const accountNumber = `${Math.floor(100000 + Math.random() * 900000)}`;
      const initialBalance = 150000; // Initialize the balance for the new account

      // Create a new account object to be added
      const newAccount = {
        mapValue: {
          fields: {
            accountNumber: { stringValue: accountNumber },
            balance: { integerValue: initialBalance }, // Store the loan amount as the account balance
            status: { booleanValue: true }, // Mark account as active
          },
        },
      };
  
      // Fetch the customer document using customerId
      const customerResponse = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
      const customerData = await customerResponse.json();
  
      // Find the customer with the provided customerId
      const existingCustomerDoc = customerData.documents.find(doc => doc.fields.customerId.stringValue === customerId);
      const email=existingCustomerDoc.fields.email.stringValue;
      const name=existingCustomerDoc.fields.name.stringValue;

      sendApprovalEmail(email,name);

      if (existingCustomerDoc) {
        // Customer found, retrieve their existing accounts array
        const existingAccounts = existingCustomerDoc.fields.accounts.arrayValue.values || [];
        existingAccounts.push(newAccount); // Add the new account to the array
  
        const customerDocumentId = existingCustomerDoc.name.split('/').pop();
  
        // Update the customer document with the new account
        const updatedCustomerData = {
          fields: {
            ...existingCustomerDoc.fields, // Retain all the existing fields
            accounts: { arrayValue: { values: existingAccounts } }, // Update accounts with the new one
          },
        };
  
        // Patch the updated customer data with the new account
        await fetch(`${FIRESTORE_API_BASE_URL}customer/${customerDocumentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedCustomerData),
        });
  
        console.log('Loan account successfully added to the customer.');
      } else {
        setErrorMessage('Customer not found');
        setSnackbarOpen(true);
        return;
      }
  
      // After successfully creating the new account, delete the loan request
      const loanId = documentToApprove.name.split('/').pop();
      await fetch(`${FIRESTORE_API_BASE_URL}loan/${loanId}`, { method: 'DELETE' });
  
      fetchLoanRequests(); // Refresh loan requests after approval
      console.log('Loan request successfully approved and deleted.');
  
    } catch (error) {
      console.error('Error approving loan request:', error);
      setErrorMessage('Failed to approve the loan request.');
      setSnackbarOpen(true);
    }
  };
  
  const handleLoanDeny = async (customerId) => {
    try {
      const response = await fetch(`${FIRESTORE_API_BASE_URL}loan`);
      const data = await response.json();
      const documentToDelete = data.documents.find(doc => doc.fields.customerId.stringValue === customerId);

      if (documentToDelete) {
        const id = documentToDelete.name.split('/').pop();
        await fetch(`${FIRESTORE_API_BASE_URL}loan/${id}`, { method: 'DELETE' });
        fetchLoanRequests();
      } else {
        console.error('Document not found for customer Id :', customerId);
        setErrorMessage('No loan request found with the specified account number.');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error denying loan request:', error);
      setErrorMessage('Failed to deny the loan request.');
      setSnackbarOpen(true);
    }
  };

  const addAuthenticatedEmail = async (email, password) => {
    try {
      const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=AIzaSyBTLE43jymOpplKD66P4KzDJ9AppjnvxF4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      });

      const data = await response.json();
      console.log('Authenticated email added:', data);
    } catch (error) {
      console.error('Error adding authenticated email:', error);
    }
  };

  const handleNextPage = () => {
    if ((currentPage + 1) * itemsPerPage < requests.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleShowRequests = () => {
    setShowRequests(true);
    setShowLoanRequests(false);
    setCurrentPage(0);
  };

  const handleShowLoanRequests = () => {
    setShowLoanRequests(true);
    setShowRequests(false);
    setCurrentPage(0);
  };
  const handleShowTransactionLimit = () => {
    setShowTransactionLimit(true);
    setShowRequests(false);
    setShowLoanRequests(false);
  };  
  const handleSetTransactionLimit = async () => {
    try {
        const email1 = "balajisvr18@gamil.com";

        const IFSC_CODE="balaji5503";
        const admin_id=123;
      const updatedData = {
        fields: {
          transaction_limit: { integerValue: parseInt(transactionLimit) },
          IFSC_CODE:{stringValue:IFSC_CODE},
          admin_id:{integerValue:admin_id},
          email:{stringValue:email1}


        },
      };

      await fetch(`${FIRESTORE_API_BASE_URL}admin/${transactionDocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      fetchTransactionLimit(); // Refresh the transaction limit after update
      setSnackbarOpen(true);
      setErrorMessage('Transaction limit updated successfully!');
    } catch (error) {
      console.error('Error updating transaction limit:', error);
      setErrorMessage('Failed to update transaction limit.');
      setSnackbarOpen(true);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px' }}>
        <Button variant="contained" onClick={handleShowRequests}>Show Account Creation Requests</Button>
        <Button variant="contained" onClick={handleShowLoanRequests}>Show Loan Requests</Button>
        <Button variant="contained" onClick={handleShowTransactionLimit}>Edit Transaction Limit</Button>
      </div>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Box sx={{ maxWidth: '800px', width: '100%' }}>
        {/* Requests */}
        {showRequests && (
          <Box sx={{ textAlign: 'center' }}>
            {requests.length === 0 ? (
              <Typography variant="h6" align="center">No requests available.</Typography>
            ) : (
              requests
                .slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
                .map((request, index) => (
                  <Card key={index} sx={{ marginBottom: '20px', boxShadow: 3 }}>
                    <CardContent>
                      <Typography>Email: {request.fields.email.stringValue}</Typography>
                      <Typography>Name: {request.fields.name.stringValue}</Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleApprove(request.fields.email.stringValue, request.fields)}
                        sx={{ marginTop: '10px' }}
                      >
                        Approve
                      </Button>
                    </CardContent>
                  </Card>
                ))
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <Button onClick={handlePreviousPage} disabled={currentPage === 0} variant="contained">
                Previous
              </Button>
              <Button
                onClick={handleNextPage}
                disabled={(currentPage + 1) * itemsPerPage >= requests.length}
                variant="contained"
              >
                Next
              </Button>
            </Box>
          </Box>
        )}

        {/* Loan Requests */}
        {showLoanRequests && (
          <Box sx={{ textAlign: 'center', marginTop: '20px' }}>
            {loanRequests.length === 0 ? (
              <Typography variant="h6" align="center">No loan requests available.</Typography>
            ) : (
              loanRequests.map((loan, index) => (
                <Card key={index} sx={{ marginBottom: '20px', boxShadow: 3 }}>
                  <CardContent>
                    <Typography>Customer Id: {loan.fields.customerId.stringValue}</Typography>
                    <Typography>Loan Amount: {loan.fields.loanAmount.integerValue}</Typography>
                    <Typography>Purpose: {loan.fields.loanPurpose.stringValue}</Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleLoanApprove(loan.fields.customerId.stringValue, loan.fields.loanAmount.doubleValue)}
                      sx={{ marginTop: '10px' }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => handleLoanDeny(loan.fields.customerId.stringValue)}
                      sx={{ marginTop: '10px', marginLeft: '10px' }}
                    >
                      Deny
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        )}

        {/* Transaction Limit */}
        {showTransactionLimit && (
          <Box sx={{ textAlign: 'center', marginTop: '20px' }}>
            <Typography variant="h6">Set Transaction Limit</Typography>
            <TextField
              label="Transaction Limit"
              variant="outlined"
              value={transactionLimit}
              onChange={(e) => setTransactionLimit(e.target.value)}
              type="number"
              inputProps={{ min: '0' }}
              sx={{ marginTop: '20px', width: '100%' }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleSetTransactionLimit}
              sx={{ marginTop: '20px' }}
            >
              Set
            </Button>
          </Box>
        )}

        {/* Snackbar for error messages */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          message={errorMessage}
        />
      </Box>
    </Box>
    </div>
  );
};

export default AdminPage;
