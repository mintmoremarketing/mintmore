import PolicyPage from './PolicyPage'

export default function TermsOfUse() {
  return (
    <PolicyPage
      subtitle="Terms of use"
      title="CREATYV Terms of Use"
      intro="These Terms of Use form a binding agreement between you and Creatyv, operated by Mint More Marketing."
      sections={[
        {
          title: 'Acceptance of terms',
          paragraphs: [
            'By visiting the website, creating an account, selecting a subscription, connecting a social media account, using an AI tool, uploading content, scheduling or publishing a post, using a client dashboard or purchasing a Managed by MMM service, you agree to these Terms, the Privacy Policy and any applicable order form, proposal or statement of work.',
            'Do not use Creatyv if you do not agree to these Terms.',
          ],
        },
        {
          title: 'Eligibility and authority',
          paragraphs: [
            'You must be at least 18 years old and legally capable of entering into a binding agreement.',
            'Where you use Creatyv for a business, organisation, client or brand, you confirm that you are authorised to act for that entity, connect its social media accounts, upload its content, approve and publish posts, submit business information and bind the relevant organisation where applicable.',
            'Creatyv may request proof of identity, authority or business registration where reasonably required.',
          ],
        },
        {
          title: 'User accounts',
          paragraphs: [
            'You must provide accurate information, maintain current contact details, protect your password and login methods, prevent unauthorised access, notify us of suspected compromise and ensure that team members use authorised accounts.',
            'You may not impersonate another person, create an account using false information, share an account to bypass plan limits, sell or transfer account access without permission, attempt to access another user’s workspace, or circumvent security or subscription controls.',
            'You are responsible for activities performed through your account, except to the extent caused by Creatyv’s own verified security failure.',
          ],
        },
        {
          title: 'Plans',
          items: [
            'Free Plan: may include limited AI generations, basic workspace access, limited content storage, draft creation and content-calendar access. The Free Plan does not include direct social media publishing unless expressly stated otherwise.',
            'Pro Plan: priced at ₹2,000 per month unless a different promotional or revised price is displayed at checkout. The Pro Plan may include higher AI-generation limits, AI text generation, AI image generation, AI video generation, a visual content calendar, supported social media connections, scheduling, publishing, review and approval features, and access to future Insights features when released and included in the plan.',
            'Managed by MMM / Enterprise Plan: begins at ₹8,999 per month and may vary based on the number of brands, platforms, posts, designs, videos, shoots, users, approvals, reports, advertising requirements, custom integrations and other requested services. Managed services may require a separate proposal, statement of work, invoice or written confirmation.',
          ],
        },
        {
          title: 'Monthly billing and renewal',
          paragraphs: [
            'Paid subscriptions are billed monthly in advance.',
            'Unless cancelled before the next billing date, paid plans may renew automatically using the payment method approved by the user. The subscriber authorises Creatyv and its payment provider to charge the subscription fee, applicable taxes, approved add-ons, additional usage purchased by the user and other amounts expressly accepted by the user.',
            'Prices may change after reasonable notice. A price change will ordinarily apply from a future billing cycle.',
          ],
        },
        {
          title: 'Usage limits and credits',
          paragraphs: [
            'AI generations may be governed by monthly credits, feature-specific limits, file-size limits, duration limits, resolution limits, fair-use limits and platform or provider restrictions.',
            'Text, image and video generations may consume different numbers of credits. Unused monthly credits do not carry forward unless the plan expressly states otherwise.',
            'Repeated generations, regenerations and failed requests caused by unsupported input may still consume processing resources. Creatyv may restore credits where a verified platform-side failure occurred.',
            'Creatyv may update limits to account for cost, security, abuse prevention or product changes.',
          ],
        },
        {
          title: 'Beta and upcoming features',
          paragraphs: [
            'Some features may be in beta, under testing, available to selected accounts, labelled “Coming Soon,” released gradually or modified before full release.',
            'Insights, freelancer dashboards, advanced analytics and other roadmap features are not guaranteed until officially released. Purchasing a current plan does not guarantee a particular release date for an upcoming feature.',
          ],
        },
        {
          title: 'Social media connections',
          paragraphs: [
            'Creatyv may allow users to connect supported Facebook, Instagram, YouTube and other third-party accounts through approved authorisation methods.',
            'By connecting an account, you authorise Creatyv to perform the actions covered by the permissions you approve.',
            'You acknowledge that platform permissions can change, tokens can expire, accounts can become disconnected, publishing access may be revoked, platform reviews may delay features, some account types may not be supported, and third-party providers may restrict or remove access.',
            'You must not provide Creatyv with your Facebook, Instagram, Google or YouTube password. Account connections should be completed only through the approved Meta, Google or other platform authorisation flow.',
          ],
        },
        {
          title: 'Scheduling and publishing',
          paragraphs: [
            'Creatyv provides scheduling and publishing tools on a reasonable-efforts basis.',
            'You are responsible for selecting the correct account, date, time and time zone; reviewing content before approval; confirming captions, tags and links; confirming music and media rights; ensuring that the post complies with applicable law and platform rules; and checking whether a scheduled post was successfully published.',
            'Creatyv does not guarantee that every scheduled post will publish at the exact selected second or minute.',
            'Publishing may be delayed or prevented by third-party API limitations, internet failure, expired permissions, account restrictions, content-format errors, platform moderation, scheduled maintenance, unforeseen technical failure or a third-party outage.',
            'Where a post is commercially or legally time-sensitive, users should independently confirm publication.',
          ],
        },
        {
          title: 'Client approval workflows',
          paragraphs: [
            'A client, team member or authorised user may approve, reject or request changes to content.',
            'Approval through the Creatyv dashboard may be treated as authorisation to finalise, schedule or publish the content, begin the next stage of production or use approved materials within the agreed campaign.',
            'Users must ensure that approval permissions are assigned only to authorised persons.',
          ],
        },
        {
          title: 'User content',
          paragraphs: [
            '“User Content” includes content, prompts, files, media, logos, documents and information uploaded or submitted by a user.',
            'You retain your rights in your User Content. You grant Creatyv a limited, non-exclusive, worldwide licence to host, reproduce, process, modify, transmit and display User Content only as reasonably necessary to provide the service, generate requested outputs, store content, enable collaboration, schedule or publish content, provide support, investigate abuse or technical issues, perform a managed service and comply with law.',
            'You confirm that you have the necessary rights and permissions to upload and use the User Content.',
          ],
        },
        {
          title: 'AI-generated content',
          paragraphs: [
            'AI-generated content may be inaccurate, incomplete, unsuitable, similar to other outputs or affected by limitations in the underlying AI model.',
            'Creatyv does not guarantee that an AI output is factually accurate, original, unique, free from third-party rights, legally compliant, suitable for publication, suitable for advertising, suitable for a regulated industry or consistent with every brand guideline.',
            'Users must review outputs before use and are responsible for checking names, claims, prices, offers, product information, copyright, trademarks, likeness rights, platform policies and advertising disclosures.',
            'AI output should not be treated as professional legal, medical, financial or regulatory advice.',
          ],
        },
        {
          title: 'Prohibited use',
          paragraphs: ['You may not use Creatyv to create, upload, schedule or publish content that:'],
          items: [
            'Is unlawful',
            'Infringes copyright, trademarks, privacy or publicity rights',
            'Contains child sexual abuse material',
            'Promotes exploitation, trafficking or terrorism',
            'Contains credible threats',
            'Is fraudulent or deceptive',
            'Impersonates another person without authorisation',
            'Contains malware or malicious code',
            'Attempts to disrupt the platform',
            'Violates social media platform rules',
            'Uses another person’s government document without authority',
            'Contains personal data collected unlawfully',
            'Circumvents usage limits',
            'Attempts to extract models, source code or confidential systems',
            'Is used for spam or unauthorised bulk messaging',
            'Creatyv may block, remove, suspend or report prohibited activity.',
          ],
        },
        {
          title: 'Managed by MMM services',
          paragraphs: [
            'Managed services are subject to the agreed proposal, scope, deliverables and approval process.',
            'Unless expressly included, the monthly starting price does not automatically include professional shoots, models, influencers, media buying, advertising spend, travel, venue costs, printing, third-party software, stock footage, music licences, voice artists, additional revisions, rush delivery or custom development.',
            'Third-party expenses must be separately approved and may be payable in advance. Unused deliverables do not automatically roll over unless the written scope says otherwise.',
          ],
        },
        {
          title: 'Intellectual property',
          paragraphs: [
            'Creatyv’s platform, interface, software, branding, templates, workflows, documentation and proprietary systems are owned by or licensed to Creatyv and Mint More Marketing.',
            'These Terms do not transfer ownership of the platform to the user.',
            'Users may not copy the platform, reverse engineer it, resell access without approval, remove proprietary notices, use Creatyv branding without permission, extract or reproduce substantial parts of the service, or create a confusingly similar product using protected Creatyv materials.',
          ],
        },
        {
          title: 'Third-party services',
          paragraphs: [
            'Creatyv depends on third-party services, including social platforms, cloud providers, AI providers and payment processors.',
            'We do not control those providers and cannot guarantee their continued availability. Users must comply with applicable third-party terms.',
            'Creatyv may change, restrict or remove an integration where required by a provider, applicable law, security concerns or technical feasibility.',
          ],
        },
        {
          title: 'Suspension and termination',
          paragraphs: [
            'Creatyv may suspend, restrict or terminate access where payment is overdue, an account is used unlawfully, false verification information is provided, the user violates these Terms, the account creates a security risk, the user abuses AI or publishing systems, a third-party provider requires suspension, or continued access may harm Creatyv, users or the public.',
            'Where reasonably possible, we may give notice and an opportunity to resolve the issue. Serious fraud, illegal activity or security abuse may result in immediate suspension.',
          ],
        },
        {
          title: 'Disclaimer',
          paragraphs: [
            'Creatyv is provided on an “as available” basis.',
            'To the maximum extent permitted by law, Creatyv does not guarantee uninterrupted availability, error-free operation, a particular marketing outcome, increased reach, engagement or sales, social platform approval, permanent availability of an integration, exact publishing times, uniqueness of AI outputs or compatibility with every device or account type.',
            'Nothing in these Terms excludes rights that cannot lawfully be excluded.',
          ],
        },
        {
          title: 'Limitation of liability',
          paragraphs: [
            'To the maximum extent permitted by applicable law, Creatyv and Mint More Marketing will not be liable for indirect, incidental, special or consequential losses, including loss of profit, revenue, opportunity, goodwill, data, social media standing, missed publishing opportunities or business interruption.',
            'Where liability cannot be excluded, total aggregate liability arising from a paid subscription will ordinarily be limited to the amount paid by the affected user to Creatyv during the three months immediately preceding the event giving rise to the claim.',
            'This limitation does not apply where liability cannot legally be limited.',
          ],
        },
        {
          title: 'Indemnity',
          paragraphs: [
            'You agree to indemnify Creatyv and Mint More Marketing against claims, losses and reasonable costs arising from your User Content, unlawful use of the platform, infringement of third-party rights, lack of authority over a connected account, violation of these Terms, or claims caused by information or instructions supplied by you.',
          ],
        },
        {
          title: 'Changes to the service or terms',
          paragraphs: [
            'We may modify the platform or these Terms for legal, operational, security, technical or commercial reasons.',
            'Material changes may be communicated through the website, dashboard or registered email address. Continued use after the effective date of updated Terms constitutes acceptance to the extent permitted by law.',
          ],
        },
        {
          title: 'Governing law and jurisdiction',
          paragraphs: [
            'These Terms are governed by the laws of India.',
            'Subject to applicable consumer rights and dispute-resolution requirements, courts with jurisdiction in Kolkata, West Bengal will have jurisdiction over disputes arising from these Terms or use of Creatyv.',
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
