import { FlowRunner } from '@/engine/FlowRunner';
import { tabbyExperience } from './flow';
import './tabby.css';

export default function TabbyPage() {
  return <FlowRunner experience={tabbyExperience} />;
}
