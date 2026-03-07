import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full mt-10 py-6 px-4 md:px-8 text-center border-t border-gray-200 dark:border-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-4xl mx-auto leading-relaxed">
        Summoner Searcher is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
      </p>
    </footer>
  );
};

export default Footer;
