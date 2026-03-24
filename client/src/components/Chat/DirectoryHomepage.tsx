import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext, isDark as checkDark } from '@librechat/client';
import Search from "lucide-react/dist/esm/icons/search";
import { getCategoryIcon, getCategoryColor } from "../streetbot/shared/ServiceSuggestions";

const CATEGORIES = ['Shelters', 'Health', 'Food', 'Programs', 'Legal', 'Employment'];

const CITIES = [
  'Toronto', 'Belleville', 'Bolton', 'Bowmanville', 'Brantford',
  'Chatham', 'Cornwall', 'Georgetown', 'Guelph', 'Kanata',
  'Kingston', 'Kitchener', 'Leamington', 'Milton', 'London',
  'Ottawa', 'Orangeville', 'Orillia', 'Oshawa', 'Peterborough',
];

interface ServiceSuggestion {
  id: number;
  name: string;
  category_names?: string[];
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  backdropFilter: 'blur(18px) saturate(140%)',
  WebkitBackdropFilter: 'blur(18px) saturate(140%)',
  borderRadius: '0 0 16px 16px',
  zIndex: 100,
  maxHeight: 320,
  overflowY: 'auto',
  paddingTop: 4,
  paddingBottom: 4,
};

const itemStyle: React.CSSProperties = {
  padding: '10px 20px',
  cursor: 'pointer',
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

export default function DirectoryHomepage() {
  const { theme } = useContext(ThemeContext);
  const dark = checkDark(theme);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const inputTextColor = dark ? '#E7EAF7' : '#000';
  const inputPlaceholderColor = '#000';
  const searchSurfaceBg = dark ? 'rgba(63, 66, 84, 0.62)' : '#fff';
  const citySurfaceBg = dark ? 'rgba(124, 129, 152, 0.5)' : '#D9D9D9';
  const searchBorderColor = dark ? 'transparent' : 'rgba(0, 0, 0, 0.14)';
  const dropdownBg = dark ? 'rgba(17, 21, 33, 0.94)' : 'rgba(255, 255, 255, 0.92)';
  const dropdownBorder = dark ? '1px solid rgba(146, 158, 208, 0.25)' : '1px solid rgba(0, 0, 0, 0.08)';
  const dropdownShadow = dark ? '0 14px 30px rgba(0, 0, 0, 0.45)' : '0 8px 24px rgba(0,0,0,0.15)';
  const dropdownTextColor = dark ? '#E6EAF8' : '#000';
  const dropdownMetaColor = dark ? '#8D97B6' : '#888';
  const itemHoverBg = dark ? 'rgba(255,255,255,0.08)' : '#f5f5f5';
  const dropdownIconFallbackColor = dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';

  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (city) params.set('city', city);
      setShowCategories(false);
      setShowCities(false);
      setShowSuggestions(false);
      navigate(`/directory?${params.toString()}`);
    },
    [query, city, navigate],
  );

  // Fetch suggestions as user types
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/sbapi/services?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.results || [];
          setSuggestions(items.map((s: Record<string, unknown>) => ({ id: s.id as number, name: s.name as string, category_names: s.category_names as string[] })));
          setShowSuggestions(true);
          setShowCategories(false);
        }
      } catch { /* ignore — includes AbortError */ }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query]);

  // Filter cities as user types
  const filteredCities = city
    ? CITIES.filter(c => c.toLowerCase().includes(city.toLowerCase()))
    : CITIES;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowCategories(false);
        setShowSuggestions(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCities(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCategory = (cat: string) => {
    setShowCategories(false);
    setShowSuggestions(false);
    navigate(`/directory?q=${encodeURIComponent(cat)}`);
  };

  const selectCity = (c: string) => {
    setCity(c);
    setShowCities(false);
  };

  const selectSuggestion = (suggestion: ServiceSuggestion) => {
    setShowSuggestions(false);
    setShowCategories(false);
    navigate(`/directory/service/${suggestion.id}`);
  };

  return (
    <div
      className="w-full max-w-3xl px-4 xl:max-w-4xl"
      style={{ fontFamily: 'Rubik, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <style>{`
        .sv-search-input::placeholder { color: ${inputPlaceholderColor}; opacity: 1; }

        /* Match streetvoices.ca: keep one pill search bar on mobile */
        @media (max-width: 639px) {
          .sv-home-searchbar {
            height: 40px !important;
            border-radius: 25px !important;
          }

          /* Prevent iOS Safari input-focus zoom on mobile */
          .sv-home-search-service .sv-search-input,
          .sv-home-search-city .sv-search-input {
            font-size: 16px !important;
          }

          .sv-home-search-service {
            padding: 0 13px 0 14px !important;
            border-radius: 25px 0 0 25px !important;
          }

          .sv-home-search-city {
            padding: 0 10px !important;
            padding-right: 75px !important;
          }

          .sv-home-search-button {
            width: 68px !important;
            min-width: 68px !important;
            padding: 0 !important;
            font-size: 13px !important;
          }
        }
      `}</style>
      <form onSubmit={handleSearch}>
        <div
          className="sv-home-searchbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: 25,
            background: citySurfaceBg,
            border: dark ? 'none' : `1px solid ${searchBorderColor}`,
            boxShadow: '0 10px 26px rgba(0,0,0,0.22)',
            overflow: 'visible',
            height: 44,
            position: 'relative',
          }}
        >
          {/* Search for service */}
          <div
            ref={searchRef}
            className="sv-home-search-service"
            style={{
              flex: 3,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              background: searchSurfaceBg,
              borderRadius: '25px 0 0 25px',
              borderRight: dark ? 'none' : `1px solid ${searchBorderColor}`,
              position: 'relative',
            }}
          >
            <input
              type="text"
              className="sv-search-input"
              placeholder="Search for service"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (!query || query.length < 2) {
                  setShowCategories(true);
                  setShowSuggestions(false);
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                color: inputTextColor,
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            {/* Categories dropdown */}
            {showCategories && !showSuggestions && (
              <div
                style={{
                  ...dropdownStyle,
                  background: dropdownBg,
                  border: dropdownBorder,
                  boxShadow: dropdownShadow,
                }}
              >
                {CATEGORIES.map((cat, i) => {
                  const CategoryIcon = getCategoryIcon(cat);
                  const categoryIconColor = getCategoryColor(cat);
                  return (
                    <div
                      key={cat}
                      onClick={() => selectCategory(cat)}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(-1)}
                      style={{
                        ...itemStyle,
                        color: dropdownTextColor,
                        background: hoveredIdx === i ? itemHoverBg : 'transparent',
                      }}
                    >
                      <CategoryIcon size={16} style={{ color: categoryIconColor, flexShrink: 0 }} />
                      {cat}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Autocomplete suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{
                  ...dropdownStyle,
                  background: dropdownBg,
                  border: dropdownBorder,
                  boxShadow: dropdownShadow,
                }}
              >
                {suggestions.map((s, i) => {
                  const category = s.category_names?.[0] || "";
                  const SuggestionIcon = category ? getCategoryIcon(category) : Search;
                  const suggestionIconColor = category
                    ? getCategoryColor(category)
                    : dropdownIconFallbackColor;
                  return (
                    <div
                      key={s.id}
                      onClick={() => selectSuggestion(s)}
                      onMouseEnter={() => setHoveredIdx(i + 100)}
                      onMouseLeave={() => setHoveredIdx(-1)}
                      style={{
                        ...itemStyle,
                        color: dropdownTextColor,
                        background: hoveredIdx === i + 100 ? itemHoverBg : 'transparent',
                      }}
                    >
                      <SuggestionIcon
                        size={16}
                        style={{
                          color: suggestionIconColor,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      {s.category_names?.[0] && (
                        <span style={{ fontSize: 11, color: dropdownMetaColor, flexShrink: 0 }}>
                          {s.category_names[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* City — grey background */}
          <div
            ref={cityRef}
            className="sv-home-search-city"
            style={{
              flex: 1,
              height: '100%',
              background: citySurfaceBg,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              paddingRight: 80,
              borderRadius: '0 25px 25px 0',
              position: 'relative',
            }}
          >
            <input
              type="text"
              className="sv-search-input"
              placeholder="City"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setShowCities(true);
              }}
              onFocus={() => setShowCities(true)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                color: inputTextColor,
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />

            {/* Cities dropdown */}
            {showCities && filteredCities.length > 0 && (
              <div
                style={{
                  ...dropdownStyle,
                  background: dropdownBg,
                  border: dropdownBorder,
                  boxShadow: dropdownShadow,
                  borderRadius: '0 0 16px 16px',
                }}
              >
                {filteredCities.map((c, i) => (
                  <div
                    key={c}
                    onClick={() => selectCity(c)}
                    onMouseEnter={() => setHoveredIdx(i + 200)}
                    onMouseLeave={() => setHoveredIdx(-1)}
                    style={{
                      ...itemStyle,
                      color: dropdownTextColor,
                      background: hoveredIdx === i + 200 ? itemHoverBg : 'transparent',
                    }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search button */}
          <button
            type="submit"
            className="sv-home-search-button"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              padding: '0 42px',
              borderRadius: 25,
              border: 'none',
              background: '#FFD600',
              color: '#000',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap',
              zIndex: 1,
            }}
          >
            Search
          </button>
        </div>
      </form>
    </div>
  );
}
