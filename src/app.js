const path = require('path');
const express = require('express');
const projectsRouter = require('./routes/projects');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: true }));

  app.use('/', projectsRouter);

  app.use((req, res) => {
    res.status(404).render('not-found');
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { message: 'Noe gikk feil. Prøv igjen senere.' });
  });

  return app;
}

module.exports = createApp;
