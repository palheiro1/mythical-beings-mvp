import { creatures, knowledgeCards as knowledges } from '@mythicalb/wisdom-duel-engine/catalog';
import type { Creature, Knowledge } from '../game/types.js';

export type DisplayCard = Creature | Knowledge;

const cards = [...creatures, ...knowledges];
const cardsById = new Map(cards.map(card => [card.id, card]));
export const getDisplayCardById = (id: string): DisplayCard | undefined => cardsById.get(id);

const cardsByImage = new Map(cards.map(card => [card.image, card]));
export const getDisplayCardForImage = (image: string): DisplayCard | undefined => cardsByImage.get(image);
