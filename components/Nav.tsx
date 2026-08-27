'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ApiBalanceBadge from './ApiBalanceBadge';
import ModelSwitcher from './ModelSwitcher';

const primary = [
  { href: '/', label: '工作台', icon: '⌂' },
  { href: '/topics', label: '选题', icon: '▧' },
  { href: '/editor', label: '继续写作', icon: '≡' },
  { href: '/publish', label: '发布', icon: '↥' },
  { href: '/content', label: '归档', icon: '▣' }
];

const operations = [
  { href: '/ingest', label: '已有成品' },
  { href: '/quick-publish', label: '一键发布台' },
  { href: '/learning', label: '学习中心' },
  { href: '/growth', label: '增长飞轮' },
  { href: '/history', label: '发布历史' }
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
  const [dryRun, setDryRun] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/health', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(health => {
        if (mounted && typeof health?.dry_run_only === 'boolean') setDryRun(health.dry_run_only);
      })
      .catch(() => {
        // Keep the mode badge hidden when the status endpoint is unavailable.
      });
    return () => { mounted = false; };
  }, []);

  return <>
    <header className="topbar">
      <a className="brand" href="/" aria-label="Sinote 工作台"><span>Sinote</span><small>Content Workspace</small></a>
      <nav className="top-nav" aria-label="主导航">
        <a className={isActive(pathname, '/') ? 'is-active' : ''} href="/">工作台</a>
        <a className={isActive(pathname, '/topics') ? 'is-active' : ''} href="/topics">选题</a>
        <a className={isActive(pathname, '/content') ? 'is-active' : ''} href="/content">归档</a>
        <a className={isActive(pathname, '/publish') || isActive(pathname, '/release') ? 'is-active' : ''} href="/publish">发布</a>
      </nav>
      <div className="topbar-right">
        <div className="top-search" aria-label="搜索提示"><span aria-hidden="true">⌕</span><span>查找项目或发布内容…</span></div>
        <ModelSwitcher />
        <ApiBalanceBadge />
        {dryRun !== null && <span className="mode-badge">{dryRun ? 'DRY RUN' : 'LIVE'}</span>}
        <span className="profile-mark" aria-hidden="true">V</span>
      </div>
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
    <div className="side-nav-group side-nav-secondary">
      <div className="side-nav-label">OPERATIONS</div>
      {operations.map(item => <NavLink key={item.href} {...item} pathname={pathname} compact />)}
    </div>
    <div className="side-nav-footer">
      <span className="side-nav-note">Sage &amp; Serif Humanist</span>
      <span className="side-nav-note">VOX Content OS</span>
    </div>
  </aside>;
}
