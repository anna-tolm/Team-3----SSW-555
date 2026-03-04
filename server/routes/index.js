import userRoutes from './users.js';
import goalRoutes from './goals.js';

const constructorMethod = (app) => {
  app.get('/', (req, res) => {
    res.json({ ok: true, service: 'health-coach-api', routes: ['/users', '/goals'] });
  });

  app.use('/users', userRoutes);
  app.use('/goals', goalRoutes);

  // Catch-all for 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Route Not found' });
  });
};

export default constructorMethod;