import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AgentEditor } from './pages/AgentEditor';
import { AgentLibrary } from './pages/AgentLibrary';

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<AgentEditor />} />
        <Route path="/library" element={<AgentLibrary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
