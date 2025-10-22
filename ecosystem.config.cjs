module.exports = {
  apps: [
    {
      name: "policy-pulse",
      script: "server.js",
      env: {
        PORT: process.env.PORT || 3000
      }
    }
  ]
};
