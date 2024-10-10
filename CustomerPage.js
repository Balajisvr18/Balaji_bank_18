import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const FIRESTORE_API_BASE_URL = 'https://firestore.googleapis.com/v1/projects/modern-bank-cb66c/databases/(default)/documents/';

const CustomerPage = () => {
    const navigate = useNavigate();

    const email = sessionStorage.getItem('email');
    const [profileData, setProfileData] = useState(null);
    const [balance, setBalance] = useState(null);
    const [formFields, setFormFields] = useState({ name: '', email: '', mobile: '', loanAmount: '', loanPurpose: '' });
    const [currentView, setCurrentView] = useState('');

    // Load profile data on page load
    useEffect(() => {
        loadProfileData();

    }, []);

    const loadProfileData = async () => {
        try {
            const response = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
            const data = await response.json();
    
            // Find the document with the matching email
            const documentToLoad = data.documents.find(doc => doc.fields.email.stringValue === email);
    
            if (documentToLoad) {
                // Extract the accounts array from the document
                const accountsArray = documentToLoad.fields.accounts.arrayValue.values.map(account => ({
                    accountNumber: account.mapValue.fields.accountNumber.stringValue,
                    balance: account.mapValue.fields.balance.integerValue
                }));
    
                // Set the profile data with all accounts
                setProfileData({
                    customerId: documentToLoad.fields.customerId.stringValue,
                    name: documentToLoad.fields.name.stringValue,
                    email: documentToLoad.fields.email.stringValue,
                    mobile: documentToLoad.fields.mobile.stringValue,
                    accounts: accountsArray
                });
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
        }
    };
    
    const handleBalanceClick = () => {
        clearBody();

        if (profileData && profileData.accounts) {
            const totalBalance = profileData.accounts.reduce((acc, account) => acc + account.balance, 0);
            setBalance(totalBalance);
        }

        setCurrentView('balance');
    };

    const handleProfileClick = () => {
        clearBody();
        console.log(profileData);

        setCurrentView('profile');
    };

    const handleUpdateProfileClick = () => {
        clearBody();

        if (profileData) {
            setFormFields({
                name: profileData.name,
                email: profileData.email,
                mobile: profileData.mobile,
            });
        }

        setCurrentView('updateProfile');
    };

    const handleLoanRequestClick = () => {
        clearBody();
        setCurrentView('loanRequest');
    };

    const handleSendMoneyClick = () => {
        clearBody();
        navigate('/sendmoney');
    };

    const handleSubmitProfileUpdate = async () => {
        try {
            const response = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
            const data = await response.json();
    
            const documentToUpdate = data.documents.find(doc => doc.fields.email.stringValue === email);
    
            if (documentToUpdate) {
                const id = documentToUpdate.name.split('/').pop();
    
                // Retain other fields while updating only name, email, and mobile
                const retainedFields = {
                    accounts: documentToUpdate.fields.accounts,  // Retain accounts array
                    customerId: documentToUpdate.fields.customerId,  // Retain customerId
                    pan: documentToUpdate.fields.pan,  // Retain PAN
                    aadhaar: documentToUpdate.fields.aadhaar,  // Retain Aadhaar
                    status: documentToUpdate.fields.status,  // Retain status
                    password: documentToUpdate.fields.password  // Retain password
                };
    
                const updatedProfileData = {
                    fields: {
                        ...retainedFields,  // Keep the retained fields
                        name: { stringValue: formFields.name },
                        email: { stringValue: formFields.email },
                        mobile: { stringValue: formFields.mobile },
                    }
                };
    
                const updateMaskFields = Object.keys(updatedProfileData.fields).join(',');
    
                await fetch(`${FIRESTORE_API_BASE_URL}customer/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedProfileData)
                });
    
                // Update local profile data with formFields values
                setProfileData({ ...profileData, ...formFields });
                setCurrentView('');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
        }
    };
    
    const deactivateAccount = async (accountNumber) => {
        try {
            const response = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
            const data = await response.json();
    
            // Find the document with the matching email
            const documentToUpdate = data.documents.find(doc => doc.fields.email.stringValue === email);
    
            if (documentToUpdate) {
                const id = documentToUpdate.name.split('/').pop();
                const accounts = documentToUpdate.fields.accounts.arrayValue.values;
    
                // Check if the accountNumber exists in the accounts array
                const accountIndex = accounts.findIndex(account => 
                    account.mapValue.fields.accountNumber.stringValue === accountNumber
                );
    
                if (accountIndex !== -1) {
                    // Update the status of the specified account
                    accounts[accountIndex].mapValue.fields.status = { booleanValue: false };
    
                    // Prepare the updated customer data
                    const updatedCustomerData = {
                        fields: {
                            ...documentToUpdate.fields,
                            accounts: {
                                arrayValue: {
                                    values: accounts // Update accounts with modified status
                                }
                            }
                        }
                    };
    
                    await fetch(`${FIRESTORE_API_BASE_URL}customer/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedCustomerData)
                    });
    
                    setCurrentView(''); // Clear the view after updating
                } else {
                    console.error('Account number not found:', accountNumber);
                }
            }
        } catch (error) {
            console.error('Error deactivating account:', error);
        }
    };
    

    const handleLoanRequestSubmit = async () => {
        try {
            const loanData = {
                fields: {
                    loanAmount: { integerValue: parseInt(formFields.loanAmount, 10) },
                    loanPurpose: { stringValue: formFields.loanPurpose },
                    customerId: { stringValue: profileData.customerId },
                }
            };

            await fetch(`${FIRESTORE_API_BASE_URL}loan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loanData)
            });

            setFormFields({ loanAmount: '', loanPurpose: '' });
        } catch (error) {
            console.error('Error submitting loan request:', error);
        }
    };

    const clearBody = () => {
        setCurrentView('');
    };

    return (
        <div>
            {/* Header with buttons */}
            <Box
                component="header"
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '10px 0',
                    gap: 2,
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '60px',
                    backgroundColor: '#f5f5f5',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                }}
            >
                <Button variant="contained" onClick={handleBalanceClick}>Balance</Button>
                <Button variant="contained" onClick={handleProfileClick}>Profile</Button>
                <Button variant="contained" onClick={handleUpdateProfileClick}>Update Profile</Button>
                <Button variant="contained" onClick={handleLoanRequestClick}>Loan Request</Button>
                <Button variant="contained" onClick={handleSendMoneyClick}>Send Money</Button>
            </Box>
    
            {/* Body content based on button clicked */}
            <Box sx={{ marginTop: '80px', padding: '20px', display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
                {currentView === 'balance' && profileData && (
                    <Card sx={{ padding: '20px', maxWidth: '500px', boxShadow: 3, backgroundColor: '#e3f2fd', marginBottom: '20px' }}>
                        <CardContent>
                            <Typography variant="h4" align="center" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                                Your Accounts and Balances
                            </Typography>
                            {profileData.accounts.map((account, index) => (
                                <Box key={index} sx={{ marginTop: '20px' }}>
                                    <Typography variant="h6" align="center" sx={{ color: '#424242' }}>
                                        Account Number: {account.accountNumber}
                                    </Typography>
                                    <Typography variant="h5" align="center" sx={{ marginTop: '10px', color: '#424242' }}>
                                        Balance: ${account.balance}
                                    </Typography>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                )}
    
                {currentView === 'profile' && profileData && (
                    <Card sx={{ padding: '20px', maxWidth: '500px', boxShadow: 3, backgroundColor: '#ffe0b2', marginBottom: '20px' }}>
                        <CardContent>
                            <Typography variant="h4" align="center" sx={{ color: '#ef6c00', fontWeight: 'bold' }}>
                                Profile Information
                            </Typography>
                            <Typography variant="body1" sx={{ margin: '10px 0' }}>
                                <strong>Name:</strong> {profileData.name}
                            </Typography>
                            <Typography variant="body1" sx={{ margin: '10px 0' }}>
                                <strong>Email:</strong> {profileData.email}
                            </Typography>
                            <Typography variant="body1" sx={{ margin: '10px 0' }}>
                                <strong>Mobile:</strong> {profileData.mobile}
                            </Typography>
                            <Typography variant="body1" sx={{ margin: '10px 0' }}>
                                <strong>Customer ID:</strong> {profileData.customerId}
                            </Typography>
                            {profileData.accounts.map((account, index) => (
                                <Box key={index} sx={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
                                    <Typography variant="h6" align="center" sx={{ color: '#6d4c41' }}>
                                        Account Number: {account.accountNumber}
                                    </Typography>
                                    <Typography variant="h6" align="center" sx={{ color: '#6d4c41', marginTop: '10px' }}>
                                        Balance: ${account.balance}
                                    </Typography>
                                    <Box display="flex" justifyContent="center" mt={2}>
                                        <Button variant="contained" color="error" onClick={() => deactivateAccount(account.accountNumber)}>
                                            Deactivate Account
                                        </Button>
                                    </Box>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                )}
    
                {currentView === 'updateProfile' && (
                    <Card sx={{ padding: '20px', maxWidth: '500px', boxShadow: 3, backgroundColor: '#e3f2fd', marginBottom: '20px' }}>
                        <CardContent>
                            <Typography variant="h4" align="center" sx={{ color: '#1976d2', fontWeight: 'bold' }}>Update Profile</Typography>
                            <form>
                                <label style={{ display: 'block', marginBottom: '10px' }}>
                                    Name:
                                    <input
                                        type="text"
                                        value={formFields.name}
                                        onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
                                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                    />
                                </label>
                                <label style={{ display: 'block', marginBottom: '10px' }}>
                                    Email:
                                    <input
                                        type="email"
                                        value={formFields.email}
                                        onChange={(e) => setFormFields({ ...formFields, email: e.target.value })}
                                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                    />
                                </label>
                                <label style={{ display: 'block', marginBottom: '10px' }}>
                                    Mobile:
                                    <input
                                        type="text"
                                        value={formFields.mobile}
                                        onChange={(e) => setFormFields({ ...formFields, mobile: e.target.value })}
                                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                    />
                                </label>
                                <button type="button" onClick={handleSubmitProfileUpdate} style={{ marginTop: '10px' }}>
                                    Submit
                                </button>
                            </form>
                        </CardContent>
                    </Card>
                )}
    
                {currentView === 'loanRequest' && (
                    <Card sx={{ padding: '20px', maxWidth: '500px', boxShadow: 3, backgroundColor: '#ffe0b2', marginBottom: '20px' }}>
                        <CardContent>
                            <Typography variant="h4" align="center" sx={{ color: '#ef6c00', fontWeight: 'bold' }}>Loan Request</Typography>
                            <form>
                                <label style={{ display: 'block', marginBottom: '10px' }}>
                                    Loan Amount:
                                    <input
                                        type="number"
                                        value={formFields.loanAmount}
                                        onChange={(e) => setFormFields({ ...formFields, loanAmount: e.target.value })}
                                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                    />
                                </label>
                                <label style={{ display: 'block', marginBottom: '10px' }}>
                                    Loan Purpose:
                                    <input
                                        type="text"
                                        value={formFields.loanPurpose}
                                        onChange={(e) => setFormFields({ ...formFields, loanPurpose: e.target.value })}
                                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                                    />
                                </label>
                                <button type="button" onClick={handleLoanRequestSubmit} style={{ marginTop: '10px' }}>
                                    Request Loan
                                </button>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </Box>
        </div>
    );
    
    
};

export default CustomerPage;
