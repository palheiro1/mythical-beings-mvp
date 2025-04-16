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
          // Using relative positioning for card stacking
          <div key={creature.id} className="relative m-2 md:m-3">
            {/* Card container with necessary space for rotated cards */}
            <div className="w-24 md:w-28 h-32 md:h-40 relative">
              {/* Creature Card */} 
              <div className="absolute inset-0 z-10">
                <Card
                  card={creature}
                  onClick={onCreatureClick ? () => onCreatureClick(creature.id) : undefined}
                />
              </div>
              
              {/* Attached Knowledge Card (if any) - positioned on top with rotation */}
              {attachedKnowledge && (
                <div className={`
                  absolute inset-0 transform translate-y-6 md:translate-y-8
                  ${attachedKnowledge.rotation ? 'z-30' : 'z-20'} // Increase z-index when rotated
                `}>
                  <Card 
                    card={attachedKnowledge}
                    rotation={attachedKnowledge.rotation || 0}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CreatureZone;
