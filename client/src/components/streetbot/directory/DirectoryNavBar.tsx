/**
 * Shared top navigation bar for directory pages.
 * Matches the streetvoices.ca/search nav layout.
 */
import { useState, useContext, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isDarkTheme, useTheme, ThemeContext } from "../shared/theme-provider";
import { isDirectory } from "~/config/appVariant";
import { useOutletContext } from "react-router-dom";
import { useActiveUser } from "../shared/useActiveUser";
import { useResponsive } from "../hooks/useResponsive";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";
import MobileMenuDrawer, {
  getMobileNavLinkStyle,
  getMobileDividerStyle,
  HamburgerButton,
} from "../shared/MobileMenuDrawer";
import AuthPopupModal from "../shared/AuthPopupModal";

type ContextType = { navVisible?: boolean };

type DirectoryNavBarProps = {
  /** Current search term (controlled) */
  searchTerm?: string;
  /** Callback when search term changes */
  onSearchChange?: (value: string) => void;
  /** Current city filter */
  cityFilter?: string;
  /** Callback when city filter changes */
  onCityChange?: (value: string) => void;
  /** Whether the viewport is mobile-sized */
  isMobile: boolean;
  /** When true, adds a semi-opaque background so text is readable over map tiles */
  mapMode?: boolean;
  /** When true, mobile nav mirrors directory-page expand/collapse search behavior */
  mobileSearchExpandable?: boolean;
};

