import express from 'express';
import { Server } from 'http';
import { ModelContext, ModelContextServer } from '@modelcontextprotocol/sdk';
import { exec } from 'child_process';
import path from 'path';

const app = express();
app.use(express.json());

// Initialize ModelContext server (HTTP transport example)
const mcServer = new ModelContextServer({
  transport: {
    type: 'http', // could be 'sse' as well
    port: 3000,
  },
});

// Register a simple model (placeholder)
const model = new ModelContext({
  name: 'ThingsBearIntegration',
});
mcServer.registerModel(model);

// Helper to run AppleScript commands
function runAppleScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`osascript -e "${script.replace(/"/g, '\\"')}"`, (error, stdout, stderr) => {
      if (error) reject(stderr || error.message);
      else resolve(stdout.trim());
    });
  });
}

// Things read - direct SQLite query (example endpoint)
app.get('/things/projects', async (req, res) => {
  const dbPath = path.join(process.env.HOME || '', 'Library/Group Containers/JL3T382279.com.culturedcode.ThingsMac/Things Database.thingsdatabase/main.sqlite');
  const sql = 'SELECT * FROM ZPROJECT'; // adjust to actual schema
  try {
    const result = await runAppleScript(`do shell script "sqlite3 '${dbPath}' '${sql}'"`);
    res.json({ data: result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Things write - create task via URL scheme
app.post('/things/add', async (req, res) => {
  const { title, project } = req.body;
  const url = `things:///add?title=${encodeURIComponent(title)}${project ? '&list=' + encodeURIComponent(project) : ''}`;
  try {
    await runAppleScript(`open location "${url}"`);
    res.json({ status: 'task created' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Bear read - simple SQLite query example
app.get('/bear/notes', async (req, res) => {
  const dbPath = path.join(process.env.HOME || '', 'Library/Group Containers/net.shinyfrog.bear/Application Data/database.sqlite');
  const sql = 'SELECT ZTITLE, ZTEXT FROM ZNOTE';
  try {
    const result = await runAppleScript(`do shell script "sqlite3 '${dbPath}' '${sql}'"`);
    res.json({ data: result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Bear write - create note via X‑Callback URL
app.post('/bear/create', async (req, res) => {
  const { title, text } = req.body;
  const url = `bear://x-callback-url/create?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`;
  try {
    await runAppleScript(`open location "${url}"`);
    res.json({ status: 'note created' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Start Express server and ModelContext server
const httpServer: Server = app.listen(8080, () => {
  console.log('Express server listening on port 8080');
  mcServer.start();
});

process.on('SIGINT', () => {
  httpServer.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
