import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { buildSiteUrl } from '../lib/navigation';

type PortalHighlight = {
  title: string;
  description: string;
};

interface PortalShellProps {
  screenLabel: string;
  badge: string;
  title: string;
  description: string;
  sideLabel: string;
  sideTitle: string;
  sideDescription: string;
  sideHighlights: PortalHighlight[];
  children: React.ReactNode;
  status?: React.ReactNode;
  footer?: React.ReactNode;
}

const SITE_NAME = 'الرحمة المهداه للتوظيف';
const LOGO_SRC = '/logo-mark.png';

export default function PortalShell({
  screenLabel,
  badge,
  title,
  description,
  sideLabel,
  sideTitle,
  sideDescription,
  sideHighlights,
  children,
  status,
  footer,
}: PortalShellProps) {
  const siteHref = buildSiteUrl('index.html');

  return (
    <div className="portal-page">
      <div className="portal-layout">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="portal-card"
        >
          <div className="portal-card-header">
            <a href={siteHref} className="portal-back-link">
              <ArrowRight className="h-4 w-4" />
              العودة للموقع
            </a>

            <div className="portal-mobile-brand" aria-hidden="true">
              <div className="portal-logo-frame portal-logo-frame--compact">
                <img src={LOGO_SRC} alt={SITE_NAME} className="portal-logo-image" />
              </div>
              <div className="portal-mobile-brand-copy">
                <div className="portal-kicker">{SITE_NAME}</div>
                <div className="portal-mobile-title">{screenLabel}</div>
              </div>
            </div>
          </div>

          <div className="portal-copy">
            <div className="portal-copy-top">
              <div className="portal-kicker">{screenLabel}</div>
              <span className="portal-badge">{badge}</span>
            </div>

            <h1 className="portal-title">{title}</h1>
            <p className="portal-description">{description}</p>
          </div>

          {status ? <div className="portal-status-shell">{status}</div> : null}

          <div className="portal-content">{children}</div>

          {footer ? <div className="portal-footer">{footer}</div> : null}
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut', delay: 0.04 }}
          className="portal-aside"
        >
          <div>
            <div className="portal-logo-frame">
              <img src={LOGO_SRC} alt={SITE_NAME} className="portal-logo-image" />
            </div>
            <div className="portal-side-label">{sideLabel}</div>
            <h2 className="portal-side-title">{sideTitle}</h2>
            <p className="portal-side-description">{sideDescription}</p>
          </div>

          <div className="portal-side-grid">
            {sideHighlights.map((highlight) => (
              <article key={highlight.title} className="portal-side-card">
                <div className="portal-side-card-title">{highlight.title}</div>
                <p className="portal-side-card-description">{highlight.description}</p>
              </article>
            ))}
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
