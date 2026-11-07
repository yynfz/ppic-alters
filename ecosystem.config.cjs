/**
 * PM2 Ecosystem Configuration — PPIC Alter-S
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart ppic-alters
 *   pm2 logs ppic-alters
 *
 * This file is used by the GitHub Actions deploy workflow and for
 * manual deployment on the server.
 */

module.exports = {
  apps: [{
    name: 'ppic-alters',
    script: 'server/index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_file: '.env',
    error_file: './logs/ppic-error.log',
    out_file: './logs/ppic-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
