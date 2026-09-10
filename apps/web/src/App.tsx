import { NavLink, Route, Routes } from 'react-router';
import Nav from '@intility/bifrost-react/Nav';
import Badge from '@intility/bifrost-react/Badge';
import Inline from '@intility/bifrost-react/Inline';
import {
  faBuilding,
  faCalendarDays,
  faDiagramProject,
  faFileInvoiceDollar,
  faFileLines,
  faGaugeHigh,
  faListCheck,
  faTags,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import CalendarPage from './pages/Calendar';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import ProjectForm from './pages/ProjectForm';
import Team from './pages/Team';
import TeamMember from './pages/TeamMember';
import Board from './pages/Board';
import Customers from './pages/Customers';
import Prices from './pages/Prices';
import Offers from './pages/Offers';
import Documentation from './pages/Documentation';
import NotFound from './pages/NotFound';
import ChatWidget from './components/ChatWidget';

export default function App() {
  return (
    <Nav
      logo={
        <NavLink to="/" className="bf-neutral-link">
          <Nav.Logo logo="/logo.svg">
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
            <Nav.Item icon={faGaugeHigh}>OT Projects</Nav.Item>
          </NavLink>
          <NavLink to="/mine-oppgaver">
            <Nav.Item icon={faListCheck}>Mine oppgaver</Nav.Item>
          </NavLink>
          <NavLink to="/calendar">
            <Nav.Item icon={faCalendarDays}>Kalender</Nav.Item>
          </NavLink>
          <NavLink to="/projects">
            <Nav.Item icon={faDiagramProject}>Prosjekter</Nav.Item>
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
          <NavLink to="/offers">
            <Nav.Item icon={faFileInvoiceDollar}>Tilbud</Nav.Item>
          </NavLink>
          <NavLink to="/documentation">
            <Nav.Item icon={faFileLines}>Dokumentasjon</Nav.Item>
          </NavLink>
        </>
      }
    >
      <div className="page">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mine-oppgaver" element={<MyTasks />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/new" element={<ProjectForm mode="create" />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/edit" element={<ProjectForm mode="edit" />} />
          <Route path="/team" element={<Team />} />
          <Route path="/team/:login" element={<TeamMember />} />
          <Route path="/board" element={<Board />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/prices" element={<Prices />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <ChatWidget />
    </Nav>
  );
}
