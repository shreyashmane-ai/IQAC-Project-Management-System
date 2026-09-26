import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'shreyashmane.ai@gmail.com'
const SERVICE_NAME = 'IQAC PMS (Internal Quality Assurance Cell — Program Management System)'

function Legal({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="card" style={{ padding: 28 }}>
      <Link to="/" style={{ color: '#2563eb', fontSize: 13, fontWeight: 600 }}>
        ← Back to Home
      </Link>
      <h1 style={{ fontSize: 22, margin: '14px 0 4px' }}>{title}</h1>
      <p className="muted2" style={{ fontSize: 12.5, marginBottom: 18 }}>Last updated: {updated}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text)' }}>
        {children}
      </div>
    </div>
  )
}

function H({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ fontSize: 15, margin: '6px 0 0', letterSpacing: '-.1px' }}>{children}</h2>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, color: 'var(--text-soft)' }}>{children}</p>
}

export function PrivacyPolicyPage() {
  return (
    <Legal title="Privacy Policy" updated="26 September 2026">
      <P>
        {SERVICE_NAME} (“we”, “our”, “us”) is a self-hosted program-management platform operated by the
        Internal Quality Assurance Cell. This policy explains what personal information we process when
        you use this portal and the rights you have under the Digital Personal Data Protection Act, 2023
        (India) and applicable laws.
      </P>

      <H>1. Information we collect</H>
      <P>
        <strong>When you register for a program:</strong> the identity fields you submit in the
        registration form — typically your name, email address, mobile number, institution, department
        and designation — along with your answers to the program&apos;s registration form. Some fields are
        mandatory so we can issue registration numbers and confirmations.
      </P>
      <P>
        <strong>When you give feedback:</strong> your feedback responses. Anonymous feedback is stored
        without your identity. Non-anonymous feedback is linked to your registration number.
      </P>
      <P>
        <strong>When you use attendance or food QR codes:</strong> your registration number and the time
        a code is presented or claimed. Food claims may additionally record the device/platform reported
        by your browser.
      </P>
      <P>
        <strong>When you verify a certificate:</strong> the certificate number you enter and, on success,
        the certificate details returned.
      </P>
      <P>
        <strong>Technical data:</strong> IP addresses and request logs are captured as part of normal
        server operation and used only for security, throttling and debugging.
      </P>

      <H>2. How we use your information</H>
      <P>
        We use your information to: process and manage registrations; send registration confirmations and
        program updates; provide attendance, food and certificate services; compile anonymised reports for
        Internal Quality Assurance; and protect the security of the platform.
      </P>

      <H>3. Legal basis</H>
      <P>
        Processing is based on the consent you provide at registration, our legitimate interest in running
        the program-management services you use, performance of the registration agreement, and legal
        compliance (including the DPDP Act, 2023 and UGC/statutory record-keeping requirements).
      </P>

      <H>4. Consent</H>
      <P>
        When you register, you are asked to consent to the processing described in this policy. Consent is
        voluntary; you may withdraw it at any time by contacting us, after which we will stop further
        processing unless the law requires us to keep the data.
      </P>

      <H>5. Your rights</H>
      <P>
        Under the DPDP Act, 2023 you have the right to access your personal data, correct or update it,
        request erasure, and file a complaint with the Data Protection Board of India if you are not
        satisfied with our response. Contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--link)' }}>{CONTACT_EMAIL}</a>{' '}
        for any of these requests.
      </P>

      <H>6. Sharing of information</H>
      <P>
        We do not sell or rent your personal information. Data is stored on servers we operate or lease.
        Where the platform is configured to send email, your email address is processed by the configured
        email (SMTP) provider for the purpose of sending transactional messages. The font files on this
        site may be loaded from the Google Fonts CDN; see our{' '}
        <Link to="/cookies" style={{ color: 'var(--link)' }}>Cookie Policy</Link> for details.
      </P>

      <H>7. Retention and security</H>
      <P>
        Registrations, feedback responses and audit logs are retained for as long as needed to provide the
        service and meet statutory record-keeping obligations; thereafter they should be removed by the
        system operator. Access to the administrative console is role-based, and the JWT session in your
        browser is revoked on logout.
      </P>

      <H>8. Contact and grievance</H>
      <P>
        For privacy questions or grievances: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--link)' }}>{CONTACT_EMAIL}</a>.
        We respond to privacy complaints within the timelines prescribed by applicable law.
      </P>

      <H>9. Changes</H>
      <P>
        We may update this policy from time to time. The “last updated” date above reflects the latest
        version.
      </P>
    </Legal>
  )
}

