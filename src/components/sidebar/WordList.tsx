// src/components/sidebar/WordList.tsx
import React from 'react';

interface WordListProps {
  words: string[];
  title?: string;
}

export const WordList: React.FC<WordListProps> = ({ words, title = "Mots trouvés" }) => {
  return (
    <div className="word-list-sidebar">
      <h3>{title}</h3>
      <div className="word-list-container">
        {words.length > 0 ? (
          <ul className="word-list">
            {words.map((word, index) => (
              <li key={index} className="word-item">
                {word}
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-words">Aucun mot trouvé</p>
        )}
      </div>
    </div>
  );
};