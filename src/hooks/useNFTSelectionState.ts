import { useReducer, useCallback } from 'react';
import { Creature } from '../game/types.js';

interface NFTSelectionState {
  selected: string[];
  timer: number;
  waiting: boolean;
  lost: boolean;
  isLoadingHand: boolean;
  dealtCreatures: Creature[];
  error: string | null;
  isConfirming: boolean;
  realtimeFailed: boolean;
}

type NFTSelectionAction = 
  | { type: 'SET_SELECTED'; payload: string[] }
  | { type: 'TOGGLE_CARD'; payload: string }
  | { type: 'DECREMENT_TIMER' }
  | { type: 'RESET_TIMER'; payload: number }
  | { type: 'SET_WAITING'; payload: boolean }
  | { type: 'SET_LOST'; payload: boolean }
  | { type: 'SET_LOADING_HAND'; payload: boolean }
  | { type: 'SET_DEALT_CREATURES'; payload: Creature[] }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CONFIRMING'; payload: boolean }
  | { type: 'SET_REALTIME_FAILED'; payload: boolean }
  | { type: 'RESET_STATE' };

const initialState: NFTSelectionState = {
  selected: [],
  timer: 60,
  waiting: false,
  lost: false,
  isLoadingHand: false,
  dealtCreatures: [],
  error: null,
  isConfirming: false,
  realtimeFailed: false,
};

function nftSelectionReducer(state: NFTSelectionState, action: NFTSelectionAction): NFTSelectionState {
  switch (action.type) {
    case 'SET_SELECTED':
      return { ...state, selected: action.payload };
    
    case 'TOGGLE_CARD': {
      const cardId = action.payload;
      const currentSelected = state.selected;
      
      if (currentSelected.includes(cardId)) {
        return { ...state, selected: currentSelected.filter(id => id !== cardId) };
      } else if (currentSelected.length < 3) {
        return { ...state, selected: [...currentSelected, cardId] };
      }
      return state;
    }
    
    case 'DECREMENT_TIMER':
      return { ...state, timer: Math.max(0, state.timer - 1) };
    
    case 'RESET_TIMER':
      return { ...state, timer: action.payload };
    
    case 'SET_WAITING':
      return { ...state, waiting: action.payload };
    
    case 'SET_LOST':
      return { ...state, lost: action.payload };
    
    case 'SET_LOADING_HAND':
      return { ...state, isLoadingHand: action.payload };
    
    case 'SET_DEALT_CREATURES':
      return { ...state, dealtCreatures: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    case 'SET_CONFIRMING':
      return { ...state, isConfirming: action.payload };
    
    case 'SET_REALTIME_FAILED':
      return { ...state, realtimeFailed: action.payload };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
}

export const useNFTSelectionState = () => {
  const [state, dispatch] = useReducer(nftSelectionReducer, initialState);

  const actions = {
    setSelected: useCallback((selected: string[]) => 
      dispatch({ type: 'SET_SELECTED', payload: selected }), []),
    
    toggleCard: useCallback((cardId: string) => 
      dispatch({ type: 'TOGGLE_CARD', payload: cardId }), []),
    
    decrementTimer: useCallback(() => 
      dispatch({ type: 'DECREMENT_TIMER' }), []),
    
    resetTimer: useCallback((time: number) => 
      dispatch({ type: 'RESET_TIMER', payload: time }), []),
    
    setWaiting: useCallback((waiting: boolean) => 
      dispatch({ type: 'SET_WAITING', payload: waiting }), []),
    
    setLost: useCallback((lost: boolean) => 
      dispatch({ type: 'SET_LOST', payload: lost }), []),
    
    setLoadingHand: useCallback((loading: boolean) => 
      dispatch({ type: 'SET_LOADING_HAND', payload: loading }), []),
    
    setDealtCreatures: useCallback((creatures: Creature[]) => 
      dispatch({ type: 'SET_DEALT_CREATURES', payload: creatures }), []),
    
    setError: useCallback((error: string | null) => 
      dispatch({ type: 'SET_ERROR', payload: error }), []),
    
    clearError: useCallback(() => 
      dispatch({ type: 'CLEAR_ERROR' }), []),
    
    setConfirming: useCallback((confirming: boolean) => 
      dispatch({ type: 'SET_CONFIRMING', payload: confirming }), []),
    
    setRealtimeFailed: useCallback((failed: boolean) => 
      dispatch({ type: 'SET_REALTIME_FAILED', payload: failed }), []),
    
    resetState: useCallback(() => 
      dispatch({ type: 'RESET_STATE' }), []),
  };

  return { state, actions };
};
