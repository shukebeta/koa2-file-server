const dotenv = require('dotenv');
dotenv.config();

/**
 * Single source of truth for the database connection.
 *
 * Built entirely from the DB_* environment variables — the same env-driven model
 * the rest of the app uses via appConfig.js — so the shipped .env.* files drive
 * the connection directly.
 */
const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  dialect: process.env.DB_DIALECT || 'mysql',
};

/**
 * sequelize-cli (and src/models/index.js) resolve config as `require(...)[NODE_ENV]`.
 * Return the same env-built config for ANY environment name — set, unset, `test`,
 * or unknown — so no lookup can ever return `undefined` and throw at startup.
 */
module.exports = new Proxy(dbConfig, {
  get(target, prop) {
    return prop in target ? target[prop] : dbConfig;
  },
});
