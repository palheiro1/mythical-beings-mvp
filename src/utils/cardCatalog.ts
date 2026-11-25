import creatures from '../assets/creatures.json';
import knowledges from '../assets/knowledges.json';
import type { DisplayCard } from './digitalCards.js';

const cards = [...creatures, ...knowledges] as DisplayCard[];
const cardsByImage = new Map(cards.map(card => [card.image, card]));
export const getDisplayCardForImage = (image: string): DisplayCard | undefined => cardsByImage.get(image);
