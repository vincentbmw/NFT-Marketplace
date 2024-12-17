import React from "react";
import "./App.css";
import { Layout } from "antd";
import { BrowserRouter as Router } from "react-router-dom";
import AppContent from "./AppContent";

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;