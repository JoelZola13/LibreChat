import SiteFooter from '~/components/Chat/SiteFooter';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';

export default function PrivacyPage() {
  const { isMobile, isTablet } = useResponsive();
  const { isDark, colors } = useGlassStyles();

  const accentColor = isDark ? '#FDD30B' : '#b8960a';

  const sectionStyle = {
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: isMobile ? '24px 18px' : '32px 36px',
    background: colors.cardBg,
    marginBottom: 24,
  };

  const h2 = {
    fontSize: isMobile ? 20 : 24,
    fontWeight: 700 as const,
    margin: '0 0 14px',
    color: colors.text,
    fontFamily: 'Rubik, sans-serif',
  };

  const pStyle = {
    opacity: 0.82,
    fontSize: 15,
    lineHeight: 1.7,
    margin: '0 0 14px',
    fontFamily: 'Rubik, sans-serif',
  };

  const emailLink = (
    <a href="mailto:admin@streetvoices.ca" style={{ color: accentColor, textDecoration: 'none' }}>
      admin@streetvoices.ca
    </a>
  );

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
        <h1
          style={{
            fontSize: isMobile ? 30 : isTablet ? 36 : 42,
            fontWeight: 700,
            margin: '0 0 8px',
            textAlign: 'center',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          Privacy Policy
        </h1>
        <p
          style={{
            textAlign: 'center',
            color: accentColor,
            fontSize: isMobile ? 15 : 17,
            margin: '0 0 4px',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          Your privacy is important to us.
        </p>
        <p
          style={{
            textAlign: 'center',
            opacity: 0.6,
            fontSize: 14,
            margin: '0 0 32px',
            fontFamily: 'Rubik, sans-serif',
          }}
        >
          Last updated: February 14, 2026
        </p>

        {/* 1. Automatic Collection */}
        <div style={sectionStyle}>
          <h2 style={h2}>1. Automatic Collection of Information</h2>
          <p style={pStyle}>
            When you visit our website, our servers automatically record certain information that
            your web browser sends. This data may include your device&apos;s IP address, browser type
            and version, operating system type and version, language preferences, the referring URL,
            the pages you visit on our site, the date and time of your visit, the amount of time
            spent on each page, and other statistics.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We may also use cookies, web beacons, and similar tracking technologies to collect
            information automatically as you navigate our website. Cookies are small data files
            stored on your device that help us improve our services and your experience, identify
            popular content, and analyze web traffic. You can choose to accept or decline cookies
            through your browser settings. If you decline cookies, some parts of our website may not
            function optimally.
          </p>
        </div>

        {/* 2. Personal Information */}
        <div style={sectionStyle}>
          <h2 style={h2}>2. Collection of Personal Information</h2>
          <p style={pStyle}>
            We may collect personal information that you voluntarily provide to us when you register
            on the website, fill out a contact form, subscribe to our newsletter, or otherwise
            interact with our services. This information may include your name, email address, and
            phone number.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We only collect personal information that is necessary for the purposes stated in this
            policy. You are free to refuse to provide personal information, but doing so may prevent
            you from using certain features of our website. If you are uncertain about what
            information is required, please contact us at {emailLink}.
          </p>
        </div>

        {/* 3. Privacy of Children */}
        <div style={sectionStyle}>
          <h2 style={h2}>3. Privacy of Children</h2>
          <p style={pStyle}>
            We do not knowingly collect any personal information from children under the age of 13.
            If you are under 13, please do not submit any personal information through our website.
            We encourage parents and legal guardians to monitor their children&apos;s internet usage
            and to help enforce this policy by instructing their children to never provide personal
            information through our website without permission.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            If you have reason to believe that a child under the age of 13 has provided personal
            information to us, please contact us at {emailLink} and we will take steps to delete that
            information from our systems immediately.
          </p>
        </div>

        {/* 4. Use and Processing */}
        <div style={sectionStyle}>
          <h2 style={h2}>4. Use and Processing of Collected Information</h2>
          <p style={pStyle}>
            We use the information we collect for a variety of purposes, including to operate,
            maintain, and improve our website and services; to respond to your inquiries, comments,
            and requests; to send administrative communications such as updates, security alerts, and
            support messages; to send marketing and promotional communications (where permitted by
            law); to enforce our terms and conditions and other agreements; to protect the rights,
            property, and safety of Street Voices, our users, and the public; and to comply with
            applicable legal obligations.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            The legal bases for processing your information include: your consent, where you have
            given us explicit permission; contractual necessity, where processing is required to
            fulfill our obligations under a contract with you; and legitimate interests, where
            processing is necessary for our legitimate business interests, provided those interests
            are not overridden by your rights and freedoms.
          </p>
        </div>

        {/* 5. Managing Information */}
        <div style={sectionStyle}>
          <h2 style={h2}>5. Managing Information</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            You are able to access, update, and delete certain personal information that we have
            about you. The information you can access, update, and delete may change as our services
            evolve. You may manage your personal information through your account settings, or you
            may contact us directly at {emailLink} to request access to, correction of, or deletion
            of any personal information that you have provided to us. We will respond to your request
            within a reasonable timeframe. Please note that we may need to retain certain information
            for record-keeping purposes or to complete any transactions that you began prior to
            requesting a change or deletion.
          </p>
        </div>

        {/* 6. Disclosure */}
        <div style={sectionStyle}>
          <h2 style={h2}>6. Disclosure of Information</h2>
          <p style={pStyle}>
            We may disclose your personal information to trusted third-party service providers who
            assist us in operating our website, conducting our business, or providing services to
            you, so long as those parties agree to keep this information confidential. We may also
            disclose your information when we believe release is appropriate to comply with the law,
            enforce our site policies, or protect our or others&apos; rights, property, or safety.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            In the event of a merger, acquisition, reorganization, or sale of assets, your personal
            information may be transferred as part of that transaction. We will notify you of any
            such change in ownership or control of your personal information. We will not sell, rent,
            or trade your personal information to unaffiliated third parties for their own marketing
            purposes without your explicit consent.
          </p>
        </div>

        {/* 7. Retention */}
        <div style={sectionStyle}>
          <h2 style={h2}>7. Retention of Information</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We retain your personal information only for as long as is necessary to fulfill the
            purposes for which it was collected, including to satisfy any legal, accounting, or
            reporting requirements. When personal information is no longer needed, we will securely
            delete or anonymize it. In some cases, we may retain certain information after you have
            closed your account or requested deletion, where we have an ongoing legitimate business
            need or legal obligation to do so, such as to resolve disputes, enforce our agreements,
            or comply with applicable laws and regulations.
          </p>
        </div>

        {/* 8. Data Analytics */}
        <div style={sectionStyle}>
          <h2 style={h2}>8. Data Analytics</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We may use third-party analytics tools, such as Google Analytics, to help us measure
            traffic and usage trends for our website. These tools collect information sent by your
            browser, including the pages you visit and other information that assists us in improving
            our services. The analytics data is collected through cookies and similar technologies
            and is used in aggregate form to understand overall user behavior. You can opt out of
            Google Analytics by installing the Google Analytics opt-out browser add-on, or by
            adjusting your cookie preferences in your browser settings.
          </p>
        </div>

        {/* 9. Do Not Track */}
        <div style={sectionStyle}>
          <h2 style={h2}>9. Do Not Track Signals</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Some browsers incorporate a Do Not Track (DNT) feature that signals to websites you
            visit that you do not want to have your online activity tracked. We respect Do Not Track
            signals. When we detect a Do Not Track signal from your browser, certain tracking and
            analytics features will be disabled in accordance with your preferences. Please note that
            because there is no consistent industry standard for recognizing or honoring DNT signals,
            some third-party services integrated into our site may not respond to DNT signals.
          </p>
        </div>

        {/* 10. Social Media */}
        <div style={sectionStyle}>
          <h2 style={h2}>10. Social Media Features</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Our website may include social media features such as share buttons, embedded content, or
            links to social media platforms including Facebook, Twitter, Instagram, and YouTube. These
            features may collect your IP address and set cookies to enable the feature to function
            properly. Your interactions with these features are governed by the privacy policies of
            the respective social media platforms, not by this privacy policy. We encourage you to
            review the privacy policies of any social media services you use to understand how they
            collect, use, and share your information.
          </p>
        </div>

        {/* 11. Email Marketing */}
        <div style={sectionStyle}>
          <h2 style={h2}>11. Email Marketing</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            With your consent, we may send you newsletters, promotional materials, and other
            communications related to Street Voices and our services. You may opt out of receiving
            marketing emails at any time by clicking the unsubscribe link at the bottom of any
            marketing email, or by contacting us at {emailLink}. We will process your opt-out
            request promptly. Please note that even after opting out of marketing communications, you
            may still receive transactional or administrative emails from us, such as account
            notifications and service updates. We comply with the CAN-SPAM Act and all applicable
            anti-spam legislation.
          </p>
        </div>

        {/* 12. Links to Other Resources */}
        <div style={sectionStyle}>
          <h2 style={h2}>12. Links to Other Resources</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Our website may contain links to other websites and online resources that are not owned
            or controlled by Street Voices. Please be aware that we are not responsible for the
            privacy practices of such other sites. We encourage you to be aware when you leave our
            website and to read the privacy statements of every website that collects personal
            information. This privacy policy applies only to information collected through our
            website and does not govern the practices of third parties that we do not own or control,
            or individuals that we do not employ or manage.
          </p>
        </div>

        {/* 13. Information Security */}
        <div style={sectionStyle}>
          <h2 style={h2}>13. Information Security</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We use reasonable administrative, technical, and physical security measures to protect
            your personal information from unauthorized access, alteration, disclosure, or
            destruction. Although we take reasonable steps to safeguard the personal information in
            our possession, no method of transmission over the internet or method of electronic
            storage is 100% secure. We cannot guarantee the absolute security of your data. If you
            have reason to believe that your interaction with us is no longer secure, please contact
            us immediately at {emailLink}.
          </p>
        </div>

        {/* 14. Data Breach */}
        <div style={sectionStyle}>
          <h2 style={h2}>14. Data Breach</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            In the event of a data breach that compromises the security, confidentiality, or
            integrity of your personal information, Street Voices will notify affected users and
            relevant authorities in accordance with applicable laws and regulations. We will take
            prompt action to investigate the breach, mitigate any harm, and implement measures to
            prevent future occurrences. Notification will be provided through the most expedient
            means available, including by email or by posting a notice on our website, and will
            include a description of the breach, the types of information involved, and the steps we
            are taking in response.
          </p>
        </div>

        {/* 15. Changes and Amendments */}
        <div style={sectionStyle}>
          <h2 style={h2}>15. Changes and Amendments</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We reserve the right to modify this privacy policy at any time, effective upon posting
            the updated version on our website. When we do, we will revise the &ldquo;last
            updated&rdquo; date at the top of this page. We encourage you to review this privacy
            policy periodically to stay informed about how we are protecting the personal information
            we collect. Your continued use of our website and services after any changes or revisions
            to this privacy policy constitutes your acceptance of those changes.
          </p>
        </div>

        {/* 16. Acceptance */}
        <div style={sectionStyle}>
          <h2 style={h2}>16. Acceptance of this Policy</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            By using our website, you signify your acceptance of this privacy policy. If you do not
            agree to this policy, please do not use our website. Your continued use of the website
            following the posting of changes to this policy will be deemed your acceptance of those
            changes.
          </p>
        </div>

        {/* 17. Contact Us */}
        <div style={sectionStyle}>
          <h2 style={h2}>17. Contact Us</h2>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            If you have any questions, concerns, or complaints regarding this privacy policy, the
            practices of this site, or your dealings with this site, please contact us at:{' '}
            {emailLink}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
