import { Link } from 'react-router-dom';

/**
 * A simple 404 "Not Found" page that is displayed for any routes that are not defined.
 */
const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-lg mb-8">Oops! We couldn't find the page you were looking for.</p>
      <Link to="/search" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Go to Search
      </Link>
    </div>
  );
};

export default NotFoundPage;