export default function DirectoryNavBar({
  searchTerm = "",
  onSearchChange,
  cityFilter = "",
  onCityChange,
  isMobile,
  mapMode = false,
  mobileSearchExpandable = false,
}: DirectoryNavBarProps) {
  const { theme } = useTheme();
  const { setTheme } = useContext(ThemeContext);
  const dark = isDarkTheme(theme);
  const navigate = useNavigate();
  const { activeUser, resolved: sessionResolved } = useActiveUser();
  const { isLargeDesktop } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [localCity, setLocalCity] = useState(cityFilter);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const toggleTheme = useCallback(() => {
    setTheme(dark ? "light" : "dark");
  }, [dark, setTheme]);

  const showLogin = !activeUser && sessionResolved;
  const userInitial =
    activeUser?.name?.charAt(0)?.toUpperCase() ||
    activeUser?.username?.charAt(0)?.toUpperCase() ||
    "?";

  useEffect(() => {
    setAvatarLoadError(false);
  }, [activeUser?.avatar]);

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setLocalCity(cityFilter);
  }, [cityFilter]);

  useEffect(() => {
    if (!isMobile && mobileSearchOpen) {
      setMobileSearchOpen(false);
    }
  }, [isMobile, mobileSearchOpen]);

  const { navVisible } = (useOutletContext<ContextType>() ?? { navVisible: false });
  const sidebarMinimized = JSON.parse(localStorage.getItem("sidebarMinimized") ?? "true");
  const navLeft = isMobile ? 0 : isDirectory ? 0 : navVisible ? (sidebarMinimized ? 80 : 275) : 0;
  const navTextColor = dark ? "#fff" : "#1a1c24";
  const directoryLogoSrc = dark ? "/assets/streetvoices-text.svg" : "/assets/streetvoices-text-dark.svg";
  const mobileSearchPrimaryBg = dark ? "rgba(171, 176, 200, 0.82)" : "#fff";
  const mobileSearchSecondaryBg = dark ? "rgba(149, 154, 178, 0.86)" : "#D9D9D9";
  const directorySearchPrimaryBg = dark ? "rgba(63,66,84,0.62)" : "#fff";
  const directorySearchSecondaryBg = dark ? "rgba(124,129,152,0.5)" : "#D9D9D9";
  const showMobileSearchHeader = isMobile && mobileSearchExpandable && mobileSearchOpen;
  const mobileSearchBarHeight = 50;
  const mobileSearchButtonSize = 40;
  const mobileSearchButtonInset = 5;
  const mobileSearchInputPadding = 10;

  const handleSearch = () => {
    if (onSearchChange) {
      onSearchChange(localSearch);
      if (onCityChange) onCityChange(localCity);
    } else {
      // Navigate to directory with search params
      const params = new URLSearchParams();
      if (localSearch) params.set("q", localSearch);
      if (localCity) params.set("city", localCity);
      navigate(`/directory${params.toString() ? `?${params}` : ""}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <>
      <style>{`.sv-search-input::placeholder { color: #000 !important; opacity: 1; } .sv-mobile-search-input { color: #000 !important; -webkit-text-fill-color: #000 !important; } .sv-mobile-search-input::placeholder { color: #000 !important; opacity: 1; }`}</style>
      <div
      style={{
        position: "fixed",
        top: 0,
        left: isMobile ? 0 : navLeft,
        right: 0,
        zIndex: 20,
        background: mapMode
          ? (dark ? "rgba(10,10,30,0.82)" : "rgba(255,255,255,0.88)")
          : "transparent",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        padding: showMobileSearchHeader
          ? "0 15px"
          : isMobile
            ? "0 24px"
            : "0 24px",
        height: isMobile ? (mobileSearchExpandable ? 71 : 56) : 70,
        overflow: isMobile ? "hidden" : "visible",
        display: "flex",
        alignItems: "center",
        transition: "left 0.2s ease-out",
      }}
    >
      {/* Logo */}
      {!showMobileSearchHeader && (
        <Link to="/home" style={{ flexShrink: 0, marginRight: isMobile ? 10 : 24 }}>
          <img
            src={directoryLogoSrc}
            alt="Street Voices"
            style={{
              height: isMobile ? (mobileSearchExpandable ? 50 : 32) : 50,
              maxWidth: isMobile ? (mobileSearchExpandable ? 140 : 120) : 190,
            }}
          />
        </Link>
      )}

      {/* Search bar */}
      {isMobile ? (
        mobileSearchExpandable ? (
          mobileSearchOpen ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                minWidth: 0,
                marginLeft: 0,
                marginRight: 0,
                height: mobileSearchBarHeight,
                overflow: "visible",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  background: directorySearchPrimaryBg,
                  borderRadius: 30,
                  boxShadow: dark ? "none" : "0 0 10px rgba(0, 0, 0, 0.05)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flex: 3.8,
                    minWidth: 0,
                    height: "100%",
                    background: directorySearchPrimaryBg,
                    borderRadius: "30px 0 0 30px",
                    padding: `0 ${mobileSearchInputPadding}px`,
                  }}
                >
                  <input
                    type="text"
                    className="sv-search-input sv-mobile-search-input"
                    value={localSearch}
                    onChange={(e) => {
                      setLocalSearch(e.target.value);
                      onSearchChange?.(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search for service"
                    style={{
                      width: "100%",
                      minWidth: 0,
                      height: "100%",
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "#000",
                      fontSize: 16,
                      fontWeight: 400,
                      lineHeight: "50px",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1.6,
                    minWidth: 0,
                    height: "100%",
                    background: directorySearchSecondaryBg,
                    borderRadius: "0 30px 30px 0",
                    padding: `0 ${mobileSearchInputPadding}px`,
                  }}
                >
                  <input
                    type="text"
                    className="sv-search-input sv-mobile-search-input"
                    value={localCity}
                    onChange={(e) => {
                      setLocalCity(e.target.value);
                      onCityChange?.(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="City"
                    style={{
                      width: "100%",
                      minWidth: 0,
                      height: "100%",
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "#000",
                      fontSize: 16,
                      fontWeight: 600,
                      lineHeight: "50px",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  aria-label="Search"
                  style={{
                    position: "absolute",
                    top: mobileSearchButtonInset,
                    right: mobileSearchButtonInset,
                    height: mobileSearchButtonSize,
                    width: mobileSearchButtonSize,
                    borderRadius: 25,
                    border: "none",
                    background: "#FFD600",
                    color: "#000",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                >
                  <SearchIcon size={22} />
                </button>
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                aria-label="Close search"
                style={{
                  marginLeft: 14,
                  border: "none",
                  background: "none",
                  color: dark ? "#FFD600" : "#2D2D2D",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  width: 16,
                  height: 16,
                }}
              >
                <X size={16} />
              </button>
            </div>
          ) : null
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              minWidth: 0,
              marginLeft: 6,
              marginRight: 6,
              height: 36,
              overflow: "visible",
              position: "relative",
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 3,
                height: "100%",
                background: mobileSearchPrimaryBg,
                borderRadius: "30px 0 0 30px",
              }}
            >
              <input
                type="text"
                className="sv-search-input sv-mobile-search-input"
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  onSearchChange?.(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search for service"
                style={{
                  width: "100%",
                  minWidth: 0,
                  height: "100%",
                  padding: "0 0 0 12px",
                  border: "none",
                  background: "transparent",
                  color: "#000",
                  fontSize: 16,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
            {/* City input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flex: 2,
                height: "100%",
                background: mobileSearchSecondaryBg,
                borderRadius: "0 30px 30px 0",
                paddingRight: 50,
                marginRight: -50,
              }}
            >
              <input
                type="text"
                className="sv-search-input sv-mobile-search-input"
                value={localCity}
                onChange={(e) => {
                  setLocalCity(e.target.value);
                  onCityChange?.(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder="City"
                style={{
                  width: "100%",
                  height: "100%",
                  padding: "0 8px",
                  border: "none",
                  background: "transparent",
                  color: "#000",
                  fontSize: 16,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>
            {/* Search button — circular pill, overlaps city */}
            <button
              onClick={handleSearch}
              style={{
                height: "100%",
                padding: "0 16px",
                borderRadius: 30,
                border: "none",
                background: "#FFD600",
                color: "#000",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "Rubik, sans-serif",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                position: "relative",
                zIndex: 1,
              }}
            >
              Search
            </button>
          </div>
        )
      ) : (
        /* ── Desktop: original pill layout ── */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: "1 1 0%",
            maxWidth: isLargeDesktop ? 540 : 380,
            minWidth: 180,
            overflow: "visible",
            height: 40,
            position: "relative",
            marginRight: 16,
          }}
        >
          {/* Search input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 3,
              height: "100%",
              background: dark ? "rgba(63,66,84,0.62)" : "#fff",
              borderRadius: "30px 0 0 30px",
            }}
          >
            <input
              type="text"
              className="sv-search-input"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                onSearchChange?.(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search for service"
              style={{
                width: "100%",
                height: "100%",
                padding: "0 0 0 18px",
                border: "none",
                background: "transparent",
                color: "#000",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          {/* City input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 2,
              height: "100%",
              background: dark ? "rgba(124,129,152,0.5)" : "#D9D9D9",
              borderRadius: "0 30px 30px 0",
              paddingRight: 60,
              marginRight: -60,
            }}
          >
            <input
              type="text"
              className="sv-search-input"
              value={localCity}
              onChange={(e) => {
                setLocalCity(e.target.value);
                onCityChange?.(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="City"
              style={{
                width: "100%",
                height: "100%",
                padding: "0 14px",
                border: "none",
                background: "transparent",
                color: "#000",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          {/* Search button — yellow pill with text */}
          <button
            onClick={handleSearch}
            style={{
              height: "100%",
              padding: "0 24px",
              borderRadius: 30,
              border: "none",
              background: "#FFD600",
              color: "#000",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              cursor: "pointer",
              flexShrink: 0,
              position: "relative",
              zIndex: 1,
            }}
          >
            Search
          </button>
        </div>
      )}

      {/* Nav links (desktop) / Hamburger (mobile) */}
      {!isMobile ? (
        <nav style={{ display: "flex", alignItems: "center", gap: isLargeDesktop ? 16 : 8, marginLeft: "auto" }}>
          <Link to="/directory" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>Directory</Link>
          <a href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw" target="_blank" rel="noopener noreferrer" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>Programs</a>
          <Link to="/news" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>News</Link>
          <Link to="/about" style={{ color: navTextColor, fontSize: isLargeDesktop ? 15 : 13, textDecoration: "none", fontFamily: "Rubik, sans-serif", whiteSpace: "nowrap" }}>About Us</Link>
          {showLogin && (
            <button
              onClick={() => setAuthModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: isLargeDesktop ? 40 : 34,
                padding: isLargeDesktop ? "0 22px" : "0 14px",
                borderRadius: 50,
                border: "2px solid #FFD600",
                background: "transparent",
                color: navTextColor,
                fontSize: isLargeDesktop ? 15 : 13,
                fontWeight: 600,
                fontFamily: "Rubik, sans-serif",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              Login
            </button>
          )}
          <a
            href="/donate"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: isLargeDesktop ? 40 : 34,
              padding: isLargeDesktop ? "0 22px" : "0 14px",
              borderRadius: 50,
              border: "none",
              background: "#FFD600",
              color: "#000",
              fontSize: isLargeDesktop ? 15 : 13,
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "Rubik, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            Donate
          </a>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: isLargeDesktop ? 36 : 30,
              height: isLargeDesktop ? 36 : 30,
              borderRadius: "50%",
              border: "none",
              background: "none",
              color: navTextColor,
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label="Toggle theme"
          >
            {dark ? (
              <svg width={isLargeDesktop ? 18 : 16} height={isLargeDesktop ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width={isLargeDesktop ? 18 : 16} height={isLargeDesktop ? 18 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {/* Profile avatar */}
          {activeUser && (
            <Link
              to="/settings"
              aria-label="Profile"
              style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
            >
              {activeUser.avatar && !avatarLoadError ? (
                <img
                  src={activeUser.avatar}
                  alt={activeUser.name || "Profile"}
                  style={{ width: isLargeDesktop ? 32 : 28, height: isLargeDesktop ? 32 : 28, borderRadius: "50%", objectFit: "cover" }}
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <div
                  style={{
                    width: isLargeDesktop ? 32 : 28,
                    height: isLargeDesktop ? 32 : 28,
                    borderRadius: "50%",
                    background: "#7c3aed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: isLargeDesktop ? 12 : 10,
                    fontWeight: 700,
                  }}
                >
                  {userInitial}
                </div>
              )}
            </Link>
          )}
        </nav>
      ) : (
        <>
          {!mobileSearchExpandable && activeUser && (
            <Link
              to="/settings"
              aria-label="Profile"
              style={{ display: "inline-flex", alignItems: "center", marginRight: 8 }}
            >
              {activeUser.avatar && !avatarLoadError ? (
                <img
                  src={activeUser.avatar}
                  alt={activeUser.name || "Profile"}
                  style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#7c3aed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {userInitial}
                </div>
              )}
            </Link>
          )}
          {mobileSearchExpandable ? (
            !mobileSearchOpen ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexShrink: 0 }}>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setMobileSearchOpen(true);
                  }}
                  aria-label="Open search"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "none",
                    background: "none",
                    color: dark ? "#fff" : "#1a1c24",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <SearchIcon size={18} />
                </button>
                <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={dark} />
              </div>
            ) : null
          ) : (
            <HamburgerButton onClick={() => setMobileMenuOpen(true)} dark={dark} />
          )}
          <MobileMenuDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
            <Link to="/directory" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileMenuOpen(false)}>Directory</Link>
            <a href="https://airtable.com/appBQoHCfq4nfspKj/shrVEiMPGLqetHMfw" target="_blank" rel="noopener noreferrer" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileMenuOpen(false)}>Programs</a>
            <Link to="/news" style={getMobileNavLinkStyle(dark)} onClick={() => setMobileMenuOpen(false)}>News</Link>
            <Link to="/about" style={{...getMobileNavLinkStyle(dark), borderBottom: 'none'}} onClick={() => setMobileMenuOpen(false)}>About Us</Link>
            <div style={getMobileDividerStyle(dark)} />
            {showLogin && (
              <button
                style={{
                  display: "block",
                  width: "100%",
                  padding: "13px 16px",
                  color: dark ? "#E6E7F2" : "#1f2937",
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "Rubik, sans-serif",
                  textAlign: "center",
                  borderRadius: 10,
                  background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                  marginBottom: 10,
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                }}
                onClick={() => { setMobileMenuOpen(false); setAuthModalOpen(true); }}
              >
                Login
              </button>
            )}
            <a
              href="/donate"
              style={{
                display: "block",
                padding: "13px 16px",
                color: "#000",
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "Rubik, sans-serif",
                textDecoration: "none",
                textAlign: "center",
                borderRadius: 10,
                background: "#FFD600",
                letterSpacing: "0.01em",
              }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Donate
            </a>
          </MobileMenuDrawer>
        </>
      )}

      <AuthPopupModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} initialTab="login" />
      </div>
    </>
  );
}
