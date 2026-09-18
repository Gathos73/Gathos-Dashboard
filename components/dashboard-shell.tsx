"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  AnalyticsIcon,
  BookIcon,
  CardIcon,
  ChevronRightIcon,
  CloseIcon,
  KeyIcon,
  MenuIcon,
  PlaygroundIcon,
  SearchIcon,
  SparklesIcon,
  SupportIcon,
  UserIcon,
  VoiceIcon,
  type IconProps,
} from "@/components/icons";
import type { DashboardUser, Plan } from "@/lib/types";
import { RouteNavigationFeedback } from "@/components/route-navigation-feedback";

type NavigationItem = {
  description: string;
  href: string;
  icon: ComponentType<IconProps>;
  label: string;
};

const NAVIGATION: NavigationItem[] = [
  {
    description: "Requests and service activity",
    href: "/",
    icon: AnalyticsIcon,
    label: "Usage analytics",
  },
  { 
    description: "Status, retries, and downloads", 
    href: "/generations", 
    icon: SparklesIcon, 
    label: "Generations" 
  },
  {
    description: "Create and manage credentials",
    href: "/api-keys",
    icon: KeyIcon,
    label: "API keys",
  },
  {
    description: "Try image, voice, and video APIs",
    href: "/playground",
    icon: PlaygroundIcon,
    label: "Playground",
  },
  {
    description: "Plan and billing",
    href: "/subscription",
    icon: CardIcon,
    label: "Subscription",
  },
  {
    description: "Preset and custom voices",
    href: "/voices",
    icon: VoiceIcon,
    label: "Voices",
  },
  {
    description: "Guides, API reference, and skills",
    href: "/resources",
    icon: BookIcon,
    label: "Documentation & skills",
  },
];

const PROFILE_ITEM: NavigationItem = {
  description: "Personal details and session controls",
  href: "/profile",
  icon: UserIcon,
  label: "Profile",
};

export const PRIORITY_SUPPORT_ITEM: NavigationItem = {
  description: "Enterprise ticket history and assistance",
  href: "/priority-support",
  icon: SupportIcon,
  label: "Priority support",
};

const SEARCH_ITEMS = [...NAVIGATION, PROFILE_ITEM];

const PAGE_TITLES = new Map([
  ["/", "Usage analytics"],
  ["/api-keys", "API keys"],
  ["/playground", "Playground"],
  ["/generations", "Generations"],
  ["/subscription", "Subscription"],
  ["/voices", "Voices"],
  ["/resources", "Documentation & skills"],
  ["/profile", "Profile"],
  ["/priority-support", "Priority support"],
]);

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function planLabel(plan: Plan): string {
  if (plan === "pro_plus") return "Creator";
  if (plan === "pro") return "Pro";
  if (plan === "trial") return "Trial";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "G";
}

