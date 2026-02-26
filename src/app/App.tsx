
import { RouterProvider } from 'react-router';
import { router } from './routes';

function App() {
  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
