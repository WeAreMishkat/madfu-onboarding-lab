import { FlowRunner } from '@/engine/FlowRunner';
import { tamaraExperience } from './flow';
import './tamara.css';

export default function TamaraPage() {
  return <FlowRunner experience={tamaraExperience} />;
}
