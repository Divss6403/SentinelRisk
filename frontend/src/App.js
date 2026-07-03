import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

import Navbar from "@/components/Navbar";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import RuleManager from "@/pages/RuleManager";
import Transactions from "@/pages/Transactions";
import CheckFraud from "@/pages/CheckFraud";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/check" element={<CheckFraud />} />
        <Route path="/rules" element={<RuleManager />} />
        <Route path="/transactions" element={<Transactions />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
