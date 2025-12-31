import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CrosswordProvider } from './context/CrosswordContext';
import { CrosswordEditor } from './pages/CrosswordEditor';
import { Login } from './pages/Login';
import { MyGrids } from './pages/MyGrids';
import './styles/crossword.css';

const App: React.FC = () => {
    return (
        <CrosswordProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<CrosswordEditor />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/my-grids" element={<MyGrids />} />
                </Routes>
            </Router>
        </CrosswordProvider>
    );
};

export default App;