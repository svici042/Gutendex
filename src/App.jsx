import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import { FavoritesProvider } from './context/FavoritesContext'
import CollectionPage from './pages/CollectionPage'
import BookPage from './pages/BookPage'
import FavoritesPage from './pages/FavoritesPage'
import NotFound from './pages/NotFound'
import './App.css'

// Layout keeps the header visible and renders each page through Outlet.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <CollectionPage /> },
      { path: '/category/:category', element: <CollectionPage /> },
      { path: '/books/:bookId', element: <BookPage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: import.meta.env.BASE_URL })

export default function App() {
  // Place shared favorites above the router so navigation does not reset the saved list.
  return (
    <FavoritesProvider>
      <RouterProvider router={router} />
    </FavoritesProvider>
  )
}
