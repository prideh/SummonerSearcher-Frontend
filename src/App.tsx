import NavigationLayout from './nav/NavigationLayout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <div className="bg-gray-950 text-gray-200 min-h-screen">
        <NavigationLayout />
        <ToastContainer />
    </div>
  );
}

export default App;
