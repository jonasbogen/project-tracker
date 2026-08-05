const express = require('express');
const repo = require('../repo');

const router = express.Router();

function projectFromBody(body) {
  return {
    name: (body.name || '').trim(),
    customer: (body.customer || '').trim(),
    status: body.status,
    responsible: (body.responsible || '').trim(),
    start_date: body.start_date,
    end_date: body.end_date,
    challenges: (body.challenges || '').trim(),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await repo.listProjects();
    res.render('index', { projects });
  } catch (err) {
    next(err);
  }
});

router.get('/projects/new', (req, res) => {
  res.render('project-form', {
    project: {},
    statuses: repo.PROJECT_STATUSES,
    formAction: '/projects',
    heading: 'Nytt prosjekt',
  });
});

router.post('/projects', async (req, res, next) => {
  try {
    const data = projectFromBody(req.body);
    const project = await repo.createProject(data);
    res.redirect(`/projects/${project.id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/projects/:id', async (req, res, next) => {
  try {
    const project = await repo.getProject(req.params.id);
    if (!project) {
      return res.status(404).render('not-found');
    }
    const cases = await repo.listCases(req.params.id);
    res.render('project-detail', {
      project,
      cases,
      caseStatuses: repo.CASE_STATUSES,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/projects/:id/edit', async (req, res, next) => {
  try {
    const project = await repo.getProject(req.params.id);
    if (!project) {
      return res.status(404).render('not-found');
    }
    res.render('project-form', {
      project,
      statuses: repo.PROJECT_STATUSES,
      formAction: `/projects/${project.id}/update`,
      heading: 'Rediger prosjekt',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:id/update', async (req, res, next) => {
  try {
    const data = projectFromBody(req.body);
    await repo.updateProject(req.params.id, data);
    res.redirect(`/projects/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:id/delete', async (req, res, next) => {
  try {
    await repo.deleteProject(req.params.id);
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:id/cases', async (req, res, next) => {
  try {
    await repo.createCase(req.params.id, {
      title: (req.body.title || '').trim(),
      description: (req.body.description || '').trim(),
      status: req.body.status,
      case_date: req.body.case_date,
    });
    res.redirect(`/projects/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

router.post('/projects/:id/cases/:caseId/delete', async (req, res, next) => {
  try {
    await repo.deleteCase(req.params.id, req.params.caseId);
    res.redirect(`/projects/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