export function TermsPage() {
  return (
    <Legal title="Terms & Conditions" updated="26 September 2026">
      <P>
        By using {SERVICE_NAME} you agree to these terms. If you do not agree, please do not use the portal.
      </P>

      <H>1. The service</H>
      <P>
        The platform lets institutions manage programs, registrations, attendance, food services,
        feedback and certificates. Access to the public portal is free unless a specific program states an
        applicable charge in its own published terms.
      </P>

      <H>2. Registration</H>
      <P>
        You confirm that the information you provide is accurate. You are responsible for safeguarding
        your registration number and QR codes; sharing them may allow others to use your codes.
      </P>

      <H>3. Acceptable use</H>
      <P>
        You agree not to submit unlawful, defamatory or offensive content, attempt to access accounts or
        data you are not authorised to access, interfere with the platform, or use it to violate any law
        (including the DPDP Act, 2023).
      </P>

      <H>4. Intellectual property</H>
      <P>
        The platform, its design and content belong to the operator. Any content you submit in forms or
        feedback is used solely for the purposes described in the{' '}
        <Link to="/privacy" style={{ color: 'var(--link)' }}>Privacy Policy</Link>.
      </P>

      <H>5. Availability and limitation</H>
      <P>
        We provide the service “as is” and do not guarantee uninterrupted availability. To the maximum
        extent permitted by law, our liability is limited to the direct loss you actually suffer.
      </P>

      <H>6. Termination</H>
      <P>
        Registrations may be cancelled by the organising institute per the status rules in the program.
        We may suspend access that violates these terms.
      </P>

      <H>7. Governing law and contact</H>
      <P>
        These terms are governed by the laws of India. Questions: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--link)' }}>{CONTACT_EMAIL}</a>.
      </P>
    </Legal>
  )
}

export function CookiePolicyPage() {
  return (
    <Legal title="Cookie & Local Storage Policy" updated="26 September 2026">
      <P>
        This portal does not use advertising or analytics cookies. It uses browser <strong>local
        storage</strong> for a small number of purposes described below.
      </P>

      <H>1. Strictly necessary (essential)</H>
      <P>
        <strong>Session tokens</strong> (<code>iqac_access</code>, <code>iqac_refresh</code>): stored in
        your browser&apos;s local storage after you sign in to the administrative console. They let you stay
        signed in and are cleared when you sign out. These are required for the console to function.
      </P>

      <H>2. Preference storage</H>
      <P>
        <strong>Interface density</strong> (<code>iqac-dt-density</code>): remembers your choice of table
        density. <strong>Consent record</strong> (<code>iqac-consent</code>): remembers your choice on this
        banner so we do not ask repeatedly. These are optional.
      </P>

      <H>3. Third-party requests</H>
      <P>
        With your consent, fonts (Fira Sans / Fira Code) are loaded from the Google Fonts CDN. This means
        a request is sent to Google&apos;s servers that may include your IP address. If you choose “only
        required”, no external font request is made and system fonts are used instead. No other
        third-party scripts, embeds or trackers are used.
      </P>

      <H>4. Managing your choices</H>
      <P>
        You can change your preferences at any time using the consent banner, or by clearing site data in
        your browser. Clearing site data also signs you out of the console.
      </P>

      <H>5. Contact</H>
      <P>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--link)' }}>{CONTACT_EMAIL}</a>.
      </P>
    </Legal>
  )
}

export function RefundPolicyPage() {
  return (
    <Legal title="Refund & Cancellation Policy" updated="26 September 2026">
      <P>
        {SERVICE_NAME} is a program-management platform. It does not itself collect or process payments.
      </P>

      <H>1. Registrations</H>
      <P>
        Unless a specific program states otherwise in its own published terms, registration through this
        portal is free of charge, and no fees are collected by the platform.
      </P>

      <H>2. Fee-based programs</H>
      <P>
        If an organiser advertises a payable program, the fee is collected directly by the organising
        institute — never by this platform. Refunds and cancellations for such programs are governed by
        that organiser&apos;s published policy and contact details.
      </P>

      <H>3. Cancelled or postponed events</H>
      <P>
        If a program is cancelled or rescheduled, the organiser will communicate the change and handle any
        applicable refund directly. We will display the current program status on the program page.
      </P>

      <H>4. Contact</H>
      <P>
        For registration-related questions or disputes: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--link)' }}>{CONTACT_EMAIL}</a>.
      </P>
    </Legal>
  )
}