import SiteFooter from '~/components/Chat/SiteFooter';
import { useResponsive } from '../hooks/useResponsive';
import { useGlassStyles } from '../shared/useGlassStyles';

export default function TermsPage() {
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
          Terms &amp; Conditions
        </h1>
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

        {/* Intro */}
        <div style={{ ...sectionStyle, marginBottom: 32 }}>
          <p style={pStyle}>
            These Terms and Conditions (&ldquo;Terms&rdquo;) govern your use of the Street Voices
            website located at streetvoices.ca (&ldquo;Website&rdquo;) and any related services
            provided by Street Voices (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
            By accessing or using our Website, you agree to be bound by these Terms. If you do not
            agree with any part of these Terms, you must not use our Website or services.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            These Terms apply to all visitors, users, and others who access or use the Website,
            including without limitation users who are contributors of content, information, and
            other materials or services on the Website.
          </p>
        </div>

        {/* 1. Accounts and Membership */}
        <div style={sectionStyle}>
          <h2 style={h2}>1. Accounts and Membership</h2>
          <p style={pStyle}>
            If you create an account on the Website, you are responsible for maintaining the security
            of your account credentials, including your password, and you are fully responsible for
            all activities that occur under your account. You must immediately notify Street Voices of
            any unauthorized use of your account or any other breach of security. Street Voices will
            not be liable for any loss or damage arising from your failure to comply with this
            obligation.
          </p>
          <p style={pStyle}>
            You must be at least 18 years of age to use this Website. If you are under the age of
            18, you may only use the Website with the consent and supervision of a parent or legal
            guardian who agrees to be bound by these Terms on your behalf. By using the Website, you
            represent and warrant that you meet all of the foregoing eligibility requirements.
          </p>
          <p style={pStyle}>
            You agree to provide accurate, current, and complete information during the registration
            process and to update such information to keep it accurate, current, and complete.
            Providing any false, inaccurate, misleading, or incomplete information may result in the
            immediate suspension or termination of your account.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Street Voices reserves the right to suspend, disable, or terminate your account at any
            time and for any reason, including but not limited to a violation of these Terms, at our
            sole discretion and without prior notice or liability to you.
          </p>
        </div>

        {/* 2. User Content */}
        <div style={sectionStyle}>
          <h2 style={h2}>2. User Content</h2>
          <p style={pStyle}>
            You retain ownership of any intellectual property rights that you hold in the content you
            submit, post, or display on or through the Website (&ldquo;User Content&rdquo;). By
            submitting User Content to the Website, you grant Street Voices a worldwide,
            non-exclusive, royalty-free, transferable, sub-licensable license to use, reproduce,
            distribute, prepare derivative works of, display, and perform your User Content in
            connection with the Website and Street Voices&apos; business operations, including
            without limitation for the purpose of promoting and redistributing part or all of the
            Website in any media formats and through any media channels.
          </p>
          <p style={pStyle}>
            You are solely responsible for the content you post on the Website and the legality,
            reliability, and appropriateness of that content. By posting User Content on the Website,
            you represent and warrant that you have the right and authority to do so and that such
            content does not violate the rights of any third party, including but not limited to
            intellectual property rights, privacy rights, or rights of publicity.
          </p>
          <p style={pStyle}>
            Street Voices reserves the right, but has no obligation, to monitor, review, or edit
            User Content. We may, at our sole discretion and without prior notice, remove or refuse
            to display any User Content that we reasonably believe violates these Terms, applicable
            law, or is otherwise objectionable.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Street Voices is under no obligation to regularly monitor the accuracy or reliability of
            User Content. However, we reserve the right to do so and to take any action we deem
            necessary to protect the integrity of the Website and the safety of its users.
          </p>
        </div>

        {/* 3. Backups */}
        <div style={sectionStyle}>
          <h2 style={h2}>3. Backups</h2>
          <p style={pStyle}>
            Street Voices performs regular backups of the Website and its content as part of our
            standard operational procedures. However, these backups are intended for our own
            administrative purposes, and we do not guarantee that any specific data or content will
            be recoverable at any given time.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Street Voices is not responsible for any loss, corruption, or destruction of data or
            content, regardless of the cause. You are strongly encouraged to maintain your own backup
            copies of any content or data you submit to the Website. You acknowledge and agree that
            Street Voices shall have no liability for any failure to back up data or for any loss of
            data, whether caused by system failure, human error, or otherwise.
          </p>
        </div>

        {/* 4. Links to Other Resources */}
        <div style={sectionStyle}>
          <h2 style={h2}>4. Links to Other Resources</h2>
          <p style={pStyle}>
            The Website may contain links to other websites or resources that are not owned or
            controlled by Street Voices (&ldquo;Third-Party Resources&rdquo;). These links are
            provided for your convenience and informational purposes only. Street Voices has no
            control over, and assumes no responsibility for, the content, privacy policies,
            practices, or availability of any Third-Party Resources.
          </p>
          <p style={pStyle}>
            The inclusion of any link on our Website does not imply endorsement, approval, or
            recommendation by Street Voices of the linked site or any association with its operators.
            You acknowledge and agree that Street Voices shall not be responsible or liable, directly
            or indirectly, for any damage or loss caused or alleged to be caused by or in connection
            with the use of or reliance on any content, goods, or services available on or through
            any Third-Party Resources.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We strongly advise you to read the terms and conditions and privacy policies of any
            Third-Party Resources that you visit. Accessing Third-Party Resources linked from the
            Website is entirely at your own risk and subject to the terms and conditions of those
            third-party sites.
          </p>
        </div>

        {/* 5. Prohibited Uses */}
        <div style={sectionStyle}>
          <h2 style={h2}>5. Prohibited Uses</h2>
          <p style={pStyle}>
            In addition to other restrictions set forth in these Terms, you agree that you will not
            use the Website or its content for any purpose that is unlawful or prohibited by these
            Terms. You may not use the Website in any manner that could damage, disable, overburden,
            or impair the Website or interfere with any other party&apos;s use and enjoyment of the
            Website. Specifically, you agree not to:
          </p>
          <ul
            style={{
              margin: '0 0 14px',
              paddingLeft: 22,
              listStyleType: 'disc',
            }}
          >
            {[
              'Use the Website for any unlawful purpose or to solicit others to perform or participate in any unlawful acts.',
              'Violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances.',
              'Infringe upon or violate the intellectual property rights of Street Voices or any third party, including copyrights, trademarks, patents, trade secrets, and moral rights.',
              'Harass, abuse, insult, threaten, intimidate, defame, or discriminate against any individual or group based on gender, sexual orientation, religion, ethnicity, race, age, national origin, or disability.',
              'Submit false or misleading information, or impersonate any person or entity, including but not limited to a Street Voices representative.',
              'Interfere with or circumvent the security features of the Website, any related website, or the Internet, including attempting to gain unauthorized access to accounts, computer systems, or networks connected to the Website.',
              'Upload or transmit viruses, malware, or any other type of malicious code that may be used in any way that could affect the functionality or operation of the Website.',
              'Use the Website to collect or track personal information of other users without their consent, or to send unsolicited commercial communications (spam).',
              'Use the Website for any unauthorized or unintended purpose, or attempt to circumvent, disable, or otherwise interfere with any features of the Website, including security or access-restriction features.',
            ].map((item, i) => (
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
          <p style={{ ...pStyle, marginBottom: 0 }}>
            We reserve the right to terminate your use of the Website for violating any of the
            prohibited uses described above, without prior notice and at our sole discretion.
          </p>
        </div>

        {/* 6. Intellectual Property Rights */}
        <div style={sectionStyle}>
          <h2 style={h2}>6. Intellectual Property Rights</h2>
          <p style={pStyle}>
            The Website and its entire contents, features, and functionality &mdash; including but
            not limited to all text, graphics, logos, icons, images, audio clips, video clips, data
            compilations, software, and the design, selection, and arrangement thereof &mdash; are
            the exclusive property of Street Voices, its licensors, or other providers of such
            material and are protected by Canadian and international copyright, trademark, patent,
            trade secret, and other intellectual property or proprietary rights laws.
          </p>
          <p style={pStyle}>
            &ldquo;Street Voices&rdquo; and the Street Voices logo are trademarks of Street Voices.
            You may not use these trademarks without the prior written permission of Street Voices.
            All other trademarks, service marks, trade names, and logos appearing on the Website are
            the property of their respective owners.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            No right, title, or interest in or to the Website or any content on the Website is
            transferred to you as a result of your use of the Website. Nothing in these Terms grants
            you the right to use any of Street Voices&apos; trade names, trademarks, service marks,
            logos, domain names, or other distinctive brand features without our express written
            consent. Any unauthorized use of the Website&apos;s content or intellectual property may
            violate copyright, trademark, and other applicable laws and could result in criminal or
            civil penalties.
          </p>
        </div>

        {/* 7. Limitation of Liability */}
        <div style={sectionStyle}>
          <h2 style={h2}>7. Limitation of Liability</h2>
          <p style={pStyle}>
            To the fullest extent permitted by applicable law, in no event shall Street Voices, its
            directors, officers, employees, agents, partners, suppliers, or affiliates be liable for
            any indirect, incidental, special, consequential, or punitive damages, including without
            limitation loss of profits, data, use, goodwill, or other intangible losses, resulting
            from (i) your access to or use of, or inability to access or use, the Website; (ii) any
            conduct or content of any third party on the Website; (iii) any content obtained from the
            Website; or (iv) unauthorized access, use, or alteration of your transmissions or
            content, whether based on warranty, contract, tort (including negligence), or any other
            legal theory, whether or not we have been informed of the possibility of such damage.
          </p>
          <p style={pStyle}>
            In no event shall the aggregate liability of Street Voices arising out of or in
            connection with these Terms or the use of the Website exceed the total amount paid by you
            to Street Voices, if any, during the twelve (12) months preceding the date of the claim,
            or one hundred Canadian dollars (CAD $100.00), whichever is less.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Some jurisdictions do not allow the exclusion or limitation of certain warranties or the
            limitation or exclusion of liability for incidental or consequential damages. Accordingly,
            some of the above limitations and disclaimers may not apply to you. To the extent that
            Street Voices may not, as a matter of applicable law, disclaim any warranty or limit its
            liability, the scope and duration of such warranty and the extent of Street Voices&apos;
            liability shall be the minimum permitted under such applicable law.
          </p>
        </div>

        {/* 8. Indemnification */}
        <div style={sectionStyle}>
          <h2 style={h2}>8. Indemnification</h2>
          <p style={pStyle}>
            You agree to defend, indemnify, and hold harmless Street Voices and its officers,
            directors, employees, agents, licensors, suppliers, and any third-party information
            providers from and against all losses, expenses, damages, liabilities, and costs,
            including reasonable attorneys&apos; fees, arising out of or relating to: (i) your use of
            or inability to use the Website; (ii) your violation of these Terms; (iii) your violation
            of any rights of a third party, including intellectual property rights; or (iv) any User
            Content you post on or through the Website.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Street Voices reserves the right, at its own expense, to assume the exclusive defense
            and control of any matter otherwise subject to indemnification by you. In such cases, you
            agree to cooperate with our defense of such claims. This indemnification obligation will
            survive the termination of these Terms and your use of the Website.
          </p>
        </div>

        {/* 9. Dispute Resolution */}
        <div style={sectionStyle}>
          <h2 style={h2}>9. Dispute Resolution</h2>
          <p style={pStyle}>
            These Terms and any dispute or claim arising out of or in connection with them or their
            subject matter or formation (including non-contractual disputes or claims) shall be
            governed by and construed in accordance with the laws of the Province of Ontario and the
            federal laws of Canada applicable therein, without regard to conflict of law principles.
          </p>
          <p style={pStyle}>
            Any legal action or proceeding arising under these Terms shall be brought exclusively in
            the courts located in the Province of Ontario, Canada. You hereby irrevocably consent and
            submit to the personal jurisdiction and venue of such courts for the purpose of
            litigating any such action.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            Before filing any claim or commencing any legal proceeding, you agree to first attempt to
            resolve the dispute informally by contacting Street Voices at{' '}
            <a
              href="mailto:admin@streetvoices.ca"
              style={{ color: accentColor, textDecoration: 'none' }}
            >
              admin@streetvoices.ca
            </a>
            . We will attempt to resolve the dispute informally by contacting you via email. If a
            dispute is not resolved within thirty (30) days of submission, either party may proceed to
            bring a formal claim in the courts of the Province of Ontario.
          </p>
        </div>

        {/* 10. Changes and Amendments */}
        <div style={sectionStyle}>
          <h2 style={h2}>10. Changes and Amendments</h2>
          <p style={pStyle}>
            Street Voices reserves the right to modify these Terms at any time, effective upon
            posting of an updated version on the Website. When we do, we will revise the &ldquo;Last
            updated&rdquo; date at the top of this page. We may also provide additional notice of
            significant changes through email notification or through a prominent notice on the
            Website.
          </p>
          <p style={pStyle}>
            Continued use of the Website after any such changes shall constitute your consent to such
            changes. If you do not agree to the modified Terms, you must discontinue your use of the
            Website and any related services. It is your responsibility to review these Terms
            periodically for any updates or changes.
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            If you have any questions about these Terms, please contact us at{' '}
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
