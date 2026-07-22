import PolicyPage from './PolicyPage'

export default function Terms() {
  return (
    <PolicyPage
      subtitle="Terms of service"
      title="CREATYV Terms of Use"
      intro="These Terms of Use form a binding agreement between you and Creatyv, operated by Mint More Marketing."
      sections={[
        {
          title: 'Acceptance of terms',
          paragraphs: [
            'By visiting the website, creating an account, selecting a subscription, connecting a social media account, using an AI tool, uploading content, scheduling or publishing a post, using a client dashboard or purchasing a Managed by MMM service, you agree to these Terms, the Privacy Policy and any applicable order form, proposal or statement of work.',
          ],
        },
        {
          title: 'Eligibility and authority',
          paragraphs: [
            'You must be at least 18 years old and legally capable of entering into a binding agreement.',
            'Where you use Creatyv for a business, organisation, client or brand, you confirm that you are authorised to act for that entity, connect its social media accounts, upload its content, approve and publish posts, submit business information and bind the relevant organisation where applicable.',
          ],
        },
        {
          title: 'Accounts and plans',
          paragraphs: [
            'You must provide accurate information, maintain current contact details, protect your password and login methods, prevent unauthorised access and ensure that team members use authorised accounts.',
            'The Free Plan may include limited AI generations, basic workspace access, limited content storage, draft creation and content-calendar access. The Free Plan does not include direct social media publishing unless expressly stated otherwise.',
            'Paid subscriptions are billed monthly in advance and may renew automatically unless cancelled before the next billing date.',
            'AI generations may be governed by monthly credits, feature-specific limits, file-size limits, duration limits, resolution limits, fair-use limits and platform or provider restrictions.',
          ],
        },
        {
          title: 'Social media connections and publishing',
          paragraphs: [
            'Creatyv may allow users to connect supported Facebook, Instagram, YouTube and other third-party accounts through approved authorisation methods.',
            'By connecting an account, you authorise Creatyv to perform the actions covered by the permissions you approve.',
            'You acknowledge that platform permissions can change, tokens can expire, accounts can become disconnected, publishing access may be revoked, platform reviews may delay features, some account types may not be supported, and third-party providers may restrict or remove access.',
            'Creatyv provides scheduling and publishing tools on a reasonable-efforts basis. You are responsible for selecting the correct account, date, time and time zone; reviewing content before approval; confirming captions, tags and links; confirming music and media rights; ensuring that the post complies with applicable law and platform rules; and checking whether a scheduled post was successfully published.',
          ],
        },
        {
          title: 'User content and AI output',
          paragraphs: [
            '“User Content” includes content, prompts, files, media, logos, documents and information uploaded or submitted by a user.',
            'You retain your rights in your User Content and grant Creatyv a limited licence to operate the service, store content, enable collaboration, schedule or publish content, provide support, investigate abuse or technical issues, perform a managed service and comply with law.',
            'AI-generated content may be inaccurate, incomplete, unsuitable, similar to other outputs or affected by limitations in the underlying AI model. Users must review outputs before use and are responsible for checking names, claims, prices, offers, product information, copyright, trademarks, likeness rights, platform policies and advertising disclosures.',
          ],
        },
        {
          title: 'Prohibited use',
          paragraphs: [
            'You may not use Creatyv to create, upload, schedule or publish unlawful, infringing, fraudulent, deceptive, malicious, abusive, spam-related or otherwise prohibited content, or to circumvent usage limits or extract confidential systems.',
          ],
        },
        {
          title: 'Managed by MMM services',
          paragraphs: [
            'Managed services are subject to the agreed proposal, scope, deliverables and approval process.',
            'Unless expressly included, the monthly starting price does not automatically include professional shoots, models, influencers, media buying, advertising spend, travel, venue costs, printing, third-party software, stock footage, music licences, voice artists, additional revisions, rush delivery or custom development.',
          ],
        },
        {
          title: 'Intellectual property and third-party services',
          paragraphs: [
            'Creatyv’s platform, interface, software, branding, templates, workflows, documentation and proprietary systems are owned by or licensed to Creatyv and Mint More Marketing.',
            'Creatyv depends on third-party services, including social platforms, cloud providers, AI providers and payment processors. We do not control those providers and cannot guarantee their continued availability.',
          ],
        },
        {
          title: 'Suspension, disclaimer and liability',
          paragraphs: [
            'Creatyv may suspend, restrict or terminate access where payment is overdue, an account is used unlawfully, false verification information is provided, the user violates these Terms, the account creates a security risk, the user abuses AI or publishing systems, a third-party provider requires suspension, or continued access may harm Creatyv, users or the public.',
            'Creatyv is provided on an “as available” basis. To the maximum extent permitted by law, Creatyv does not guarantee uninterrupted availability, error-free operation, a particular marketing outcome, increased reach, engagement or sales, social platform approval, permanent availability of an integration, exact publishing times, uniqueness of AI outputs or compatibility with every device or account type.',
            'Where liability cannot be excluded, total aggregate liability arising from a paid subscription will ordinarily be limited to the amount paid by the affected user to Creatyv during the three months immediately preceding the event giving rise to the claim.',
          ],
        },
        {
          title: 'Changes, governing law and contact',
          paragraphs: [
            'We may modify the platform or these Terms for legal, operational, security, technical or commercial reasons. Material changes may be communicated through the website, dashboard or registered email address.',
            'These Terms are governed by the laws of India and courts with jurisdiction in Kolkata, West Bengal will have jurisdiction over disputes arising from these Terms or use of Creatyv, subject to applicable consumer rights and dispute-resolution requirements.',
          ],
        },
      ]}
      contact={{
        paragraphs: ['Questions about these Terms may be sent to:'],
        items: [
          'Email: creatyv@gmail.com',
          'Alternative Email: info@mintmoremarketing.com',
          'Telephone: +91 79802 37823',
        ],
      }}
    />
  )
}
