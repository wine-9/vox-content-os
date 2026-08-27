'use client';

import { usePathname } from 'next/navigation';

const primary = [
  { href: '/', label: '工作台', icon: '⌂' },
  { href: '/topics', label: '选题', icon: '▧' },
  { href: '/content', label: '内容', icon: '▣' },
  { href: '/publish', label: '发布', icon: '↥' }
];

const advanced = [
  { href: '/learning', label: '学习中心' },
  { href: '/growth', label: '增长飞轮' }
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, icon, pathname, compact = false }: { href: string; label: string; icon?: string; pathname: string; compact?: boolean }) {
  const active = isActive(pathname, href);
  return <a className={`side-link ${active ? 'is-active' : ''} ${compact ? 'side-link-compact' : ''}`.trim()} href={href} aria-current={active ? 'page' : undefined}>
    {icon && <span className="side-link-icon" aria-hidden="true">{icon}</span>}
    <span>{label}</span>
  </a>;
}

export function Nav() {
  const pathname = usePathname() || '/';
  return <>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Sinote 工作台"><span>Sinote</span><small>Content Workspace</small></a>
      <nav className="top-nav" aria-label="主导航">
        {primary.map(item => <a key={item.href} className={isActive(pathname, item.href) ? 'is-active' : ''} href={item.href}>{item.label}</a>)}
      </nav>
      <div className="topbar-right"><a className="button-link secondary" href="/#advanced-system">更多 / 高级功能</a></div>
    </header>
    <div className="mobile-nav" aria-label="移动端主导航">
      {primary.map(item => <NavLink key={item.href} {...item} pathname={pathname} />)}
    </div>
  </>;
}

export function SideNav() {
  const pathname = usePathname() || '/';
  return <aside className="side-nav" aria-label="工作区导航">
    <a className="new-project-link" href="/topics"><span aria-hidden="true">＋</span> 新建内容</a>
    <div className="side-nav-group">
      <div className="side-nav-label">WORKSPACE</div>
      {primary.map(item => <NavLink key={item.href} {...item} pathname={pathname} />)}
    </div>
    <details className="side-nav-group side-nav-secondary">
      <summary className="side-nav-label">更多 / 高级功能</summary>
      {advanced.map(item => <NavLink key={item.href} {...item} pathname={pathname} compact />)}
    </details>
    <div className="side-nav-footer">
      <span className="side-nav-note">Sage &amp; Serif Humanist</span>
      <span className="side-nav-note">VOX Content OS</span>
    </div>
  </aside>;
}
