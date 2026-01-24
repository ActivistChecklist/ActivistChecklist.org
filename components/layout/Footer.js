import Link from '@/components/Link'
import { DarkModeToggle } from "@/components/layout/DarkModeToggle"
import { CompactNewsletterSubscribe } from "@/components/NewsletterSubscribe"
import { footerConfig } from '@/config/navigation'

export function Footer() {
  return (
    <footer className="print:hidden bg-gray-100 text-gray-600 py-12">
      <div className="container max-w-6xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
          <div className="col-span-3">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{footerConfig.branding.title}</h2>
            <p className="mb-4 max-w-lg">{footerConfig.branding.description}</p>
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase mb-2">Stay Updated</h3>
              <CompactNewsletterSubscribe />
            </div>
          </div>
          
          {footerConfig.sections.map((section, index) => (
            <div key={index}>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="hover:text-gray-800">
                      {item.title || item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t text-sm border-gray-200 pt-8 flex flex-col md:flex-row md:items-center md:justify-between">
          <p>
            Content available under{' '}
            <Link
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              className="hover:text-gray-800 underline underline-offset-2"
            >
              Creative Commons BY-SA
            </Link>.{' '}
            See our <Link
              href="/about/#sources"
              className="hover:text-gray-800 underline underline-offset-2"
            >
              sources
            </Link>.
            Source code available on{' '}
            <Link   
              href="https://github.com/ActivistChecklist/ActivistChecklist.org"
              className="hover:text-gray-800 underline underline-offset-2"
            >
              GitHub
            </Link>.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-4 md:mt-0">
            {footerConfig.socialLinks?.map((social) => (
              <a
                key={social.key}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.ariaLabel}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <social.icon className="h-5 w-5" aria-hidden="true" />
                <span>{social.username}</span>
              </a>
            ))}
            {/* <DarkModeToggle /> */}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
