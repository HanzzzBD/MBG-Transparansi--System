import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { LogIn, Menu, X } from 'lucide-react'
import usePublicMapPath from '../hooks/usePublicMapPath.js'
import newLogo from '../assets/NewLogo.png'

function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ')
}

function Brand({ onClick }) {
  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2 rounded-lg transition-all duration-300 ease-in-out hover:opacity-90"
      aria-label="MBG Transparency System"
      onClick={onClick}
    >
      <img className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16" src={newLogo} alt="Logo MBG" />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-lg font-black leading-tight text-[#071E49]">MBG</span>
        <span className="truncate text-xs font-bold text-[#667085]">Transparency System</span>
      </span>
    </Link>
  )
}

function getNavItems(mapPath) {
  return [
    {
      label: 'Beranda',
      to: '/',
      match: (pathname, hash) => pathname === '/' && hash !== '#laporan',
      end: true,
    },
    {
      label: 'Peta SPPG',
      to: mapPath,
      match: (pathname) => pathname === '/peta' || pathname === '/peta-publik',
    },
    {
      label: 'Statistik',
      to: '/statistik',
      match: (pathname) => pathname === '/statistik' || pathname === '/anggaran-publik',
    },
    {
      label: 'Laporan',
      to: '/#laporan',
      hash: true,
      match: (pathname, hash) => pathname === '/' && hash === '#laporan',
    },
  ]
}

function desktopLinkClass(isActive) {
  return joinClasses(
    'relative z-10 inline-flex h-11 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm tracking-normal',
    'transition-all duration-300 ease-in-out',
    'after:absolute after:bottom-1.5 after:left-1/2 after:h-1 after:w-7 after:origin-center after:-translate-x-1/2 after:scale-x-0 after:rounded-full after:bg-[#071E49]/55 after:opacity-0 after:transition-all after:duration-300 after:ease-in-out',
    'hover:bg-[#071E49]/[0.04] hover:text-[#071E49] hover:after:scale-x-100 hover:after:opacity-100',
    isActive ? 'font-semibold text-[#071E49] after:bg-transparent hover:after:opacity-0' : 'font-medium text-[#1f1f1f]',
  )
}

function mobileLinkClass(isActive) {
  return joinClasses(
    'relative rounded-lg px-4 py-3 text-[15px] tracking-normal',
    'transition-all duration-300 ease-in-out',
    'after:absolute after:bottom-2 after:left-4 after:h-1 after:w-8 after:origin-left after:scale-x-0 after:rounded-full after:bg-[#071E49] after:opacity-0 after:transition-all after:duration-300 after:ease-in-out',
    isActive
      ? 'bg-[#071E49]/[0.06] font-semibold text-[#071E49] after:scale-x-100 after:opacity-100'
      : 'font-medium text-[#1f1f1f] hover:bg-[#071E49]/[0.04] hover:text-[#071E49] hover:after:scale-x-100 hover:after:opacity-60',
  )
}

function PublicNavbar() {
  const location = useLocation()
  const mapPath = usePublicMapPath()
  const navItems = useMemo(() => getNavItems(mapPath), [mapPath])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false })
  const navRef = useRef(null)
  const itemRefs = useRef([])

  const activeIndex = navItems.findIndex((item) => item.match(location.pathname, location.hash))

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current
      const activeItem = itemRefs.current[activeIndex]

      if (!nav || !activeItem) {
        setIndicator((current) => ({ ...current, visible: false }))
        return
      }

      const navRect = nav.getBoundingClientRect()
      const itemRect = activeItem.getBoundingClientRect()
      const width = Math.max(28, itemRect.width - 34)
      const left = itemRect.left - navRect.left + (itemRect.width - width) / 2

      setIndicator({ left, width, visible: true })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)

    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeIndex, location.pathname, location.hash])

  useEffect(() => {
    if (!isDrawerOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isDrawerOpen])

  const closeDrawer = () => setIsDrawerOpen(false)

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#e6edf5] bg-white/95 shadow-[0_1px_0_rgba(7,30,73,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 w-[min(1120px,calc(100%-32px))] items-center justify-between gap-5">
          <Brand />

          <nav
            ref={navRef}
            className="relative hidden items-center gap-1 rounded-full bg-white/75 p-1 text-sm shadow-[inset_0_0_0_1px_rgba(7,30,73,0.08)] lg:flex"
            aria-label="Navigasi utama"
          >
            <span
              className="pointer-events-none absolute bottom-2 h-1 rounded-full bg-[#071E49] transition-all duration-300 ease-in-out"
              style={{
                opacity: indicator.visible ? 1 : 0,
                transform: `translateX(${indicator.left}px)`,
                width: `${indicator.width}px`,
              }}
              aria-hidden="true"
            />

            {navItems.map((item, index) => {
              const isActive = index === activeIndex
              const shouldUseRouterActive = !(item.to === '/' && location.hash)

              if (item.hash) {
                return (
                  <Link
                    key={item.label}
                    ref={(node) => {
                      itemRefs.current[index] = node
                    }}
                    to={item.to}
                    className={desktopLinkClass(isActive)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                )
              }

              return (
                <NavLink
                  key={item.label}
                  ref={(node) => {
                    itemRefs.current[index] = node
                  }}
                  to={item.to}
                  end={item.end}
                  className={({ isActive: routerActive }) => desktopLinkClass((routerActive && shouldUseRouterActive) || isActive)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden h-11 items-center gap-2 rounded-lg bg-[#071E49] px-5 text-sm font-semibold text-white shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-[#0A2759] hover:shadow-lg lg:inline-flex"
            >
              <LogIn size={17} aria-hidden="true" />
              Login
            </Link>

            <button
              className="grid h-11 w-11 place-items-center rounded-lg border border-[#d7e2ef] bg-white text-[#071E49] shadow-sm transition-all duration-300 ease-in-out hover:border-[#071E49]/35 hover:bg-[#071E49]/[0.04] lg:hidden"
              type="button"
              aria-label="Buka menu"
              onClick={() => setIsDrawerOpen(true)}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-[60] bg-[#071E49]/35 backdrop-blur-sm transition-all duration-300 ease-in-out" role="presentation" onClick={closeDrawer}>
          <aside
            className="h-full w-[min(336px,88vw)] border-r border-[#e6edf5] bg-white p-5 shadow-2xl transition-all duration-300 ease-in-out"
            aria-label="Menu mobile"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-7 flex items-center justify-between gap-3">
              <Brand onClick={closeDrawer} />
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#d7e2ef] text-[#071E49] transition-all duration-300 ease-in-out hover:bg-[#071E49]/[0.04]"
                type="button"
                aria-label="Tutup menu"
                onClick={closeDrawer}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <nav className="grid gap-2" aria-label="Navigasi mobile">
              {navItems.map((item, index) => {
                const isActive = index === activeIndex
                const shouldUseRouterActive = !(item.to === '/' && location.hash)

                if (item.hash) {
                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      className={mobileLinkClass(isActive)}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={closeDrawer}
                    >
                      {item.label}
                    </Link>
                  )
                }

                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.end}
                    className={({ isActive: routerActive }) => mobileLinkClass((routerActive && shouldUseRouterActive) || isActive)}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={closeDrawer}
                  >
                    {item.label}
                  </NavLink>
                )
              })}

              <Link
                className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#071E49] px-4 text-sm font-semibold text-white transition-all duration-300 ease-in-out hover:bg-[#0A2759]"
                to="/login"
                onClick={closeDrawer}
              >
                <LogIn size={17} aria-hidden="true" />
                Login
              </Link>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  )
}

export default PublicNavbar
