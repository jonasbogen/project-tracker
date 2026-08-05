const mockQuery = jest.fn();

jest.mock('../src/db', () => ({
  pool: { query: (...args) => mockQuery(...args) },
}));

const repo = require('../src/repo');

beforeEach(() => {
  mockQuery.mockReset();
});

describe('listProjects', () => {
  it('runs a join query and returns rows', async () => {
    const rows = [{ id: 1, name: 'Alpha', case_count: 2 }];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await repo.listProjects();

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM projects p'));
    expect(result).toEqual(rows);
  });
});

describe('getProject', () => {
  it('queries by id and returns the first row', async () => {
    const row = { id: 5, name: 'Beta' };
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    const result = await repo.getProject(5);

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM projects WHERE id = $1',
      [5]
    );
    expect(result).toEqual(row);
  });

  it('returns undefined when no project matches', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await repo.getProject(999);

    expect(result).toBeUndefined();
  });
});

describe('createProject', () => {
  it('inserts with defaults for optional fields', async () => {
    const inserted = { id: 1, name: 'Gamma' };
    mockQuery.mockResolvedValueOnce({ rows: [inserted] });

    const result = await repo.createProject({
      name: 'Gamma',
      customer: 'Acme',
      status: 'Planlagt',
      responsible: 'Kari',
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO projects'),
      ['Gamma', 'Acme', 'Planlagt', 'Kari', null, null, '']
    );
    expect(result).toEqual(inserted);
  });
});

describe('updateProject', () => {
  it('updates the row for the given id', async () => {
    const updated = { id: 3, name: 'Delta' };
    mockQuery.mockResolvedValueOnce({ rows: [updated] });

    const result = await repo.updateProject(3, {
      name: 'Delta',
      customer: 'Acme',
      status: 'Pågår',
      responsible: 'Ola',
      start_date: '2026-01-01',
      end_date: '2026-06-01',
      challenges: 'Ressursmangel',
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE projects'),
      ['Delta', 'Acme', 'Pågår', 'Ola', '2026-01-01', '2026-06-01', 'Ressursmangel', 3]
    );
    expect(result).toEqual(updated);
  });
});

describe('deleteProject', () => {
  it('deletes by id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await repo.deleteProject(7);

    expect(mockQuery).toHaveBeenCalledWith('DELETE FROM projects WHERE id = $1', [7]);
  });
});

describe('cases', () => {
  it('lists cases for a project', async () => {
    const rows = [{ id: 1, title: 'Sak 1' }];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await repo.listCases(4);

    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM cases WHERE project_id = $1 ORDER BY created_at DESC',
      [4]
    );
    expect(result).toEqual(rows);
  });

  it('creates a case with default status', async () => {
    const created = { id: 9, title: 'Sak 2' };
    mockQuery.mockResolvedValueOnce({ rows: [created] });

    const result = await repo.createCase(4, { title: 'Sak 2' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO cases'),
      [4, 'Sak 2', '', 'Åpen', null]
    );
    expect(result).toEqual(created);
  });

  it('deletes a case scoped to its project', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await repo.deleteCase(4, 9);

    expect(mockQuery).toHaveBeenCalledWith(
      'DELETE FROM cases WHERE id = $1 AND project_id = $2',
      [9, 4]
    );
  });
});
