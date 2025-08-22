export type MoveEvent = {
  id: string;        // instanceId for the card
  fromId: string;    // registry key for source DOM element
  toId: string;      // registry key for target DOM element
  image: string;     // image URL for the card clone
};

export type DamageEventPayload = {
  playerId: string;      // who got damaged
  amount: number;        // damage applied to power
  blocked?: number;      // amount blocked by defense
  bypass?: boolean;      // whether defense was bypassed
};
