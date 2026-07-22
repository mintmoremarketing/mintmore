import PolicyPage from './PolicyPage'

export default function Privacy() {
  return (
    <PolicyPage
      subtitle="Privacy policy"
      title="CREATYV Privacy Policy"
      intro="Creatyv respects your privacy and is committed to handling personal information responsibly, transparently and securely."
      sections={[
        {
          title: 'Introduction',
          paragraphs: [
            'This Privacy Policy applies to the Creatyv website, web application, dashboards, AI-generation tools, content calendars, publishing tools, integrations and managed marketing services.',
            'For this Policy, “Creatyv,” “we,” “us” and “our” refer to the Creatyv platform and Mint More Marketing, which operates the platform.',
            'By creating a Creatyv account, using the platform, connecting a third-party account, submitting verification documents or purchasing a service, you acknowledge that you have read this Privacy Policy. Where consent is required, we will request it through a clear affirmative action, such as selecting a checkbox, connecting an account or submitting information for a stated purpose.',
          ],
        },
        {
          title: 'Information we collect',
          paragraphs: [
            'We may collect account and profile information, Google Sign-In information, identity and government verification information, business registration and verification information, social media account information, OAuth tokens and authorisation data, content and prompts, AI-generation information, payment and subscription information, managed service information, device and technical information, and communications and support information.',
          ],
          items: [
            'Account and profile details may include full name, email address, mobile number, password in encrypted or hashed form, profile photograph, business or brand name, job title, country, state, city, preferred language, account type, subscription plan, workspace information and team information.',
            'Google Sign-In may provide your name, email address, Google profile image, Google account identifier and authentication information required to create or access your Creatyv account.',
            'Social media account information may include account name, identifier, profile image, Facebook Page information, Instagram professional-account information, YouTube channel information, connected business or page information, publishing permissions, post and media information, page or channel roles, account status, access tokens and refresh tokens, permission or scope information, publishing results and error messages, and insights and performance information when available.',
            'AI-generation information may include prompts, instructions, uploaded reference images, video or audio, brand information and requested dimensions, styles or formats.',
          ],
        },
        {
          title: 'How we use information',
          paragraphs: [
            'We may use personal information to create and administer user accounts, authenticate logins and provide Google Sign-In, verify identities and businesses, provide AI-generation services, save content and generation history, manage workspaces and dashboards, enable team and client collaboration, connect social media accounts, schedule and publish posts, display publishing results, retrieve insights when available, deliver managed marketing services, process payments, subscriptions and invoices, enforce plan limits, provide customer support, investigate technical issues, prevent fraud, maintain security logs, detect prohibited content, improve features and user experience, communicate product, billing or policy updates, comply with legal requirements, and establish, exercise or defend legal claims.',
          ],
        },
        {
          title: 'Consent and user choice',
          paragraphs: [
            'Where Creatyv relies on consent, users may decide whether to create an account, use Google Sign-In, connect a social media account, approve requested permissions, withdraw optional consent, disconnect an account, request deletion and unsubscribe from promotional communications.',
            'Withdrawing permission may disable a feature that depends on that permission. For example, disconnecting a YouTube channel will prevent Creatyv from publishing scheduled videos to that channel. Withdrawal does not affect processing that lawfully occurred before the withdrawal.',
          ],
        },
        {
          title: 'How we share information',
          paragraphs: [
            'We may use third-party providers for cloud hosting, database services, file storage, authentication, email delivery, customer support, payment processing, analytics, security monitoring, error reporting, AI generation, content moderation and communications.',
            'When you connect or use a third-party service, information may be exchanged with Meta, Facebook, Instagram, Google, YouTube and other platforms introduced in the future.',
            'Authorised Mint More Marketing employees, consultants, designers, editors, social media managers and freelancers may receive access to relevant information where necessary to provide a managed service, prepare content, review a deliverable, resolve a support issue, or maintain and secure the platform.',
            'We may also share information with lawyers, accountants, auditors, insurers and professional advisers where reasonably necessary, or to legal or regulatory authorities where required by law.',
            'Creatyv does not sell government identity documents or social media access tokens.',
          ],
        },
        {
          title: 'International processing',
          paragraphs: [
            'Some hosting, AI, analytics, authentication, social media or technical providers may process information outside India. Where information is processed internationally, Creatyv will take reasonable steps to use reputable providers, appropriate agreements and security measures, subject to applicable law and government restrictions.',
          ],
        },
        {
          title: 'Data retention',
          paragraphs: [
            'We retain information only for as long as reasonably necessary to provide the service, maintain the account, complete a managed engagement, process payments and invoices, resolve disputes, prevent fraud, maintain security, and comply with legal, tax, accounting or regulatory obligations.',
            'OAuth tokens should be revoked or deleted when the user disconnects the relevant account, the authorisation expires, the account is deleted, the token is no longer required, or Creatyv becomes aware that the token has been compromised.',
            'Some backups and security logs may remain for a limited period after deletion before being securely overwritten.',
          ],
        },
        {
          title: 'Security',
          paragraphs: [
            'Creatyv uses reasonable technical and organisational safeguards designed to protect information. These may include encryption during transmission, protected storage for tokens and sensitive records, password hashing, role-based access, restricted administrative access, authentication controls, system monitoring, logging, backups, vulnerability management, token revocation procedures and staff confidentiality obligations.',
            'No system is completely secure. Users must also protect their devices, passwords, email accounts and connected third-party accounts.',
          ],
        },
        {
          title: 'User rights',
          paragraphs: [
            'Subject to applicable law, you may request confirmation of whether Creatyv processes your personal information, access to information associated with your account, correction of inaccurate or incomplete information, erasure of information that is no longer required, withdrawal of consent, disconnection of third-party accounts, closure of your Creatyv account, information about grievance handling, and nomination of another person to exercise applicable rights in the event of death or incapacity, where available under applicable law.',
          ],
        },
        {
          title: 'Account and data deletion',
          paragraphs: [
            'Users may request account deletion through the account settings or dashboard, where available, or by emailing Creatyv Support.',
            'Deleting an account may remove access to saved content, cancel future scheduled posts, disconnect social media accounts, remove team access, end access to paid features and prevent recovery of content after the applicable deletion period.',
          ],
        },
        {
          title: 'Cookies and children',
          paragraphs: [
            'Creatyv may use essential cookies for login sessions, security, account preferences, authentication, subscription management and platform functionality. We may also use analytics or performance cookies to understand how the platform is used.',
            'Creatyv is intended for users aged 18 years and above. We do not knowingly invite children to submit government identification, connect business social media accounts or purchase paid subscriptions.',
          ],
        },
        {
          title: 'Third-party links and changes',
          paragraphs: [
            'Creatyv may contain links to third-party websites, social platforms, payment gateways or external services. We are not responsible for the privacy practices, security or content of independently operated third-party services.',
            'We may update this Privacy Policy to reflect new features, integrations, legal requirements, security practices, service providers or business operations. Material changes may be communicated through the website, dashboard or registered email address.',
          ],
        },
      ]}
      contact={{
        paragraphs: ['For privacy, security or grievance concerns:'],
        items: [
          'Email: creatyv@gmail.com',
          'Alternative Email: info@mintmoremarketing.com',
          'Telephone: +91 79802 37823',
          'Formal complaints should be submitted by email so that they can be documented and investigated.',
        ],
      }}
    />
  )
}
