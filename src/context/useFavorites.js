import { createContext, useContext } from 'react'

export const FavoritesContext = createContext(null)

export function useFavorites() {
  // Read the nearest provider instead of passing favorites through intermediate props.
  return useContext(FavoritesContext)
}
