import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Grid } from '../models/types';

export const MyGrids: React.FC = () => {
    const navigate = useNavigate();
    // TODO: Charger les vraies grilles depuis l'API
    const grids: Grid[] = [];

    return (
        <div className="my-grids-page">
            <h1>Mes Grilles</h1>
            <div className="grids-list">
                {grids.map((grid) => (
                    <div key={grid.id} className="grid-card">
                        <h3>{grid.name}</h3>
                        <p>Status: {grid.status}</p>
                        <button onClick={() => navigate(`/edit/${grid.id}`)}>
                            Modifier
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};