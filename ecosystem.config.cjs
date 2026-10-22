module.exports = {
  apps: [
    {
      name: 'hun-chatbot-server',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
