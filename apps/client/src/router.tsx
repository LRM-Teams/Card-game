import { createRouter, createRootRoute, createRoute, Outlet, Link } from '@tanstack/react-router';
import { Lobby } from './components/Lobby';
import { Room } from './components/Room';
import { GameTable } from './components/GameTable';

function RootLayout() {
  return (
    <div className="app">
      <nav className="topnav">
        <Link to="/" className="brand">♠ 斗地主</Link>
        <span className="tag">客户端 · 静态原型（mock 数据 / 未联网）</span>
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
