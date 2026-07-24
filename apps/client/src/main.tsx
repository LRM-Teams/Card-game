import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { useGameStore } from './store/gameStore';
import { audio } from './lib/audio';
import './styles.css';
import './narrative-lobby.css';
import './narrative-game.css';
import './narrative-invite.css';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // 建立 Socket.IO 连接并订阅服务端事件（幂等）
    useGameStore.getState().init();
    audio.installUiHooks();
  }, []);
  return <RouterProvider router={router} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
