import './Form.css';

function setField(onChange, value, key, next) {
  onChange({ ...value, [key]: next });
}

export function CharacterTab({ value, onChange }) {
  return (
    <div className="Form">
      <div className="Form-help">
        Tout ce que tu mets ici sera injecté dans le message système du modèle (cohérence du perso).
      </div>

      <label className="Field">
        <div className="Field-label">Nom</div>
        <input
          className="Input"
          value={value.name}
          onChange={(e) => setField(onChange, value, 'name', e.target.value)}
          placeholder="Ex: Lyria"
        />
      </label>

      <label className="Field">
        <div className="Field-label">Description</div>
        <textarea
          className="Input"
          value={value.description}
          onChange={(e) => setField(onChange, value, 'description', e.target.value)}
          placeholder="Backstory, contexte, relations, secrets..."
          rows={6}
        />
      </label>

      <label className="Field">
        <div className="Field-label">Apparence</div>
        <textarea
          className="Input"
          value={value.appearance}
          onChange={(e) => setField(onChange, value, 'appearance', e.target.value)}
          placeholder="Cheveux, yeux, tenue, accessoires (utile pour l’image)."
          rows={4}
        />
      </label>

      <label className="Field">
        <div className="Field-label">Personnalité</div>
        <textarea
          className="Input"
          value={value.personality}
          onChange={(e) => setField(onChange, value, 'personality', e.target.value)}
          placeholder="Traits, tics de langage, motivations..."
          rows={4}
        />
      </label>

      <label className="Field">
        <div className="Field-label">Règles</div>
        <textarea
          className="Input"
          value={value.rules}
          onChange={(e) => setField(onChange, value, 'rules', e.target.value)}
          placeholder="Ex: rester PG-13, éviter le méta, garder le ton sombre, etc."
          rows={4}
        />
      </label>
    </div>
  );
}

