const { pool } = require('./db');

const PROJECT_STATUSES = ['Planlagt', 'Pågår', 'Forsinket', 'Fullført'];
const CASE_STATUSES = ['Åpen', 'Under arbeid', 'Løst'];

async function listProjects() {
  const { rows } = await pool.query(
    `SELECT p.*, count(c.id)::int AS case_count
     FROM projects p
     LEFT JOIN cases c ON c.project_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  );
  return rows;
}

async function getProject(id) {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0];
}

async function createProject(data) {
  const { rows } = await pool.query(
    `INSERT INTO projects (name, customer, status, responsible, start_date, end_date, challenges)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.name,
      data.customer,
      data.status,
      data.responsible,
      data.start_date || null,
      data.end_date || null,
      data.challenges || '',
    ]
  );
  return rows[0];
}

async function updateProject(id, data) {
  const { rows } = await pool.query(
    `UPDATE projects
     SET name = $1, customer = $2, status = $3, responsible = $4,
         start_date = $5, end_date = $6, challenges = $7
     WHERE id = $8
     RETURNING *`,
    [
      data.name,
      data.customer,
      data.status,
      data.responsible,
      data.start_date || null,
      data.end_date || null,
      data.challenges || '',
      id,
    ]
  );
  return rows[0];
}

async function deleteProject(id) {
  await pool.query('DELETE FROM projects WHERE id = $1', [id]);
}

async function listCases(projectId) {
  const { rows } = await pool.query(
    'SELECT * FROM cases WHERE project_id = $1 ORDER BY created_at DESC',
    [projectId]
  );
  return rows;
}

async function createCase(projectId, data) {
  const { rows } = await pool.query(
    `INSERT INTO cases (project_id, title, description, status, case_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectId, data.title, data.description || '', data.status || 'Åpen', data.case_date || null]
  );
  return rows[0];
}

async function deleteCase(projectId, caseId) {
  await pool.query('DELETE FROM cases WHERE id = $1 AND project_id = $2', [caseId, projectId]);
}

module.exports = {
  PROJECT_STATUSES,
  CASE_STATUSES,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listCases,
  createCase,
  deleteCase,
};
