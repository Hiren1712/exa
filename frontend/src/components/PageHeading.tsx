import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface PageHeadingProps {
  icon: string;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}

export function PageHeading({ icon, title, description, children }: PageHeadingProps) {
  return (
    <header className="workspace-heading">
      <div className="workspace-heading-intro">
        <span className="workspace-heading-icon"><Icon name={icon} size={26} /></span>
        <div className="min-w-0">
          <h1>{title}</h1>
          <div className="workspace-description">{description}</div>
        </div>
      </div>
      {children && <div className="workspace-heading-actions">{children}</div>}
    </header>
  );
}
