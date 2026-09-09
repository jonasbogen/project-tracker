import Icon from '@intility/bifrost-react/Icon';
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

// A consistent icon-plus-heading pattern for every card's <h2>, across every
// page - originally just Dashboard's, pulled out so the rest of the app gets
// the same quick visual anchoring instead of bare text headings everywhere else.
export default function SectionTitle({
  icon,
  children,
  as: Tag = 'h2',
  className,
}: {
  icon: IconDefinition;
  children: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <Tag className={`${Tag === 'h2' ? 'bf-h2' : 'bf-h3'} section-title${className ? ` ${className}` : ''}`}>
      <Icon icon={icon} />
      <span className="section-title-text">{children}</span>
    </Tag>
  );
}
