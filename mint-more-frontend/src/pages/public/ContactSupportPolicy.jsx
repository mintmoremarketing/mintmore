import PolicyPage from './PolicyPage'

export default function ContactSupportPolicy() {
  return (
    <PolicyPage
      subtitle="Contact and support policy"
      title="CREATYV Contact and Support Policy"
      intro="This policy explains how users can obtain assistance with Creatyv accounts, subscriptions, billing, technical issues, privacy requests, security concerns and Managed by MMM services."
      sections={[
        {
          title: 'Contact channels',
          paragraphs: [
            'Primary Support Email: creatyv@gmail.com',
            'Alternative Email: info@mintmoremarketing.com',
            'Telephone Support: +91 79802 37823',
            'Formal complaints, refund reviews, privacy requests and security reports should be submitted by email so that a written record can be maintained.',
          ],
        },
        {
          title: 'Technical support',
          paragraphs: ['Contact Creatyv Support regarding:'],
          items: [
            'Login or authentication problems',
            'Google Sign-In problems',
            'Dashboard errors',
            'Failed AI text, image or video generations',
            'Missing or incorrectly deducted credits',
            'Social media account connection issues',
            'Facebook or Instagram permission issues',
            'YouTube connection issues',
            'Scheduling errors',
            'Publishing failures',
            'Missing content',
            'Payment errors',
            'Account-access problems',
            'Unexpected platform behaviour',
          ],
        },
        {
          title: 'Billing and subscription support',
          paragraphs: ['Contact us regarding:'],
          items: [
            'Subscription status',
            'Invoice requests',
            'Failed payments',
            'Duplicate or incorrect charges',
            'Plan upgrades',
            'Plan downgrades',
            'Subscription cancellation',
            'Refund review',
            'Managed by MMM billing questions',
          ],
        },
        {
          title: 'Privacy and data support',
          paragraphs: ['Contact us regarding:'],
          items: [
            'Access to personal information',
            'Correction of inaccurate information',
            'Data deletion',
            'Account deletion',
            'Withdrawal of consent',
            'Government verification documents',
            'Business registration documents',
            'Social media account disconnection',
            'Google account permissions',
            'Privacy complaints',
          ],
        },
        {
          title: 'Security support',
          paragraphs: ['Immediately report:'],
          items: [
            'Suspected account takeover',
            'Unauthorised publishing',
            'Lost access to a connected account',
            'Suspicious login activity',
            'Exposed access token or credential',
            'Unauthorised workspace access',
            'Suspected data breach',
            'A compromised email account used to access Creatyv',
            'Do not email passwords, one-time passwords, full payment-card details or private API keys.',
            'Where appropriate, users should also revoke Creatyv’s access through their Meta or Google account settings and change passwords on any affected third-party account.',
          ],
        },
        {
          title: 'Managed by MMM support',
          paragraphs: ['Managed by MMM clients may contact support regarding:'],
          items: [
            'Content calendars',
            'Content approvals',
            'Revision requests',
            'Publishing status',
            'Monthly deliverables',
            'Shoot coordination',
            'Creators, influencers or vendors',
            'Reports',
            'Service scope',
            'Account coordination',
            'Client dashboard access',
          ],
        },
        {
          title: 'Information to include in a support request',
          paragraphs: ['To help us investigate efficiently, include:'],
          items: [
            'Full name',
            'Registered Creatyv email address',
            'Business or brand name',
            'Relevant workspace',
            'Subscription plan',
            'Clear description of the issue',
            'Date and approximate time',
            'Screenshots',
            'Screen recording or video evidence where relevant',
            'Device and browser',
            'Connected social platform',
            'Error message',
            'Relevant invoice or transaction reference',
            'Avoid sending unnecessary government-document information. Only submit verification documents when specifically requested through an authorised process.',
          ],
        },
        {
          title: 'Identity and authority verification',
          paragraphs: [
            'Before discussing account information or completing a data-rights, billing or business request, Creatyv may ask the requester to verify control of the registered email address, account ownership, business authority, relevant transaction information or identity where reasonably necessary.',
          ],
        },
        {
          title: 'Support limitations',
          paragraphs: ['Creatyv Support may assist with the Creatyv platform but cannot control:'],
          items: [
            'Facebook account suspensions',
            'Instagram restrictions',
            'YouTube channel penalties',
            'Meta or Google application-review decisions',
            'Third-party API outages',
            'AI-provider outages or content restrictions',
            'Internet-service failures',
            'Device-specific problems',
            'Copyright claims filed by third parties',
            'Social media moderation outcomes',
            'Payment-provider decisions',
          ],
        },
        {
          title: 'Platform malfunction reports',
          paragraphs: [
            'A user reporting a possible Creatyv malfunction should provide a screenshot and, where reasonably possible, video evidence showing the steps taken and the resulting error.',
            'Platform malfunction reports will be reviewed internally. Providing evidence does not automatically establish that Creatyv caused the issue or that a refund is payable.',
            'Refund eligibility is governed by the Creatyv Refund and Cancellation Policy.',
          ],
        },
        {
          title: 'Response and resolution',
          paragraphs: [
            'Creatyv will make reasonable efforts to acknowledge and investigate support requests based on their urgency, complexity and available information.',
          ],
          items: [
            'Additional information from the user',
            'Reproduction of the issue',
            'Review of technical logs',
            'Coordination with Meta, Google, YouTube, an AI provider or another third party',
            'Restoration of credits',
            'Reconnection of a social account',
            'A platform fix',
            'A billing correction',
            'Escalation to Mint More Marketing management',
            'No specific resolution time is guaranteed unless separately agreed in writing.',
          ],
        },
        {
          title: 'Grievance escalation',
          paragraphs: [
            'Where an issue is not resolved through ordinary support, send an escalation to info@mintmoremarketing.com with the subject line Formal Grievance â€“ Creatyv.',
            'Include previous support correspondence, account details, a clear description of the concern, the resolution requested and supporting evidence.',
          ],
        },
        {
          title: 'Telephone support',
          paragraphs: [
            'Telephone support is available at +91 79802 37823 for general guidance and urgent account concerns.',
            'For formal complaints, privacy requests, refunds, billing disputes and security incidents, users may be asked to submit the matter by email so that it can be documented and investigated.',
          ],
        },
        {
          title: 'Emergency and law-enforcement requests',
          paragraphs: [
            'Creatyv Support is not an emergency service.',
            'Law-enforcement or legally authorised requests should be submitted to info@mintmoremarketing.com and must include valid authority, official contact details and sufficient information to identify the relevant account or record.',
          ],
        },
      ]}
      contact={{
        paragraphs: [
          'Contact summary:',
        ],
        items: [
          'General Support: creatyv@gmail.com',
          'Escalations and Business Support: info@mintmoremarketing.com',
          'Telephone: +91 79802 37823',
        ],
      }}
    />
  )
}
