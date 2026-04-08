import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io('http://localhost:3001', {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Re-join judge room on reconnect if authenticated
      if (user && (user.role === 'JUDGE' || user.role === 'HEAD_JUDGE')) {
        socket.emit('join:judge', user.id);
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Join judge room when user logs in
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    if (user && (user.role === 'JUDGE' || user.role === 'HEAD_JUDGE')) {
      socket.emit('join:judge', user.id);
    }
  }, [user, connected]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
