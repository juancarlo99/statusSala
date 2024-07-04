const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { WebSocketServer } = require('ws'); // Adicionar WebSocketServer
const app = express();
const port = 3000;

// Configurar middleware CORS
app.use(cors());

// Configurar middleware para interpretar JSON
app.use(express.json());

// Conectar ao banco de dados SQLite
const db = new sqlite3.Database(':memory:');

// Criar tabela para armazenar status da reunião
db.serialize(() => {
  db.run("CREATE TABLE meeting_status (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT)");
  db.run("INSERT INTO meeting_status (status) VALUES ('OFF')");
});

// Endpoint para obter o status da reunião
app.get('/status', (req, res) => {
  db.get("SELECT status FROM meeting_status WHERE id = 1", (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ status: row.status });
  });
});

// Configurar WebSocket Server
const wss = new WebSocketServer({ noServer: true });
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
  });
});

// Endpoint para atualizar o status da reunião
app.post('/status', (req, res) => {
  const newStatus = req.body.status;
  if (newStatus !== 'ON' && newStatus !== 'OFF') {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  db.run("UPDATE meeting_status SET status = ? WHERE id = 1", newStatus, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Notificar todos os clientes WebSocket sobre a mudança de status
    clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ status: newStatus }));
      }
    });

    res.json({ status: newStatus });
  });
});

// Iniciar servidor HTTP e WebSocket
const server = app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
