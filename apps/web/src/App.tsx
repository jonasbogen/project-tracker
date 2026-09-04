import { NavLink, Route, Routes } from 'react-router';
import Nav from '@intility/bifrost-react/Nav';
import Badge from '@intility/bifrost-react/Badge';
import Inline from '@intility/bifrost-react/Inline';
import {
  faBuilding,
  faDiagramProject,
  faGaugeHigh,
  faTags,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import Dashboard from './pages/Dashboard';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import ProjectForm from './pages/ProjectForm';
import Team from './pages/Team';
import Board from './pages/Board';
import Customers from './pages/Customers';
import Prices from './pages/Prices';
import NotFound from './pages/NotFound';
import ChatWidget from './components/ChatWidget';

export default function App() {
  return (
    <Nav
      logo={
        <NavLink to="/" className="bf-neutral-link">
          <Nav.Logo>
            <Inline gap={8}>
              <span>Prosjektsporing</span>
              <Badge state="neutral" className="from-small">
                Internal
              </Badge>
            </Inline>
          </Nav.Logo>
        </NavLink>
      }
      side={
        <>
          <NavLink to="/" end>
            <Nav.Item icon={faGaugeHigh}>Oversikt</Nav.Item>
          </NavLink>
          <NavLink to="/projects">
            <Nav.Item icon={faDiagramProject}>Milestones</Nav.Item>
          </NavLink>
          <NavLink to="/team">
            <Nav.Item icon={faUsers}>Team</Nav.Item>
          </NavLink>
          <NavLink to="/customers">
            <Nav.Item icon={faBuilding}>Kunder</Nav.Item>
          </NavLink>
          <NavLink to="/prices">
            <Nav.Item icon={faTags}>Prisliste</Nav.Item>
          </NavLink>
        </>
      }
    >
      <div className="page">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/new" element={<ProjectForm mode="create" />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/edit" element={<ProjectForm mode="edit" />} />
          <Route path="/team" element={<Team />} />
          <Route path="/board" element={<Board />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/prices" element={<Prices />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <ChatWidget />
    </Nav>
  );
}
