'use client';

import { useEffect, useState, useRef } from 'react';

interface MousePosition {
  x: number;
  y: number;
}

// No specific RemoteCursorData interface needed if server directly sends {x, y, senderId}
// interface RemoteCursorData extends MousePosition {
//   id: string; 
// }

export default function HomePage() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [ownMousePosition, setOwnMousePosition] = useState<MousePosition>({ x: 0, y: 0 });
  const [remoteCursors, setRemoteCursors] = useState<Record<string, MousePosition>>({});
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [ownClientId, setOwnClientId] = useState<number | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 5;
  // const clientIdRef = useRef<string | null>(null); // Not strictly needed if server assigns senderId to all messages
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentPosition = useRef<MousePosition>({ x: 0, y: 0 });
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Throttle function to limit mouse position updates
  const throttleSend = (position: MousePosition) => {
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        
        // Only send if position has changed by at least 5 pixels
        const dx = Math.abs(position.x - lastSentPosition.current.x);
        const dy = Math.abs(position.y - lastSentPosition.current.y);
        
        if (dx > 5 || dy > 5) {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const data = JSON.stringify(position);
            wsRef.current.send(data);
            console.log('Sent mouse position:', position, 'My client ID:', ownClientId);
            lastSentPosition.current = position;
          }
        }
      }, 50); // Send at most every 50ms (20 updates per second)
    }
  };

  useEffect(() => {
    // Use a relative path for WebSocket to connect to the same origin as the page
    // This will connect to the WebSocket server at the same host but on port 8080
    const serverUrl = window.location.hostname === 'localhost' 
      ? 'ws://localhost:8080' 
      : `ws://${window.location.hostname}:8080`;
    
    let reconnectTimer: NodeJS.Timeout | null = null;
    
    const connectWebSocket = () => {
      // Don't try to reconnect more than MAX_RECONNECT_ATTEMPTS times
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log(`Maximum reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, stopping reconnection.`);
        return;
      }
      
      // Clear any existing reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      
      console.log(`Attempting to connect to WebSocket server... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
      const newWs = new WebSocket(serverUrl);
      wsRef.current = newWs;
      
      newWs.onopen = () => {
        console.log('Connected to WebSocket server');
        setSocket(newWs);
        setReconnectAttempts(0); // Reset reconnect attempts on successful connection
      };
      
      newWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          console.log('Received message:', data);

          if (data.type === 'welcome' && data.clientId) {
            console.log(`Received welcome message with ID: ${data.clientId}`);
            setOwnClientId(data.clientId);
          }
          else if (data.senderId && typeof data.x === 'number' && typeof data.y === 'number') {
            // The server adds senderId, so we use that directly to identify remote cursors
            console.log(`Updating cursor for user ${data.senderId}: x=${data.x}, y=${data.y}`);
            
            setRemoteCursors(prevCursors => {
              console.log('Previous remote cursors:', prevCursors);
              const newCursors = {
                ...prevCursors,
                [data.senderId.toString()]: { x: data.x, y: data.y } // Ensure senderId is a string for keys
              };
              console.log('New remote cursors:', newCursors);
              return newCursors;
            });
            
            // Verify after state update
            setTimeout(() => {
              console.log('Current remote cursors after update:', remoteCursors);
            }, 100);
          } else if (data.type === 'user_disconnected' && data.userId) {
            console.log('User disconnected:', data.userId);
            setRemoteCursors(prevCursors => {
              const newCursors = { ...prevCursors };
              delete newCursors[data.userId.toString()]; // Ensure userId is a string for keys
              return newCursors;
            });
          }
        } catch (error) {
          console.error('Failed to parse message from server:', error);
        }
      };

      newWs.onclose = () => {
        console.log('Disconnected from WebSocket server');
        setSocket(null);
        // Clear remote cursors when disconnected
        setRemoteCursors({});
        
        // Only attempt to reconnect if we haven't reached max attempts
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          console.log(`Will attempt to reconnect in 3 seconds... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
          // Increase backoff time with each attempt (3s, 6s, 9s, etc.)
          const backoffTime = 3000 * (reconnectAttempts + 1);
          reconnectTimer = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, backoffTime);
        }
      };

      newWs.onerror = (error) => {
        console.error('WebSocket error:', error);
        // The onclose handler will be called after this and handle reconnection
      };
    };
    
    // Initial connection
    connectWebSocket();
    
    const handleMouseMove = (event: MouseEvent) => {
      const { clientX, clientY } = event;
      setOwnMousePosition({ x: clientX, y: clientY });
      
      // Use throttling instead of sending every position
      throttleSend({ x: clientX, y: clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [reconnectAttempts]); // Add reconnectAttempts to dependency array

  // Generate a pseudo-random color based on a string ID
  const getColorForId = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return "#" + "00000".substring(0, 6 - color.length) + color;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden bg-gray-900 text-white">
      <div className="absolute top-4 left-4 p-3 bg-gray-800 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-teal-400">Live Mouse Sharer</h1>
        <p className={`text-xs mt-1 ${socket ? 'text-green-400' : 'text-red-400'}`}>
          {socket ? 'Connected' : 'Disconnected'}
        </p>
        <p className="text-xs mt-1 text-gray-400">Your Mouse: X: {ownMousePosition.x}, Y: {ownMousePosition.y}</p>
        <p className="text-xs mt-1 text-gray-400">Remote Cursors: {Object.keys(remoteCursors).length}</p>
        {Object.keys(remoteCursors).length > 0 && (
          <div className="text-xs mt-1 text-gray-400">
            IDs: {Object.keys(remoteCursors).map(id => id.slice(-4)).join(', ')}
          </div>
        )}
      </div>

      {/* Debug panel */}
      <div className="absolute top-4 right-4 p-3 bg-gray-800 bg-opacity-80 rounded-lg shadow-xl max-w-xs overflow-auto max-h-60">
        <h3 className="text-sm font-bold text-yellow-400">Debug Info</h3>
        <div className="text-xs text-white">
          <p>Your ID: {ownClientId ? `${ownClientId} (${ownClientId.toString().slice(-6)})` : 'Not assigned yet'}</p>
          <div className="mt-2">
            <p className="font-semibold">Remote Cursors:</p>
            {Object.entries(remoteCursors).map(([id, pos]) => (
              <div key={`debug-${id}`} className="ml-2">
                <p>User-{id.slice(-6)}: X:{pos.x.toFixed(0)}, Y:{pos.y.toFixed(0)}</p>
              </div>
            ))}
            {Object.keys(remoteCursors).length === 0 && (
              <p className="italic">No remote cursors</p>
            )}
          </div>
        </div>
      </div>

      {Object.entries(remoteCursors).map(([id, pos]) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            left: pos.x,
            top: pos.y,
            width: '16px',  // Slightly larger
            height: '16px', // Slightly larger
            backgroundColor: getColorForId(id),
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 100,    // Higher z-index to ensure visibility
            opacity: 0.9,   // More visible
            boxShadow: '0 0 8px rgba(255,255,255,0.8)', // More prominent glow
          }}
          title={`User ${id.slice(-6)}`}
        >
          {/* Display a small label next to the cursor */}
          <span style={{ 
            fontSize: '10px', 
            color: 'white', 
            position: 'absolute', 
            top: '-18px', 
            left: '0px', 
            backgroundColor: 'rgba(0,0,0,0.7)', 
            padding: '1px 3px', 
            borderRadius: '3px',
            whiteSpace: 'nowrap'
          }}>
            User-{id.slice(-4)}
          </span>
        </div>
      ))}

      <div className="fixed bottom-4 right-4 p-3 bg-gray-800 text-gray-300 rounded-lg shadow-xl text-sm">
        <p>Remote Users Online: {Object.keys(remoteCursors).length}</p>
      </div>

      {/* Instructions or welcome message */}
      {!socket && (
        <div className="text-center p-10 bg-gray-800 rounded-lg shadow-xl">
          <p className="text-xl mb-2 text-yellow-400">Connecting to server...</p>
          <p className="text-sm text-gray-400">Ensure the WSS server is running on port 8080.</p>
        </div>
      )}

      {socket && Object.keys(remoteCursors).length === 0 && (
         <div className="text-center p-10 bg-gray-800 rounded-lg shadow-xl">
          <p className="text-xl mb-2 text-blue-400">Connected! Waiting for others...</p>
          <p className="text-sm text-gray-400">Move your mouse to share its position.</p>
        </div>
      )}
    </main>
  );
}
