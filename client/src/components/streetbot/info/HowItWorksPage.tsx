import { useNavigate } from 'react-router-dom';
import SiteFooter from '~/components/Chat/SiteFooter';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';

const steps = [
  {
    num: 1,
    title: 'Search for Services in Your City',
    items: [
      'Use the search bar to find services by name or keyword',
      'Enter a city name to narrow results to your area',
      'Browse by icon categories on the homepage (Shelters, Health, Food, Legal, Employment, Programs)',
      'Browse the full directory listing to discover all available services',
    ],
  },
  {
    num: 2,
    title: 'Sign Up as a User',
    items: [
      'Create an account to access personalized features',
      'Sign up with your email, or use Google or Facebook',
      'Search and browse services, save favourite listings, and write reviews',
      'Participate in forum discussions with the community',
      'Sign up is completely free',
    ],
    cta: { label: 'Sign Up', href: '/register' },
  },
  {
    num: 3,
    title: 'User Account Features',
    items: [
      'Click your name at the top of the page to access your profile',
      'View and manage your favourited service listings',
      'See your forum discussions and contributions',
      'Track reviews you have written for services',
    ],
  },
  {
    num: 4,
    title: 'Sign Up as a Service Provider',
    items: [
      'Service organizations can claim and manage their own listings',
      'Click the "Claim" button on any listing in search results or on its profile page',
      'Your claim will be reviewed and verified by the Street Voices team',
      'Once approved, you can edit your listing details and keep information up to date',
    ],
  },
  {
    num: 5,
    title: 'Provider Account Dashboard',
    items: [
      'Access your provider profile and manage your account',
      'View and edit all your claimed service listings',
      'See your favourited listings and forum discussions',
      'Monitor reviews and engagement on your services',
    ],
  },
  {
    num: 6,
    title: 'Advanced Filter Search',
    items: [
      'Click "Search Filters" at the top of the results page',
      'Filter by City to narrow results to your area',
      'Filter by Category to find specific service types',
      'Filter by Ages Served (All, Adult, Children, Seniors, Youth)',
      'Filter by Gender Served (All, Female, Male, Non-Binary, Trans)',
    ],
  },
  {
    num: 7,
    title: 'Map View',
    items: [
      'Toggle the map view using the button in the top right corner of search results',
      'See all services plotted on an interactive map',
      'Click on map pins to see service details at a glance',
      'Zoom in and out to explore services in different areas',
    ],
  },
  {
    num: 8,
    title: 'Listing Profile Details',
    items: [
      'Service name, overview, and detailed description',
      'Address and contact information (phone, email, website)',
      'Interactive map showing the exact location',
      'User reviews and ratings from the community',
      'Tags and categories for easy identification',
      'Gallery images and media',
      'Social media links',
    ],
  },
  {
    num: 9,
    title: 'Search by Tags',
    items: [
      'Each listing displays tags relevant to the services offered',
      'Click on any tag to discover other services with the same tag',
      'Tags help you find related services and resources quickly',
    ],
  },
  {
    num: 10,
    title: 'Favourite and Share Services',
    items: [
      'Click the heart icon on any listing to save it to your favourites',
      'Access all your saved listings from your profile page',
      'Use the share button to post services on social media',
      'Help spread the word about valuable community resources',
    ],
  },
];

export default function HowItWorksPage() {
  const { isMobile, isTablet } = useResponsive();
  const { colors } = useGlassStyles();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main
        style={{
          flex: 1,
          maxWidth: 980,
          margin: '0 auto',
          width: '100%',
          padding: isMobile ? '80px 16px 40px' : isTablet ? '90px 20px 40px' : '110px 20px 40px',
          color: colors.text,
        }}
      >
        <div style={{ marginBottom: 16, textAlign: 'left' }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: '#FDD30B',
              fontSize: 15,
              fontWeight: 500,
              fontFamily: 'Rubik, sans-serif',
              cursor: 'pointer',
            }}
          >
            Back to home
          </button>
        </div>

        <h1
          style={{
            fontSize: isMobile ? 30 : isTablet ? 36 : 42,
            fontWeight: 700,
            margin: '0 0 12px',
            textAlign: 'center',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          How It Works
        </h1>
        <p
          style={{
            textAlign: 'center',
            opacity: 0.82,
            fontSize: isMobile ? 15 : 17,
            margin: '0 0 40px',
            lineHeight: 1.6,
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          Welcome to the Street Voices Directory &mdash; your guide to finding free and subsidized
          services across the Greater Toronto Area and beyond.
        </p>

        {steps.map((step) => (
          <div
            key={step.num}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: isMobile ? '24px 18px' : '32px 36px',
              background: colors.cardBg,
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#FDD30B',
                  color: '#1A1B23',
                  fontWeight: 700,
                  fontSize: 16,
                  flexShrink: 0,
                  fontFamily: 'Rubik, sans-serif',
                }}
              >
                {step.num}
              </span>
              <h2
                style={{
                  fontSize: isMobile ? 20 : 24,
                  fontWeight: 700,
                  margin: 0,
                  color: colors.text,
                  fontFamily: 'Rubik, sans-serif',
                }}
              >
                {step.title}
              </h2>
            </div>

            <ul
              style={{
                margin: 0,
                paddingLeft: 22,
                listStyleType: 'disc',
              }}
            >
              {step.items.map((item, i) => (
                <li
                  key={i}
                  style={{
                    opacity: 0.82,
                    fontSize: 15,
                    lineHeight: 1.7,
                    marginBottom: 6,
                    fontFamily: 'Rubik, sans-serif',
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>

            {step.cta && (
              <button
                onClick={() => navigate(step.cta.href)}
                style={{
                  marginTop: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '10px 28px',
                  borderRadius: 9999,
                  border: 'none',
                  background: '#FDD30B',
                  color: '#1A1B23',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Rubik, sans-serif',
                }}
              >
                {step.cta.label}
              </button>
            )}
          </div>
        ))}

      </main>
      <SiteFooter />
    </div>
  );
}
