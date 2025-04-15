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
    // Added gap for better spacing when wrapping
    <div className="flex flex-wrap justify-center md:justify-around items-start p-2 md:p-4 bg-green-900 rounded min-h-[150px] md:min-h-[200px] gap-1 md:gap-2">
      <h3 className="text-xs md:text-sm font-semibold mr-2 self-center w-full md:w-auto text-center md:text-left mb-1 md:mb-0">Creatures:</h3>
      {creatures.map((creature) => {
        const fieldSlot = field.find(f => f.creatureId === creature.id);
        const attachedKnowledge = fieldSlot?.knowledge;

        return (
          // Adjusted margin for wrapping
          <div key={creature.id} className="flex flex-col items-center m-1 md:mx-2">
            {/* Creature Card */} 
            <Card
              card={creature}
              onClick={onCreatureClick ? () => onCreatureClick(creature.id) : undefined}
            />
            {/* Attached Knowledge Card (if any) */}
            {/* Adjusted height placeholder */}
            <div className="mt-1 h-20 md:h-24"> {/* Placeholder for spacing */} 
              {attachedKnowledge && (
                // Render smaller card for attached knowledge potentially
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
