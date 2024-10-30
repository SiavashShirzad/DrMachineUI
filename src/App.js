// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Viewer from './Viewer';
import { AppBar, Toolbar, IconButton, Drawer, List, ListItem, ListItemText, Typography, Button, Dialog, DialogContent, TextField } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { createTheme, ThemeProvider } from '@mui/material/styles'; // Updated import
import { makeStyles } from '@mui/styles';

export const api = axios.create({
    baseURL: 'http://185.208.175.49:8666/api/v1/',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const setAuthToken = (token) => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `jwt ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

// Theme customization
const theme = createTheme({
    palette: {
        primary: {
            main: '#3b3f87', // Dark blue
        },
        secondary: {
            main: '#ffffff', // Purple
        },
        background: {
            default: '#2c2c54', // Dark background
        },
        text: {
            primary: '#ffffff',
        },
    },
});

const useStyles = makeStyles({
    title: {
        flexGrow: 1,
    },
    drawerList: {
        width: 250,
        backgroundColor: '#3b3f87',
        color: 'white',
        height: '100%',
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    formTitle: {
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: '10px',
    },
});

// DICOM File List Component
const DicomFileList = () => {
    const [files, setFiles] = useState([]);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await api.get('/registry/dicom-file/');
                setFiles(response.data.results);
            } catch (error) {
                console.error('Error fetching DICOM files:', error);
            }
        };
        fetchFiles();
    }, []);

    return (
        <div>
            <h2>DICOM Files</h2>
            <ul>
                {files.map((file) => (
                    <li key={file.id}>{file.id}</li>
                ))}
            </ul>
        </div>
    );
};

// Upload DICOM File Component
const DicomFileUpload = () => {
    const [file, setFile] = useState(null);

    const handleFileUpload = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('file', file);
        try {
            await api.post('/registry/dicom-file/upload/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            alert('DICOM file uploaded successfully');
        } catch (error) {
            alert('Failed to upload DICOM file');
        }
    };

    return (
        <form onSubmit={handleFileUpload}>
            <h2>Upload DICOM File</h2>
            <input type="file" onChange={(e) => setFile(e.target.files[0])} required />
            <button type="submit">Upload</button>
        </form>
    );
};

// Inference Services List Component
const InferenceServiceList = () => {
    const [services, setServices] = useState([]);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const response = await api.get('/inference/service/');
                setServices(response.data.results);
            } catch (error) {
                console.error('Error fetching inference services:', error);
            }
        };
        fetchServices();
    }, []);

    return (
        <div>
            <h2>Inference Services</h2>
            <ul>
                {services.map((service) => (
                    <li key={service.name}>{service.name}</li>
                ))}
            </ul>
        </div>
    );
};

// Run Inference Service Component
const RunInferenceService = () => {
    const [dicomFileId, setDicomFileId] = useState('');
    const [serviceName, setServiceName] = useState('');

    const handleRunService = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/inference/service/${serviceName}/run/`, { dicom_file_id: dicomFileId });
            alert('Service run successfully');
        } catch (error) {
            alert('Failed to run service');
        }
    };

    return (
        <form onSubmit={handleRunService}>
            <h2>Run Inference Service</h2>
            <input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Service Name" required />
            <input type="text" value={dicomFileId} onChange={(e) => setDicomFileId(e.target.value)} placeholder="DICOM File ID" required />
            <button type="submit">Run Service</button>
        </form>
    );
};

// Login Dialog Component
const LoginDialog = ({ open, onClose, setIsLoggedIn }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isChangePassword, setIsChangePassword] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/login/', { username, password });
            const { access } = response.data;
            localStorage.setItem('access', access);
            setAuthToken(access);
            alert('Logged in successfully');
            setIsLoggedIn(true);
            onClose();
            navigate('/dicom-files');
        } catch (error) {
            alert('Failed to log in');
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        try {
            await api.put('/auth/password/change/', { old_password: oldPassword, new_password: newPassword });
            alert('Password changed successfully');
        } catch (error) {
            alert('Failed to change password');
        }
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent className={useStyles().dialogContent}>
                <Typography variant="h5" className={useStyles().formTitle}>
                    {isChangePassword ? "Change Password" : "Login"}
                </Typography>
                {isChangePassword ? (
                    <form onSubmit={handlePasswordChange}>
                        <TextField
                            type="password"
                            label="Old Password"
                            fullWidth
                            required
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                        />
                        <TextField
                            type="password"
                            label="New Password"
                            fullWidth
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <Button type="submit" color="secondary" variant="contained">
                            Change Password
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleLogin}>
                        <TextField
                            type="text"
                            label="Username"
                            fullWidth
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <TextField
                            type="password"
                            label="Password"
                            fullWidth
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button type="submit" color="secondary" variant="contained">
                            Login
                        </Button>
                    </form>
                )}
                <Button onClick={() => setIsChangePassword(!isChangePassword)} color="primary">
                    {isChangePassword ? "Back to Login" : "Change Password"}
                </Button>
            </DialogContent>
        </Dialog>
    );
};

// Main App Component with Routing and Navigation
const App = () => {
    const classes = useStyles();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('access'));
    const [loginDialogOpen, setLoginDialogOpen] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('access');
        if (token) setAuthToken(token);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('access');
        setAuthToken(null);
        setIsLoggedIn(false);
    };

    const toggleDrawer = (open) => () => {
        setDrawerOpen(open);
    };

    return (
        <ThemeProvider theme={theme}>
            <Router>
                <AppBar position="static" color="primary">
                    <Toolbar>
                        <IconButton edge="start" color="inherit" onClick={toggleDrawer(true)}>
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="h6" className={classes.title}>
                            Dr. Machine
                        </Typography>
                        {isLoggedIn ? (
                            <Button color="inherit" onClick={handleLogout}>
                                Logout
                            </Button>
                        ) : (
                            <Button color="inherit" onClick={() => setLoginDialogOpen(true)}>
                                Login
                            </Button>
                        )}
                    </Toolbar>
                </AppBar>

                <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
                    <div className={classes.drawerList} onClick={toggleDrawer(false)}>
                        <List>
                            <ListItem button component={Link} to="/dicom-files">
                                <ListItemText primary="DICOM Files" />
                            </ListItem>
                            <ListItem button component={Link} to="/upload-dicom">
                                <ListItemText primary="Upload DICOM" />
                            </ListItem>
                            <ListItem button component={Link} to="/inference-services">
                                <ListItemText primary="Inference Services" />
                            </ListItem>
                            <ListItem button component={Link} to="/run-service">
                                <ListItemText primary="Run Service" />
                            </ListItem>
                            <ListItem button component={Link} to="/viewer">
                                <ListItemText primary="Viewer" />
                            </ListItem>
                        </List>
                    </div>
                </Drawer>

                <Routes>
                    <Route path="/dicom-files" element={<DicomFileList />} />
                    <Route path="/upload-dicom" element={<DicomFileUpload />} />
                    <Route path="/inference-services" element={<InferenceServiceList />} />
                    <Route path="/run-service" element={<RunInferenceService />} />
                    <Route path="/viewer" element={<Viewer />} />
                </Routes>

                <LoginDialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)} setIsLoggedIn={setIsLoggedIn} />
            </Router>
        </ThemeProvider>
    );
};

export default App;
