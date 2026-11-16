import { DualPageSection } from './sections/DualPageSection';
import { HomePageSection } from './sections/HomePageSection';
import { AuthPageSection } from './sections/AuthPageSection';

export default function FigmaPreviewPage() {
  return (
    <main>
      <DualPageSection />
      <HomePageSection />
      <AuthPageSection />
    </main>
  );
}
