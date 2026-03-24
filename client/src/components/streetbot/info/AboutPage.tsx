import SiteFooter from '~/components/Chat/SiteFooter';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';

export default function AboutPage() {
  const { isMobile, isTablet } = useResponsive();
  const { isDark, colors } = useGlassStyles();

  const accentColor = isDark ? '#FDD30B' : '#b8960a';

  const sectionStyle = {
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: isMobile ? '24px 18px' : '32px 36px',
    background: colors.cardBg,
    marginBottom: 28,
  };

  const h2 = {
    fontSize: isMobile ? 22 : 28,
    fontWeight: 700 as const,
    margin: '0 0 16px',
    color: colors.text,
    fontFamily: 'Rubik, sans-serif',
  };

  const pStyle = {
    opacity: 0.82,
    fontSize: 16,
    lineHeight: 1.7,
    margin: '0 0 14px',
    fontFamily: 'Rubik, sans-serif',
  };

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
        {/* Header */}
        <h1
          style={{
            fontSize: isMobile ? 30 : isTablet ? 36 : 42,
            fontWeight: 700,
            margin: '0 0 12px',
            textAlign: 'center',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          About Street Voices
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: accentColor,
            fontSize: isMobile ? 16 : 18,
            margin: '0 0 40px',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          Empowering marginalized voices through media, community, and connection.
        </p>

        {/* Our Story */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Story</h2>
          <p style={pStyle}>
            Street Voices was founded by Joel Zola in 2014 as a quarterly magazine created while
            experiencing homelessness in Toronto&apos;s shelter system. He felt like he didn&apos;t
            have a voice &mdash; so he created his own platform.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            While navigating homelessness, Joel published five issues of the Street Voices magazine,
            giving a platform to those whose stories are too often ignored. What began as a print
            publication has since evolved into a digital platform encompassing journalism, podcasts,
            visual content, and community resources.
          </p>
        </div>

        {/* Our Mission */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Mission</h2>
          <p style={pStyle}>
            Street Voices is a Black-led non-profit organization dedicated to empowering
            street-involved and at-risk Black youth. Through media, mentorship, and technology, we
            work to uplift communities that have been historically underserved.
          </p>
          <p style={pStyle}>
            In November 2021, we launched the Street Voices Directory &mdash; a comprehensive
            resource listing free and subsidized services across the Greater Toronto Area. The
            directory helps community members find shelters, health services, food programs, legal
            aid, employment support, and more.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We also provide media training workshops for Black youth, equipping the next generation
            with the skills to tell their own stories and amplify their voices.
          </p>
        </div>

        {/* Quote */}
        <div
          style={{
            borderLeft: `4px solid ${accentColor}`,
            padding: isMobile ? '20px 18px' : '24px 32px',
            marginBottom: 28,
            background: isDark ? 'rgba(253,211,11,0.04)' : 'rgba(253,211,11,0.06)',
            borderRadius: '0 12px 12px 0',
          }}
        >
          <p
            style={{
              fontSize: isMobile ? 18 : 22,
              fontStyle: 'italic',
              color: colors.text,
              margin: '0 0 8px',
              lineHeight: 1.6,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            &ldquo;To have a platform where people are listening&hellip; it means everything.&rdquo;
          </p>
          <span
            style={{
              color: accentColor,
              fontSize: 15,
              fontFamily: 'Rubik, sans-serif',
            }}
          >
            &mdash; Joel Zola, Founder
          </span>
        </div>

        {/* Our Goal */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Goal</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Our ultimate goal is to uplift and empower marginalized voices, irrespective of
            background. We are actively working to expand the Street Voices Directory across Canada,
            making essential services accessible to anyone who needs them.
          </p>
        </div>

        {/* Contact Us */}
        <div style={sectionStyle}>
          <h2 style={h2}>Contact Us</h2>
          <p style={pStyle}>720 Bathurst St, Toronto, ON M5R 2S4</p>
          <p style={pStyle}>
            <a href="tel:14166976626" style={{ color: accentColor, textDecoration: 'none' }}>
              1-416-697-6626
            </a>
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            <a
              href="mailto:admin@streetvoices.ca"
              style={{ color: accentColor, textDecoration: 'none' }}
            >
              admin@streetvoices.ca
            </a>
          </p>
        </div>

        {/* Our Supporters */}
        <div style={sectionStyle}>
          <h2 style={h2}>Our Supporters</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Street Voices is made possible through the generous support of our community partners and
            funders. If you are interested in supporting our mission, please reach out at{' '}
            <a
              href="mailto:admin@streetvoices.ca"
              style={{ color: accentColor, textDecoration: 'none' }}
            >
              admin@streetvoices.ca
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
