import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Inventory from "./Inventory";

import Team from "./Team";

import ActivityLog from "./ActivityLog";

import ProductForm from "./ProductForm";

import TeamMemberForm from "./TeamMemberForm";

import DemoCases from "./DemoCases";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Inventory: Inventory,
    
    Team: Team,
    
    ActivityLog: ActivityLog,
    
    ProductForm: ProductForm,
    
    TeamMemberForm: TeamMemberForm,
    
    DemoCases: DemoCases,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Inventory" element={<Inventory />} />
                
                <Route path="/Team" element={<Team />} />
                
                <Route path="/ActivityLog" element={<ActivityLog />} />
                
                <Route path="/ProductForm" element={<ProductForm />} />
                
                <Route path="/TeamMemberForm" element={<TeamMemberForm />} />
                
                <Route path="/DemoCases" element={<DemoCases />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}