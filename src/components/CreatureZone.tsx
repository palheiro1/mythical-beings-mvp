import React from 'react';
import { Creature, Knowledge } from '../game/types';
import Card from './Card';

interface CreatureZoneProps {
  creatures: Creature[];
  field: { creatureId: string; knowledge: Knowledge | null }[];
  onCreatureClick?: (creatureId: string) => void; // Optional: For rotating or targeting
}

const CreatureZone: React.FC<CreatureZoneProps> = ({ creatures, field, onCreatureClick }) => {
  return (
    <div className="flex justify-around items-start p-4 bg-green-900 rounded min-h-[200px]">
      <h3 className="text-sm font-semibold mr-2 self-center">Creatures:</h3>
      {creatures.map((creature) => {
        const fieldSlot = field.find(f => f.creatureId === creature.id);
        const attachedKnowledge = fieldSlot?.knowledge;

        return (
          <div key={creature.id} className="flex flex-col items-center mx-2">
            {/* Creature Card */} 
            <Card
              card={creature}
              onClick={onCreatureClick ? () => onCreatureClick(creature.id) : undefined}
            />
            {/* Attached Knowledge Card (if any) */} 
            <div className="mt-1 h-24"> {/* Placeholder for spacing */} 
              {attachedKnowledge && (
                <Card card={attachedKnowledge} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CreatureZone;