function subscribeToMobileViewport(callback: () => void): () => void {
  const mediaQuery = window.matchMedia("(max-width: 1040px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function mobileViewportSnapshot(): boolean {
  return window.matchMedia("(max-width: 1040px)").matches;
}

function serverViewportSnapshot(): boolean {
  return false;
}

export function DashboardShell({ children, user }: { children: ReactNode; demo: boolean; user: DashboardUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mobileViewport = useSyncExternalStore(
    subscribeToMobileViewport,
    mobileViewportSnapshot,
    serverViewportSnapshot,
  );
  const drawerWasOpen = useRef(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const sidebarCloseButton = useRef<HTMLButtonElement>(null);


  useEffect(() => {
    if (!mobileViewport) return;
    if (menuOpen) {
      drawerWasOpen.current = true;
      sidebarCloseButton.current?.focus();
    } else if (drawerWasOpen.current) {
      drawerWasOpen.current = false;
      menuButton.current?.focus();
    }
  }, [menuOpen, mobileViewport]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      } else if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInput.current?.focus();
      } else if (event.key === "Escape") {
        setMenuOpen(false);
        setQuery("");
        searchInput.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const title = PAGE_TITLES.get(pathname) ?? "Dashboard";
  const normalizedQuery = query.trim().toLowerCase();
  const hasPrioritySupport = Boolean(user.priority_support || user.plan_details?.priority_support);
  const accountNav = hasPrioritySupport
    ? [...NAVIGATION.slice(3),PRIORITY_SUPPORT_ITEM]
    : NAVIGATION.slice(3);
  const searchCandidates = hasPrioritySupport
    ? [...NAVIGATION, PRIORITY_SUPPORT_ITEM, PROFILE_ITEM]
    : SEARCH_ITEMS;
  const matches = normalizedQuery
    ? searchCandidates.filter((item) =>
        `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery),
      )
    : [];

  function openMatch(item: NavigationItem) {
    setQuery("");
    setMenuOpen(false);
    router.prefetch(item.href);
    router.push(item.href);
  }

  return (
    <RouteNavigationFeedback className={`dashboard-layout${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#dashboard-main">
        Skip to main content
      </a>
      {menuOpen ? (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          tabIndex={-1}
          type="button"
        />
      ) : null}

      <aside
        aria-hidden={mobileViewport && !menuOpen ? true : undefined}
        className={`dashboard-sidebar ${menuOpen ? "is-open" : ""}`}
        id="dashboard-navigation"
        inert={mobileViewport && !menuOpen ? true : undefined}
      >
        <div className="sidebar-brand-row">
          <Link aria-label="Gathos dashboard home" className="sidebar-brand" href="/" onClick={() => setMenuOpen(false)}>
            <span aria-hidden="true" className="brand-mark">G</span>
            <span className="brand-copy sidebar-brand-copy">
              <strong className="brand-wordmark">Gathos</strong>
              {/* <small>Developer dashboard</small> */}
            </span>
          </Link>
          <button
            aria-label="Close navigation"
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            ref={sidebarCloseButton}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <nav aria-label="Dashboard navigation" className="sidebar-nav">
          <p className="sidebar-section-label">Workspace</p>
          {NAVIGATION.slice(0, 3).map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`sidebar-link ${active ? "is-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
                title={item.description}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <p className="sidebar-section-label sidebar-section-label--spaced">Account</p>
          {accountNav.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`sidebar-link ${active ? "is-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
                title={item.description}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link
            aria-current={pathname.startsWith("/profile") ? "page" : undefined}
            className={`sidebar-profile ${pathname.startsWith("/profile") ? "is-active" : ""}`}
            href="/profile"
            onClick={() => setMenuOpen(false)}
          >
            <span className="user-avatar">{initials(user.name)}</span>
            <span className="user-copy">
              <strong>{user.name}</strong>
              <small>{planLabel(user.plan)} plan</small>
            </span>
            <ChevronRightIcon className="profile-chevron" />
          </Link>
        </div>
      </aside>

      <div
        aria-hidden={mobileViewport && menuOpen ? true : undefined}
        className="dashboard-workspace"
        inert={mobileViewport && menuOpen ? true : undefined}
      >
        <header className="dashboard-topbar">
          <div className="topbar-title-group">
            <button
              aria-controls="dashboard-navigation"
              aria-expanded={menuOpen}
              aria-label="Open navigation"
              className="icon-button mobile-menu-button"
              onClick={() => setMenuOpen(true)}
              ref={menuButton}
              type="button"
            >
              <MenuIcon />
            </button>
            <button
              aria-controls="dashboard-navigation"
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              className="icon-button desktop-sidebar-toggle"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              type="button"
            >
              <ChevronRightIcon />
            </button>
            <nav aria-label="Breadcrumb" className="topbar-breadcrumbs">
              <Link href="/">Dashboard</Link>
              <ChevronRightIcon />
              <strong>{title}</strong>
            </nav>
          </div>
          <div className="topbar-actions">
            <span className="plan-badge">{planLabel(user.plan)}</span>
            <div className="dashboard-search-wrap">
              <form
                className="dashboard-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (matches[0]) openMatch(matches[0]);
                }}
                role="search"
              >
                <SearchIcon />
                <label className="sr-only" htmlFor="dashboard-global-search">
                  Search dashboard sections
                </label>
                <input
                  aria-controls={query.trim() ? "dashboard-search-results" : undefined}
                  autoComplete="off"
                  id="dashboard-global-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search workspace…"
                  ref={searchInput}
                  value={query}
                />
                <kbd>⌘ K</kbd>
              </form>
              {query.trim() ? (
                <div
                  aria-label="Search results"
                  className="dashboard-search-results"
                  id="dashboard-search-results"
                >
                  {matches.length ? (
                    matches.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          className="dashboard-search-result"
                          data-navigation-href={item.href}
                          data-navigation-label={item.label}
                          key={item.href}
                          onClick={() => openMatch(item)}
                          type="button"
                        >
                          <span className="dashboard-search-result-icon"><Icon /></span>
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="dashboard-search-empty">No workspace sections match “{query.trim()}”.</p>
                  )}
                </div>
              ) : null}
            </div>
            <Link aria-label="Documentation & skills" className="topbar-docs-link" href="/resources">
              <BookIcon />
              <span>Docs</span>
            </Link>
            <Link aria-label="Open profile" className="topbar-avatar" href="/profile">
              <UserIcon />
            </Link>
          </div>
        </header>
        <main className="dashboard-main" id="dashboard-main" tabIndex={-1}>{children}</main>
      </div>
    </RouteNavigationFeedback>
  );
}
