import { FlowRunner } from '@/engine/FlowRunner';
import { madfuCurrentExperience } from './flow';
import './madfu-current.css';

export default function MadfuCurrentPage() {
  return <FlowRunner experience={madfuCurrentExperience} />;
}
