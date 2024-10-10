import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button, TextField, Snackbar, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const FIRESTORE_API_BASE_URL = 'https://firestore.googleapis.com/v1/projects/modern-bank-cb66c/databases/(default)/documents/';

const SendMoneyPage = () => {
    const email = sessionStorage.getItem('email');
    const [profileData, setProfileData] = useState(null);
    const [IFSC_CODE, setIFSC_CODE] = useState('');
    const [accountNumber, setAccountNumber] = useState(''); // Receiver's account number
    const [amountToSend, setAmountToSend] = useState('');
    const [selectedSenderAccount, setSelectedSenderAccount] = useState('');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [selfTransfer, setSelfTransfer] = useState(false); // State to toggle self-transfer mode
    const [selectedReceiverAccount, setSelectedReceiverAccount] = useState(''); // Receiver account in self-transfer

    const navigate = useNavigate();

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
                    balance: account.mapValue.fields.balance.doubleValue || account.mapValue.fields.balance.integerValue
                }));

                // Set the profile data with all accounts
                setProfileData({
                    customerId: documentToLoad.fields.customerId.stringValue,
                    name: documentToLoad.fields.name.stringValue,
                    email: documentToLoad.fields.email.stringValue,
                    mobile: documentToLoad.fields.mobile.stringValue,
                    accounts: accountsArray // Load all accounts dynamically
                });
            }
        } catch (error) {
            console.error('Error loading profile data:', error);
        }
    };
    const handleSendMoney = async () => {
        if (!IFSC_CODE || !accountNumber || !amountToSend || !selectedSenderAccount) {
            setSnackbarMessage('Please fill in all fields');
            setSnackbarOpen(true);
            return;
        }
    
        // Fetch sender document using session-stored email
        const email = sessionStorage.getItem('email');
        const response = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
        const data = await response.json();
        const senderDocument = data.documents.find(doc => doc.fields.email.stringValue === email);
    
        if (!senderDocument) {
            setSnackbarMessage('Sender not found');
            setSnackbarOpen(true);
            return;
        }
    
        const senderDocumentId = senderDocument.name.split('/').pop();
    
        // Check the transaction limit from the admin table
        const adminResponse = await fetch(`${FIRESTORE_API_BASE_URL}admin`);
        const adminData = await adminResponse.json();
        const transactionLimit = adminData.documents[0].fields.transaction_limit.integerValue;
        const senderIFSC = adminData.documents[0].fields.IFSC_CODE.stringValue;
    
        if (parseInt(amountToSend) > transactionLimit) {
            setSnackbarMessage(`Amount exceeds transaction limit of ${transactionLimit}`);
            setSnackbarOpen(true);
            return;
        }
    
        // Get sender's selected account and balance
        const senderAccount = senderDocument.fields.accounts.arrayValue.values.find(acc => acc.mapValue.fields.accountNumber.stringValue === selectedSenderAccount);
        const senderBalance = parseInt(senderAccount.mapValue.fields.balance.integerValue || senderAccount.mapValue.fields.balance.doubleValue);
    
        // Check if the amount is valid
        if (parseFloat(amountToSend) > senderBalance) {
            setSnackbarMessage('Insufficient funds');
            setSnackbarOpen(true);
            return;
        }
    
        // Update sender's balance
        const updatedSenderBalance = senderBalance - parseFloat(amountToSend);
        const updatedSenderAccounts = senderDocument.fields.accounts.arrayValue.values.map(account => {
            if (account.mapValue.fields.accountNumber.stringValue === selectedSenderAccount) {
                return {
                    mapValue: {
                        fields: {
                            ...account.mapValue.fields,
                            balance: { integerValue: parseInt(updatedSenderBalance) }
                        }
                    }
                };
            }
            return account;
        });
    
        const senderUpdateData = {
            fields: {
                ...senderDocument.fields,
                accounts: { arrayValue: { values: updatedSenderAccounts } }
            }
        };
    
        // Patch sender's data
        await fetch(`${FIRESTORE_API_BASE_URL}customer/${senderDocumentId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(senderUpdateData),
        });
    
        // Fetch receiver document using account number (assuming IFSC is validated elsewhere)
        const receiverResponse = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
        const receiverData = await receiverResponse.json();
        const receiverDocument = receiverData.documents.find(doc => 
            doc.fields.accounts.arrayValue.values.find(acc => acc.mapValue.fields.accountNumber.stringValue === accountNumber)
        );
    
       
        // Get the receiver's IFSC code
        const receiverIFSC = IFSC_CODE;
    
        // Check if the IFSC code matches for intra-bank or inter-bank transfer
        if (receiverIFSC === senderIFSC) {
            // Intra-bank transfer logic (same bank, just update the receiver's balance)
            const receiverDocumentId = receiverDocument.name.split('/').pop();
            const receiverAccount = receiverDocument.fields.accounts.arrayValue.values.find(acc => acc.mapValue.fields.accountNumber.stringValue === accountNumber);
            const receiverBalance = parseInt(receiverAccount.mapValue.fields.balance.integerValue || receiverAccount.mapValue.fields.balance.doubleValue);
    
            // Update receiver's balance
            const updatedReceiverBalance = receiverBalance + parseFloat(amountToSend);
            const updatedReceiverAccounts = receiverDocument.fields.accounts.arrayValue.values.map(account => {
                if (account.mapValue.fields.accountNumber.stringValue === accountNumber) {
                    return {
                        mapValue: {
                            fields: {
                                ...account.mapValue.fields,
                                balance: { integerValue: parseInt(updatedReceiverBalance) }
                            }
                        }
                    };
                }
                return account;
            });
    
            const receiverUpdateData = {
                fields: {
                    ...receiverDocument.fields,
                    accounts: { arrayValue: { values: updatedReceiverAccounts } }
                }
            };
    
            // Patch receiver's data (intra-bank)
            await fetch(`${FIRESTORE_API_BASE_URL}customer/${receiverDocumentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(receiverUpdateData),
            });
    
            setSnackbarMessage('Intra-bank money sent successfully!');
            setSnackbarOpen(true);
    
        } else {
            // Inter-bank transfer logic (other bank, post to external receiver's bank)
            const receiverAccountKey = accountNumber.toString();
            const receiverUrl = `https://firestore.googleapis.com/v1/projects/bank-common-db/databases/(default)/documents/common_db/${receiverIFSC}`;
    
            try {
                // Retrieve the receiver's bank document
                const receiverBankResponse = await fetch(receiverUrl);
const receiverBank = await receiverBankResponse.json();
const receiverAccounts = receiverBank.fields || {};

// Define the transaction map for this transfer
const transactionMap = {
    creditAmount: { integerValue: parseInt(amountToSend) },
    senderAccountNumber: { integerValue: parseInt(selectedSenderAccount) },
};

// Check if the account already exists in receiverAccounts
if (receiverAccountKey in receiverAccounts) {
    const accountField = receiverAccounts[receiverAccountKey];

    // Check if the 'values' array exists, if not, initialize it
    if (!accountField.arrayValue.values) {
        accountField.arrayValue.values = [];
    }

    // Push the transaction map to the 'values' array
    accountField.arrayValue.values.push({ mapValue: { fields: transactionMap } });

} else {
    // If the account does not exist, create a new array with the transaction map
    receiverAccounts[receiverAccountKey] = {
        arrayValue: {
            values: [{ mapValue: { fields: transactionMap } }]
        }
    };
}

// Prepare the updated data to patch
const updatedData = {
    fields: {
        ...receiverAccounts,
        [receiverAccountKey]: {
            arrayValue: {
                values: receiverAccounts[receiverAccountKey].arrayValue.values
            }
        }
    }
};

// Patch the receiver's updated account information (inter-bank)
await fetch(receiverUrl, {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatedData),
});

                setSnackbarMessage('Inter-bank money transfer successful!');
                setSnackbarOpen(true);
    
            } catch (error) {
                console.error("Error during money transfer:", error);
                setSnackbarMessage('Error during inter-bank transfer');
                setSnackbarOpen(true);
            }
        }
    };
    const handleReceiveMoney = async () => {
        const email = sessionStorage.getItem('email');
        
        try {
            // Fetch sender document (customer table) using the session-stored email
            const response = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
            const data = await response.json();
            const senderDocument = data.documents.find(doc => doc.fields.email.stringValue === email);
    
            if (!senderDocument) {
                console.error("Sender not found.");
                return;
            }
    
            const senderDocumentId = senderDocument.name.split('/').pop(); // Extract sender document ID
            const senderAccounts = senderDocument.fields.accounts.arrayValue.values;
    
            // Fetch the receiver data from the common bank DB based on IFSC
            const receiverUrl = `https://firestore.googleapis.com/v1/projects/bank-common-db/databases/(default)/documents/common_db/balaji5503`;
            const receiverResponse = await fetch(receiverUrl);
            const receiverBank = await receiverResponse.json();
            const receiverAccounts = receiverBank.fields || {};
    
            // Map over sender's accounts and update their balances
            const updatedSenderAccounts = senderAccounts.map(account => {
                const accountNumber = account.mapValue.fields.accountNumber.stringValue;
    
                // Check if the account exists in the receiver data
                if (receiverAccounts[accountNumber]) {
                    const transactions = receiverAccounts[accountNumber].arrayValue.values;
    
                    // Sum all credit amounts for this account
                    const totalCredit = transactions.reduce((sum, transaction) => {
                        const creditAmount = transaction.mapValue.fields.creditAmount.integerValue;
                        return sum + parseInt(creditAmount);
                    }, 0);
    
                    // Add the total credit amount to the sender's account balance
                    const currentBalance = parseInt(account.mapValue.fields.balance.integerValue || account.mapValue.fields.balance.doubleValue);
                    const updatedBalance = currentBalance + totalCredit;
    
                    // Return the updated account with the new balance
                    return {
                        mapValue: {
                            fields: {
                                ...account.mapValue.fields,
                                balance: { integerValue: updatedBalance }
                            }
                        }
                    };
                }
    
                // Return the original account if no transactions found
                return account;
            });
    
            // Prepare updated sender data (with the new balances)
            const senderUpdateData = {
                fields: {
                    ...senderDocument.fields,
                    accounts: { arrayValue: { values: updatedSenderAccounts } }
                }
            };
    
            // Patch the sender's account data in the customer table
            await fetch(`${FIRESTORE_API_BASE_URL}customer/${senderDocumentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(senderUpdateData),
            });
    
            console.log('Balances updated successfully!');
    
            // Clear transactions from the common DB
            const clearPayload = {
                fields: {
                    ...receiverBank.fields // Retain all other fields
                }
            };
    
            // Clear the transaction arrays for each account
            for (let accountNumber in senderAccounts) {
                clearPayload.fields[accountNumber] = {
                    arrayValue: {
                        values: [] // Clear the transaction array
                    }
                };
            }
    
            // Patch the receiver common DB document to clear transactions
            await fetch(receiverUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(clearPayload),
            });
    
            console.log('Transactions cleared for all accounts in the common DB.');
    
        } catch (error) {
            console.error("Error receiving money and clearing transactions:", error);
        }
    };
    
    const handleSelfTransfer = async () => {
        if (!selectedSenderAccount || !selectedReceiverAccount || !amountToSend) {
            setSnackbarMessage('Please select both accounts and enter the amount');
            setSnackbarOpen(true);
            return;
        }
    
        // Ensure sender and receiver accounts are not the same
        if (selectedSenderAccount === selectedReceiverAccount) {
            setSnackbarMessage('Sender and receiver accounts cannot be the same');
            setSnackbarOpen(true);
            return;
        }
    
        // Fetch sender document using session-stored email
        const email = sessionStorage.getItem('email');
        const response = await fetch(`${FIRESTORE_API_BASE_URL}customer`);
        const data = await response.json();
        const senderDocument = data.documents.find(doc => doc.fields.email.stringValue === email);
    
        if (!senderDocument) {
            setSnackbarMessage('Sender not found');
            setSnackbarOpen(true);
            return;
        }
    
        const senderDocumentId = senderDocument.name.split('/').pop();
    
        // Get sender's selected account balance
        const senderAccount = senderDocument.fields.accounts.arrayValue.values.find(acc => acc.mapValue.fields.accountNumber.stringValue === selectedSenderAccount);
        const senderBalance = parseInt(senderAccount.mapValue.fields.balance.integerValue || senderAccount.mapValue.fields.balance.doubleValue);
    
        // Check if amount is valid
        if (parseFloat(amountToSend) > senderBalance) {
            setSnackbarMessage('Insufficient funds');
            setSnackbarOpen(true);
            return;
        }
    
        // Update sender's balance
        const updatedSenderBalance = senderBalance - parseFloat(amountToSend);
        const updatedSenderAccounts = senderDocument.fields.accounts.arrayValue.values.map(account => {
            if (account.mapValue.fields.accountNumber.stringValue === selectedSenderAccount) {
                return {
                    mapValue: {
                        fields: {
                            ...account.mapValue.fields,
                            balance: { integerValue: parseInt(updatedSenderBalance) }
                        }
                    }
                };
            }
            return account;
        });
    
        const receiverAccount = senderDocument.fields.accounts.arrayValue.values.find(acc => acc.mapValue.fields.accountNumber.stringValue === selectedReceiverAccount);
        const receiverBalance = parseInt(receiverAccount.mapValue.fields.balance.integerValue || receiverAccount.mapValue.fields.balance.doubleValue);
    
        // Update receiver's balance
        const updatedReceiverBalance = receiverBalance + parseFloat(amountToSend);
        const updatedReceiverAccounts = updatedSenderAccounts.map(account => {
            if (account.mapValue.fields.accountNumber.stringValue === selectedReceiverAccount) {
                return {
                    mapValue: {
                        fields: {
                            ...account.mapValue.fields,
                            balance: { integerValue: parseInt(updatedReceiverBalance) }
                        }
                    }
                };
            }
            return account;
        });
    
        const updateData = {
            fields: {
                ...senderDocument.fields,
                accounts: { arrayValue: { values: updatedReceiverAccounts } }
            }
        };
    
        // Patch both sender and receiver updates in one request
        await fetch(`${FIRESTORE_API_BASE_URL}customer/${senderDocumentId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });
    
        setSnackbarMessage('Self transfer successful!');
        setSnackbarOpen(true);
    };
    

    return (
        <div>
            <Card sx={{ padding: '20px', maxWidth: '500px', margin: 'auto', marginTop: '20px', boxShadow: 3 }}>
                <CardContent>
                    <Typography variant="h5" align="center" sx={{ marginBottom: '20px' }}>
                        {selfTransfer ? 'Self Transfer' : 'Send Money'}
                    </Typography>

                    {/* Select sender's account */}
                    <TextField
                        select
                        fullWidth
                        label="Select Account"
                        variant="outlined"
                        value={selectedSenderAccount}
                        onChange={(e) => setSelectedSenderAccount(e.target.value)}
                        sx={{ marginBottom: '20px' }}
                    >
                        {profileData && profileData.accounts.map((account, index) => (
                            <MenuItem key={index} value={account.accountNumber}>
                                {account.accountNumber} - Balance: ${account.balance}
                            </MenuItem>
                        ))}
                    </TextField>

                    {/* Show different fields based on transfer mode */}
                    {selfTransfer ? (
                        <>
                            <TextField
                                select
                                fullWidth
                                label="Select Receiver Account"
                                variant="outlined"
                                value={selectedReceiverAccount}
                                onChange={(e) => setSelectedReceiverAccount(e.target.value)}
                                sx={{ marginBottom: '20px' }}
                            >
                                {profileData && profileData.accounts.map((account, index) => (
                                    <MenuItem key={index} value={account.accountNumber}>
                                        {account.accountNumber} - Balance: ${account.balance}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                fullWidth
                                label="Amount to Transfer"
                                variant="outlined"
                                type="number"
                                value={amountToSend}
                                onChange={(e) => setAmountToSend(e.target.value)}
                                sx={{ marginBottom: '20px' }}
                            />
                            <Button variant="contained" fullWidth onClick={handleSelfTransfer}>
                                Transfer Money
                            </Button>
                        </>
                    ) : (
                        <>
                            <TextField
                                fullWidth
                                label="Receiver IFSC Code"
                                variant="outlined"
                                value={IFSC_CODE}
                                onChange={(e) => setIFSC_CODE(e.target.value)}
                                sx={{ marginBottom: '20px' }}
                            />
                            <TextField
                                fullWidth
                                label="Receiver Account Number (6 digits)"
                                variant="outlined"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                sx={{ marginBottom: '20px' }}
                            />
                            <TextField
                                fullWidth
                                label="Amount to Send"
                                variant="outlined"
                                type="number"
                                value={amountToSend}
                                onChange={(e) => setAmountToSend(e.target.value)}
                                sx={{ marginBottom: '20px' }}
                            />
                            <Button variant="contained" fullWidth onClick={handleSendMoney}>
                                Send Money
                            </Button>
                            <Button variant="contained" fullWidth sx={{ marginTop: '20px' }} onClick={handleReceiveMoney}>
                                Receive Money
                            </Button>
                        </>
                    )}

                    <Button variant="outlined" fullWidth sx={{ marginTop: '20px' }} onClick={() => setSelfTransfer(!selfTransfer)}>
                        {selfTransfer ? 'Switch to Send Money' : 'Switch to Self Transfer'}
                    </Button>
                </CardContent>
            </Card>

            {/* Snackbar for success or error messages */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                message={snackbarMessage}
            />
        </div>
    );
};

export default SendMoneyPage;
