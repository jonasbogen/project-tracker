import { NavLink, Route, Routes } from 'react-router';
import Nav from '@intility/bifrost-react/Nav';
import Badge from '@intility/bifrost-react/Badge';
import Inline from '@intility/bifrost-react/Inline';
import { faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import ProjectForm from './pages/ProjectForm';
import NotFound from './pages/NotFound';

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
        <NavLink to="/" end>
          <Nav.Item icon={faDiagramProject}>Prosjekter</Nav.Item>
        </NavLink>
      }
    >
      <div className="page">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/new" element={<ProjectForm mode="create" />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/edit" element={<ProjectForm mode="edit" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Nav>
  );
}
