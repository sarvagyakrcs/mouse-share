import express, { Request, Response } from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
// import path from 'path'; // path is not used, can be removed

const app = express();

// Add CORS headers for HTTP requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const server = http.createServer(app);

// Create WebSocketServer with simpler config - no need for verifyClient in this case
const wss = new WebSocketServer({ server });

interface Client {
    id: number;
    ws: WebSocket;
}

const clients = new Set<Client>();

wss.on('connection', (ws: WebSocket) => {
    const clientId = Date.now(); // Simple unique ID for the client
    const currentClient: Client = { id: clientId, ws };
    clients.add(currentClient);
    console.log(`Client ${clientId} connected. Total clients: ${clients.size}`);
    
    // Log all connected client IDs
    const clientIds = Array.from(clients).map(client => client.id);
    console.log(`All connected clients: ${clientIds.join(', ')}`);

    // Send a welcome message with the client's ID
    ws.send(JSON.stringify({ type: 'welcome', clientId }));

    ws.on('message', (message: WebSocket.RawData) => {
        const messageString = message.toString();
        console.log(`Received message from ${clientId}: ${messageString}`);
        try {
            const parsedMessage = JSON.parse(messageString);
            // Add sender's ID to the message so clients can identify who sent it
            const messageToSend = JSON.stringify({ ...parsedMessage, senderId: clientId });

            // Broadcast the message to all other clients
            console.log(`Broadcasting message from ${clientId} to ${clients.size - 1} other clients`);
            let sentCount = 0;
            clients.forEach(client => {
                if (client.id !== clientId && client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(messageToSend);
                    sentCount++;
                }
            });
            console.log(`Successfully sent message to ${sentCount} clients`);
        } catch (error) {
            console.error('Failed to parse message or broadcast:', error);
        }
    });

    ws.on('close', () => {
        clients.delete(currentClient);
        console.log(`Client ${clientId} disconnected. Remaining clients: ${clients.size}`);
        // Notify other clients about the disconnection if needed
        let notifiedCount = 0;
        clients.forEach(otherClient => {
            if (otherClient.ws.readyState === WebSocket.OPEN) {
                otherClient.ws.send(JSON.stringify({ type: 'user_disconnected', userId: clientId }));
                notifiedCount++;
            }
        });
        console.log(`Notified ${notifiedCount} clients about disconnection of client ${clientId}`);
    });

    ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        clients.delete(currentClient);
        console.log(`Client ${clientId} removed due to error`);
    });
});

// Simple health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.status(200).send('Server is healthy');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// Export for potential testing or extension (optional with ts-node, but good practice)
export { app, server, wss }; 