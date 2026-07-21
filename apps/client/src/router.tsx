import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  useRouterState,
} from '@tanstack/react-router';
import { Lobby } from './components/Lobby';
import { Room } from './components/Room';
import { GameTable } from './components/GameTable';
import { AudioSettings } from './components/AudioSettings';
import { useGameStore } from './store/gameStore';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3000';

function ConnBadge() {
  const status = useGameStore((s) => s.status);
  const label = status === 'connected' ? '已连接' : status === 'connecting' ? '连接中…' : '未连接';
  return <span className={`conn ${status}`}>● {label}</span>;
}

function RootLayout() {
  const isGame = useRouterState({ select: (s) => s.location.pathname.startsWith('/game') });
  return (
    <div className={`app${isGame ? ' app--game' : ''}`}>
      <nav className="topnav">
        <Link to="/" className="brand">♠ 斗地主</Link>
        <ConnBadge />
        <span className="tag">{SERVER_URL.replace(/^https?:\/\//, '')}</span>
        <AudioSettings />
      </nav>
      <main className="content">
        <Outlet />
      </main>
      <footer className="foot">
        合法判定一律以服务端为准；规则在此仅用于展示 / 提示。
      </footer>
    </div>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Lobby });
const roomRoute = createRoute({ getParentRoute: () => rootRoute, path: '/room', component: Room });
const gameRoute = createRoute({ getParentRoute: () => rootRoute, path: '/game', component: GameTable });

const routeTree = rootRoute.addChildren([indexRoute, roomRoute, gameRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
