import userRoutes from './users.js';
import goalRoutes from './goals.js';

const constructorMethod = (app) => {
  app.use('/users', userRoutes);
  app.use('/goals', goalRoutes);

  // Catch-all for 404 (Express 5 requires a named wildcard; '*' alone is invalid)
  app.use('/{*splat}', (req, res) => {
    res.status(404).json({ error: 'Route Not found' });
  });
};

export default constructorMethod;