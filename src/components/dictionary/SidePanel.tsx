import React from 'react';
import type { UserWord, GridWord, Definition } from '../../models/types';

interface SidePanelProps {
  dictionary: UserWord[];
  gridWords: GridWord[];
  onDefinitionSelect: (word: GridWord, definition: Definition) => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  dictionary,
  gridWords,
  onDefinitionSelect
}) => {
  return (
    <div className="side-panel">
      <div className="tabs">
        <button className="active">Dictionnaire</button>
        <button>Mots de la grille</button>
      </div>
      <div className="dictionary-panel">
        {dictionary.map((word) => (
          <div key={word.id} className="word-item">
            <div className="word">{word.word}</div>
            <div className="definition">{word.definition}</div>
          </div>
        ))}
      </div>
    </div>
  );
};