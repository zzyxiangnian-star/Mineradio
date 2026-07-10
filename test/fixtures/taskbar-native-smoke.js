const { app } = require('electron');

app.whenReady().then(() => {
  const binding = require('mineradio-taskbar-thumbnail');
  process.stdout.write(Object.keys(binding).sort().join(','));
  app.quit();
}).catch(error => {
  console.error(error && error.stack || error);
  app.exit(1);
});
