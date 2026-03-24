import { memo } from 'react';
import SiteFooter from './SiteFooter';

function HomepageFooter() {
  return <SiteFooter position="absolute" />;
}

export default memo(HomepageFooter);
