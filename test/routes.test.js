const request = require('supertest');

jest.mock('../src/repo', () => ({
  PROJECT_STATUSES: ['Planlagt', 'Pågår', 'Forsinket', 'Fullført'],
  CASE_STATUSES: ['Åpen', 'Under arbeid', 'Løst'],
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  listCases: jest.fn(),
  createCase: jest.fn(),
  deleteCase: jest.fn(),
}));

const repo = require('../src/repo');
const createApp = require('../src/app');

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /', () => {
  it('renders the project list', async () => {
    repo.listProjects.mockResolvedValueOnce([
      { id: 1, name: 'Alpha', customer: 'Acme', status: 'Pågår', responsible: 'Kari', case_count: 2 },
    ]);

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Alpha');
    expect(res.text).toContain('Acme');
  });
});

describe('GET /projects/new', () => {
  it('renders the creation form', async () => {
    const res = await request(app).get('/projects/new');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Nytt prosjekt');
  });
});

describe('POST /projects', () => {
  it('creates a project and redirects to its detail page', async () => {
    repo.createProject.mockResolvedValueOnce({ id: 42 });

    const res = await request(app)
      .post('/projects')
      .type('form')
      .send({ name: 'Beta', customer: 'Contoso', status: 'Planlagt', responsible: 'Ola' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/projects/42');
    expect(repo.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Beta', customer: 'Contoso', responsible: 'Ola' })
    );
  });
});

describe('GET /projects/:id', () => {
  it('renders project detail with linked cases', async () => {
    repo.getProject.mockResolvedValueOnce({
      id: 1,
      name: 'Alpha',
      customer: 'Acme',
      status: 'Pågår',
      responsible: 'Kari',
      challenges: 'Leverandørforsinkelse',
    });
    repo.listCases.mockResolvedValueOnce([
      { id: 5, title: 'Sak A', status: 'Åpen', description: '' },
    ]);

    const res = await request(app).get('/projects/1');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Alpha');
    expect(res.text).toContain('Leverandørforsinkelse');
    expect(res.text).toContain('Sak A');
  });

  it('returns 404 when the project does not exist', async () => {
    repo.getProject.mockResolvedValueOnce(undefined);

    const res = await request(app).get('/projects/999');

    expect(res.status).toBe(404);
  });
});

describe('POST /projects/:id/cases', () => {
  it('creates a case and redirects back to the project', async () => {
    repo.createCase.mockResolvedValueOnce({ id: 8 });

    const res = await request(app)
      .post('/projects/1/cases')
      .type('form')
      .send({ title: 'Ny sak', status: 'Åpen' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/projects/1');
    expect(repo.createCase).toHaveBeenCalledWith('1', expect.objectContaining({ title: 'Ny sak' }));
  });
});

describe('POST /projects/:id/delete', () => {
  it('deletes the project and redirects home', async () => {
    repo.deleteProject.mockResolvedValueOnce();

    const res = await request(app).post('/projects/1/delete');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(repo.deleteProject).toHaveBeenCalledWith('1');
  });
});
