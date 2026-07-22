import PolicyPage from './PolicyPage'

export default function RefundCancellation() {
  return (
    <PolicyPage
      subtitle="Refund and cancellation policy"
      title="CREATYV Refund and Cancellation Policy"
      intro="This policy applies to Creatyv subscriptions, AI-generation credits, paid add-ons, Managed by MMM services and other paid services offered through Creatyv."
      sections={[
        {
          title: 'Purpose',
          paragraphs: [
            'By purchasing a plan or service, you agree to this Policy together with the Creatyv Terms of Use.',
          ],
        },
        {
          title: 'General refund policy',
          paragraphs: [
            'Payments made for Creatyv subscriptions, AI credits, add-ons and managed services are generally non-refundable.',
            'Refunds will not ordinarily be provided for change of mind, failure to use the subscription, partial use of a billing period, unused AI credits, dissatisfaction with the creative style of an AI output, failure to cancel before renewal, incorrect information submitted by the user, unsupported devices or browsers, internet or device problems, expired social media permissions, social media account restrictions, third-party API limitations or outages, a post rejected by Facebook, Instagram, YouTube or another platform, failure to obtain an expected level of reach, leads, engagement or sales, delays caused by missing approvals or materials, managed-service work that has already begun, or third-party costs already committed or paid.',
            'This policy does not limit a consumer right or remedy that cannot legally be excluded.',
          ],
        },
        {
          title: 'Refunds for a verified platform malfunction',
          paragraphs: [
            'A refund may be considered only where all of the following are satisfied:',
          ],
          items: [
            'A material paid Creatyv feature was unavailable or malfunctioning.',
            'The malfunction originated from Creatyv’s platform rather than the user’s device, internet connection, account, content, connected social platform or another third-party service.',
            'The malfunction materially prevented the user from accessing the paid feature.',
            'The user reported the issue promptly.',
            'The user provided sufficient technical evidence, including video evidence where reasonably possible.',
            'Creatyv verified the issue after internal scrutiny.',
            'Submitting evidence does not automatically entitle a user to a refund.',
          ],
        },
        {
          title: 'Evidence required',
          paragraphs: ['A refund review request relating to a platform malfunction should include:'],
          items: [
            'Registered Creatyv email address',
            'Subscription, payment or invoice details',
            'Date and approximate time of the incident',
            'Feature affected',
            'Device and browser information',
            'Steps taken before the error occurred',
            'Screenshot of the error',
            'Screen recording or video evidence',
            'Relevant error message',
            'Connected social platform, where applicable',
            'Confirmation that normal troubleshooting was attempted',
          ],
        },
        {
          title: 'Internal review and available remedies',
          paragraphs: [
            'After internal scrutiny, Creatyv may determine that no platform malfunction occurred, the problem was caused by user input or a third party, the issue has already been resolved, or a remedy such as credit restoration, service extension, partial refund or full refund is appropriate.',
            'Where a reasonable repair, credit restoration or service extension resolves the verified issue, Creatyv may provide that remedy instead of a monetary refund, subject to applicable law.',
          ],
        },
        {
          title: 'How to request a refund review',
          paragraphs: [
            'Send your request to creatyv@gmail.com and copy info@mintmoremarketing.com.',
            'Use the subject line: Refund Review â€“ Creatyv â€“ [Registered Email Address].',
            'Refund reviews should be raised within seven calendar days of discovering the alleged malfunction.',
          ],
        },
        {
          title: 'Subscription cancellation',
          paragraphs: [
            'Users may cancel a paid subscription through Dashboard â†’ Billing or Subscription â†’ Manage Plan â†’ Unsubscribe.',
            'Cancellation normally takes effect at the end of the current paid billing period.',
          ],
          items: [
            'No new monthly subscription charge should be initiated by Creatyv.',
            'Paid access may continue until the end of the current billing period.',
            'The account may be downgraded to the Free Plan.',
            'Paid generation limits may be removed.',
            'Publishing access may be disabled.',
            'Future scheduled posts may not be published after paid access ends.',
            'Insights and other paid features may become unavailable.',
            'Content may become subject to Free Plan storage or retention limits.',
          ],
        },
        {
          title: 'No pro-rata refund after cancellation',
          paragraphs: [
            'Cancelling during a billing month does not ordinarily result in a pro-rata refund for the remaining days.',
            'The user retains access to the paid plan until the end of the billing period, unless the account is terminated for violation of the Terms or the user requests immediate account deletion.',
          ],
        },
        {
          title: 'Managed by MMM cancellation',
          paragraphs: [
            'Managed by MMM or Enterprise services may be cancelled in accordance with the applicable proposal, order form, statement of work or written confirmation.',
          ],
          items: [
            'Cancellation applies from the next monthly service cycle.',
            'The current month’s fee is non-refundable after work has begun.',
            'Completed or partially completed work remains chargeable.',
            'Approved third-party expenses remain payable.',
            'Shoots, creators, vendors and media commitments may have separate cancellation charges.',
            'Creatyv access may downgrade after the service period ends.',
          ],
        },
        {
          title: 'Failed payments',
          paragraphs: [
            'Where payment fails, Creatyv may retry the payment, temporarily restrict paid features, pause scheduled publishing, ask the user to update the payment method or downgrade the account after a reasonable period.',
            'The user remains responsible for amounts already due.',
          ],
        },
        {
          title: 'Duplicate or incorrect charges',
          paragraphs: [
            'A user who believes that Creatyv has processed a duplicate or incorrect charge should contact support promptly with the registered email address, transaction reference and supporting payment evidence.',
            'Creatyv will review the transaction and correct a verified billing error. This clause does not cover a renewal that was correctly processed because the user did not cancel before the billing date.',
          ],
        },
        {
          title: 'Account deletion is different from cancellation',
          paragraphs: [
            'Deleting a Creatyv account does not necessarily cancel a subscription processed through an external payment provider.',
            'Users should first cancel the subscription through the Billing section and then request account deletion.',
            'Outstanding charges, invoices and authorised third-party costs remain payable.',
          ],
        },
      ]}
      contact={{
        paragraphs: [
          'For cancellation or refund-related assistance:',
        ],
        items: [
          'Email: creatyv@gmail.com',
          'Alternative Email: info@mintmoremarketing.com',
          'Telephone: +91 79802 37823',
          'Formal refund requests should be submitted by email with supporting evidence.',
        ],
      }}
    />
  )
}
