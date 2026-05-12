import { Download, LifeBuoy } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { downloadUrl } from '../data'

function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .297C5.373.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.335-1.757-1.335-1.757-1.087-.744.084-.729.084-.729 1.206.084 1.839 1.236 1.839 1.236 1.071 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.759-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.12-.303-.525-1.523.12-3.176 0 0 1.005-.322 3.3 1.23a11.47 11.47 0 0 1 3-.405c1.02.006 2.04.138 3 .405 2.295-1.552 3.3-1.23 3.3-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.435.375.81 1.096.81 2.22 0 1.605-.015 2.895-.015 3.285 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297z" />
    </svg>
  )
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.901 1.153h3.68l-8.04 9.189 9.457 12.505h-7.406l-5.802-7.584-6.64 7.584H.466l8.6-9.826L0 1.153h7.594l5.245 6.932 6.062-6.932zm-1.292 19.49h2.04L6.486 3.242H4.3l13.309 17.401z" />
    </svg>
  )
}

const footerLinks = [
  {
    href: 'https://github.com/Gabriel-Leall/axis-desktop',
    label: 'GitHub',
    icon: GitHubIcon,
  },
  {
    href: 'https://x.com',
    label: 'X',
    icon: XIcon,
  },
  {
    href: 'https://github.com/Gabriel-Leall/axis-desktop/issues/new/choose',
    label: 'Support',
    icon: LifeBuoy,
  },
] as {
  href: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}[]

export function LandingFooter() {
  return (
    <>
      <footer className="footer-cta" data-reveal={true} data-delay="6">
        <p>Execute with ruthless focus. Zero friction.</p>
        <a className="footer-download" href={downloadUrl}>
          <Download />
          Download for desktop
        </a>
      </footer>

      <section className="footer-meta" data-reveal={true} data-delay="6">
        <div>
          <span>Built for focused work.</span>
          <span>Local-first. Free. Open source.</span>
        </div>
        <div className="footer-links">
          {footerLinks.map(link => (
            <a
              key={link.label}
              className="footer-link"
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              <link.icon strokeWidth={2.4} />
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}
