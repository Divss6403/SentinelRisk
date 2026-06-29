import { NavLink } from "react-router-dom";
import { Shield } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="navbar" data-testid="navbar">
      <div className="nav-container">
        <NavLink to="/" className="logo" data-testid="logo-link">
          <span className="logo-icon"><Shield size={18} /></span>
          SentinelRisk
        </NavLink>
        <ul className="nav-links">
          <li><NavLink to="/" end data-testid="nav-home">Home</NavLink></li>
          <li><NavLink to="/dashboard" data-testid="nav-dashboard">Dashboard</NavLink></li>
          <li><NavLink to="/check" data-testid="nav-check">Check Fraud</NavLink></li>
          <li><NavLink to="/rules" data-testid="nav-rules">Rules</NavLink></li>
          <li><NavLink to="/transactions" data-testid="nav-transactions">Transactions</NavLink></li>
        </ul>
      </div>
    </nav>
  );
}
