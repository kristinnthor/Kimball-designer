import type { ComponentType } from 'react';
import type { PhaseId } from '../../core';
import { BubblesPhase } from './BubblesPhase';
import { DimensionsPhase } from './DimensionsPhase';
import { FactsPhase } from './FactsPhase';
import { GrainPhase } from './GrainPhase';
import { KickoffPhase } from './KickoffPhase';
import { MatrixPhase } from './MatrixPhase';
import { ProcessesPhase } from './ProcessesPhase';
import { RequirementsPhase } from './RequirementsPhase';
import { ReviewPhase } from './ReviewPhase';
import { StakeholdersPhase } from './StakeholdersPhase';

export const PHASE_COMPONENTS: Record<PhaseId, ComponentType> = {
  kickoff: KickoffPhase,
  stakeholders: StakeholdersPhase,
  requirements: RequirementsPhase,
  processes: ProcessesPhase,
  grain: GrainPhase,
  dimensions: DimensionsPhase,
  facts: FactsPhase,
  bubbles: BubblesPhase,
  matrix: MatrixPhase,
  review: ReviewPhase,
};
